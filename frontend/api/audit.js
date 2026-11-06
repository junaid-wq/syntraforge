export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, mimeType } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Please upload an image to audit.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is missing.' });
  }

  const prompt = `You are OptiFront, an expert visual retail storefront auditor for Syntraforge.
Analyze this retail display or storefront photo.
Assess visual hierarchy, signage legibility, merchandising attractiveness, lighting, and layout.
Output strictly valid JSON with these exact keys:
{
  "score": <integer from 0 to 100>,
  "strengths": [<array of 3 distinct positive observations>],
  "improvements": [<array of 3 specific weaknesses or areas to fix>],
  "actionItems": "<concise paragraph of high-impact actionable changes>"
}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: image
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json'
    }
  };

  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

  // Retry up to 3 times on 503 / 429 demand spikes
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        if ((response.status === 503 || response.status === 429) && attempt < 3) {
          // Wait 1.5s then retry
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }
        return res.status(response.status).json({
          error: data.error?.message || 'Gemini API temporary error. Please try again.'
        });
      }

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        return res.status(500).json({ error: 'Empty evaluation response from model.' });
      }

      const cleanText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      return res.status(200).json(JSON.parse(cleanText));
    } catch (err) {
      if (attempt === 3) {
        return res.status(500).json({ error: err.message || 'Audit request failed.' });
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  return res.status(500).json({ error: 'Audit timed out. Please try again.' });
}