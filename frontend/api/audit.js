import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, mimeType } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Please upload an image to audit.' });
  }

  try {
    const prompt = `You are OptiFront, an expert visual retail and storefront auditor for Syntraforge.
Analyze this storefront, display, or retail space image.
Assess visual hierarchy, signage legibility, merchandising attractiveness, lighting, and entry clarity.
Output strictly valid JSON with these exact keys:
{
  "score": <integer from 0 to 100>,
  "strengths": [<array of 3 distinct positive observations>],
  "improvements": [<array of 3 specific weaknesses or areas to fix>],
  "actionItems": "<concise paragraph of high-impact actionable changes>"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        prompt,
        {
          inlineData: {
            data: image,
            mimeType: mimeType || 'image/jpeg'
          }
        }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsed = JSON.parse(response.text);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Audit Error:', err);
    return res.status(500).json({ error: 'Audit failed: ' + (err.message || 'Unknown error') });
  }
}