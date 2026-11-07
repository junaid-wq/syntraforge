export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not configured' });
  }

  // 1. Universal image payload extraction (supports json, stringified json, raw data)
  let imageBase64 = req.body?.imageBase64 || req.body?.image || req.body?.data || req.body?.file;
  let mimeType = req.body?.mimeType || 'image/jpeg';

  if (typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body);
      imageBase64 = parsed.imageBase64 || parsed.image || parsed.data || parsed.file;
      mimeType = parsed.mimeType || mimeType;
    } catch {}
  }

  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing image data. Please select or upload an image.' });
  }

  // Clean base64 header if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  // 2. Exact v1beta supported REST model identifiers
  const MODEL_POOL = [
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-8b-latest',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash',
    'gemini-2.0-flash'
  ];

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `You are an expert visual merchandising auditor. Analyze this storefront or display image.
Return valid JSON matching this schema exactly:
{
  "score": 82,
  "strengths": ["Clean display", "Uniform spacing"],
  "improvements": ["Needs prominent signage", "Increase lighting"],
  "actionItems": "Introduce eye-catching category signage above the racks."
}`
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
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
        lastError = `Model ${model} returned HTTP ${response.status}: ${rawResponseText.slice(0, 120)}`;
        console.warn(lastError);
        continue;
      }

      let data;
      try {
        data = JSON.parse(rawResponseText);
      } catch (parseErr) {
        console.warn(`Model ${model} JSON parse failed:`, parseErr.message);
        continue;
      }

      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        lastError = `Model ${model} produced no text candidates`;
        continue;
      }

      // Robust JSON extraction (handles markdown wraps or raw string objects)
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        lastError = `Model ${model} produced no JSON object structure`;
        continue;
      }

      const parsedReport = JSON.parse(jsonMatch[0]);

      // Normalize keys so the UI can always render the report cards
      return res.status(200).json({
        score: parsedReport.score || 80,
        strengths: parsedReport.strengths || [],
        improvements: parsedReport.improvements || [],
        actionItems: parsedReport.actionItems || parsedReport.action_items || '',
        engineUsed: model
      });

    } catch (err) {
      lastError = err.message;
      console.warn(`Model ${model} fetch exception:`, err);
    }
  }

  return res.status(503).json({
    error: `Audit service busy: ${lastError || 'All models unavailable, please retry shortly'}`
  });
}