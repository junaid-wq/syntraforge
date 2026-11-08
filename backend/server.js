const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const PORT = process.env.PORT || 5000;
const rawKey = process.env.GEMINI_API_KEY || "";
const GEMINI_API_KEY = rawKey.replace(/^["']|["']$/g, '').trim();

// Lite models deliver sub-2s responses with zero latency bloat
const MODELS = ["gemini-3.8-flash-lite", "gemini-3.5-flash-lite", "gemini-3.8-flash"];

app.post('/api/generate-hooks', async (req, res) => {
  const { topic, tone, platform } = req.body;

  if (!topic) {
    return res.status(400).json({ error: "Please provide a topic or niche." });
  }

  const prompt = `Task: Generate 5 high-retention short-form video hooks.
Topic: "${topic}"
Style: "${tone || 'Curiosity Gap'}"
Platform: "${platform || 'Reels/TikTok/Shorts'}"

Respond ONLY with raw JSON matching this schema:
{
  "hooks": [
    {
      "hookText": "Opening spoken line (max 12 words)",
      "visualCue": "Specific 1-second visual action",
      "hookType": "e.g., Pattern Interrupt, Negative Framing, Secret Reveal",
      "retentionScore": 96
    }
  ]
}`;

  let output = null;
  let lastError = null;

  for (const model of MODELS) {
    try {
      const startTime = Date.now();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.6,
            maxOutputTokens: 600
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "REST request failed");
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const match = text?.match(/\{[\s\S]*\}/);
      if (match) {
        output = JSON.parse(match[0]);
        console.log(`? [${Date.now() - startTime}ms] Ultra-fast generation using ${model}`);
        break;
      }
    } catch (err) {
      lastError = err.message;
      console.warn(`[Skip] ${model}:`, err.message);
    }
  }

  if (!output || !output.hooks) {
    return res.status(500).json({ error: lastError || "Failed to generate hooks." });
  }

  res.json(output);
});

app.listen(PORT, () => {
  console.log(`ViralHook engine online at http://localhost:${PORT}`);
});
