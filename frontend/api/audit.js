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

  // Dedicated endpoints ordered by vision quality; avoids the congested flash-latest alias
  const candidateModels = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-8b',
    'gemini-flash-latest'
  ];

  for (const model of candidateModels) {
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

      // If this specific model pool is overloaded, failover immediately to the next candidate
      if (response.status === 503 || response.status === 429) {
        console.warn(`Model ${model} overloaded (HTTP ${response.status}). Trying next model...`);
        continue;
      }

      if (!response.ok) {
        // Skip deprecated/unsupported models and try next
        if (response.status === 404) continue;
        throw new Error(data.error?.message || `API error ${response.status}`);
      }

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const cleanText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      return res.status(200).json(JSON.parse(cleanText));
    } catch (err) {
      console.warn(`Model ${model} execution error:`, err.message);
      if (model === candidateModels[candidateModels.length - 1]) {
        return res.status(500).json({ error: 'Audit failed: ' + (err.message || 'All inference models busy.') });
      }
    }
  }

  return res.status(503).json({ error: 'All Gemini model pools are temporarily busy. Please retry shortly.' });
}