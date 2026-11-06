import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import Stripe from 'stripe';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Security Middleware
app.use(helmet());
app.use(express.json());

const allowedOrigins = [
  'https://syntraforge.me',
  'https://www.syntraforge.me',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Blocked by CORS policy'));
  }
}));

// Rate limiter: Max 20 audits per 15 min per IP
const auditLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Rate limit reached. Please wait 15 minutes before auditing another storefront.' }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Audit Route with Gemini Vision
app.post('/api/audit', auditLimiter, upload.single('storefront'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an image to audit.' });
    }

    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: req.file.mimetype
      }
    };

    const prompt = `You are OptiFront, an expert visual retail and storefront auditor for Syntraforge.
Analyze this storefront, display, or retail space image.
Assess visual hierarchy, signage legibility, merchandising attractiveness, lighting, and entry clarity.
Output strictly structured JSON with:
- score (integer 0 to 100)
- strengths (array of 3 distinct observations)
- improvements (array of 3 specific weaknesses)
- actionItems (concise paragraph of high-impact changes)`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [prompt, imagePart],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
            actionItems: { type: Type.STRING }
          },
          required: ['score', 'strengths', 'improvements', 'actionItems']
        }
      }
    });

    const parsed = JSON.parse(response.text);
    return res.json(parsed);
  } catch (err) {
    console.error('Audit Error:', err);
    return res.status(500).json({ error: 'Failed to process visual audit.' });
  }
});

// Stripe Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'OptiFront Pro Pass (50 Audits)',
            description: 'Access high-resolution storefront AI audits and automated report generation.'
          },
          unit_amount: 1900 // $19.00
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL || 'https://syntraforge.me'}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL || 'https://syntraforge.me'}`
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Syntraforge backend running on port ${PORT}`);
});