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

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
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
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || JSON.stringify(data));
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('No analysis content returned from Gemini.');
    }

    const cleanText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleanText);

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Audit Error:', err);
    return res.status(500).json({ error: 'Audit failed: ' + (err.message || 'Unknown error') });
  }
}