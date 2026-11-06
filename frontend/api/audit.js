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
Assess visual hierarchy, signage legibility, merchandising attractiveness, lighting, and entry clarity.
Output strictly valid JSON matching this exact structure:
{
  "score": 85,
  "strengths": ["Clear signage", "Organized layout", "Good lighting"],
  "improvements": ["High window glare", "Cluttered focal point", "Dim accent lamps"],
  "actionItems": "Reorganize the front display and adjust spotlighting to enhance street appeal."
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

  // Supported models for modern AI Studio keys, ordered by speed and capacity
  const targetModels = [
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest'
  ];

  let lastError = null;

  for (const model of targetModels) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        lastError = data.error?.message || `HTTP ${response.status}`;
        console.warn(`Model ${model} failed (${response.status}):`, lastError);
        continue; // Try next model pool
      }

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const cleanText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      return res.status(200).json(JSON.parse(cleanText));
    } catch (err) {
      lastError = err.message;
      console.warn(`Model ${model} fetch error:`, err);
    }
  }

  return res.status(503).json({
    error: `Audit service busy: ${lastError || 'Please try again in a few moments.'}`
  });
}