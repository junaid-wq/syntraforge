export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not configured' });
  }

  // Support JSON bodies with different common key names
  let imageBase64 = req.body?.imageBase64 || req.body?.image || req.body?.data || req.body?.file;
  let mimeType = req.body?.mimeType || 'image/jpeg';

  // If the client sent a raw string
  if (typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body);
      imageBase64 = parsed.imageBase64 || parsed.image || parsed.data || parsed.file;
      mimeType = parsed.mimeType || mimeType;
    } catch {}
  }

  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing image data. Please select or re-upload an image.' });
  }

  // Strip data URL prefixes if present
  const base64Clean = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  // Fallback pool: Flash -> Flash-8B -> Pro
  const MODEL_POOL = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro'
  ];

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `You are an expert visual merchandising auditor. Analyze this retail display/storefront image.
Return pure JSON with no markdown wrapping matching this exact schema:
{
  "score": 85,
  "strengths": ["Clear lighting", "Good spacing"],
  "improvements": ["Needs higher signage"],
  "actionItems": "Add bold top-level signage to draw foot traffic."
}`
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Clean
            }
          }
        ]
      }
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.2
    }
  };

  let lastError = null;

  for (const model of MODEL_POOL) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(payload)
      });

      const rawResponseText = await response.text();

      if (!response.ok) {
        lastError = `HTTP ${response.status}: ${rawResponseText.slice(0, 150)}`;
        console.warn(`Model ${model} failed (${response.status}):`, lastError);
        continue;
      }

      let data;
      try {
        data = JSON.parse(rawResponseText);
      } catch (parseErr) {
        console.warn(`Model ${model} returned invalid JSON wrapper:`, parseErr.message);
        continue;
      }

      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        lastError = `Model ${model} returned empty content`;
        continue;
      }

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        lastError = `Model ${model} produced no JSON block in response text`;
        continue;
      }

      const parsedReport = JSON.parse(jsonMatch[0]);

      return res.status(200).json({
        ...parsedReport,
        engineUsed: model
      });

    } catch (err) {
      lastError = err.message;
      console.warn(`Model ${model} fetch exception:`, err);
    }
  }

  return res.status(503).json({
    error: `Audit service busy: ${lastError || 'Please try again in a few moments'}`
  });
}