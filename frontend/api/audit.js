export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key missing' });
  
  try {
    // 1. Universal Image Extraction
    let imageBase64 = req.body?.imageBase64 || req.body?.image || req.body?.data;
    if (typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        imageBase64 = parsed.imageBase64 || parsed.image || parsed.data;
      } catch (e) {}
    }
    
    if (!imageBase64) return res.status(400).json({ error: 'Missing image data.' });
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    // 2. Strict camelCase JSON Payload for Google REST API
    const payload = {
      contents: [{
        parts: [
          { text: "Analyze this storefront. Return pure JSON with: score (number), strengths (array of strings), improvements (array of strings), actionItems (string)." },
          { inlineData: { mimeType: "image/jpeg", data: base64Data } }
        ]
      }],
      generationConfig: { responseMimeType: "application/json" }
    };

    // 3. Stable Model Pool
    const MODEL_POOL = [
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro-latest'
    ];

    let errorLog = [];

    for (const model of MODEL_POOL) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const rawText = await response.text();
        
        if (!response.ok) {
          errorLog.push(`${model} HTTP ${response.status}: ${rawText.slice(0, 100)}`);
          continue; 
        }

        // 4. Safe JSON Parse
        const data = JSON.parse(rawText);
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!textContent) continue;
        
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) continue;
        
        const parsedReport = JSON.parse(jsonMatch[0]);

        // 5. Success! Return the payload immediately.
        return res.status(200).json({
          score: parsedReport.score || 80,
          strengths: parsedReport.strengths || ["Clean presentation"],
          improvements: parsedReport.improvements || ["Consider lighting adjustments"],
          actionItems: parsedReport.actionItems || parsedReport.action_items || "Review visual hierarchy.",
          engineUsed: model
        });

      } catch (modelErr) {
        errorLog.push(`${model} exception: ${modelErr.message}`);
      }
    }

    // If it reaches this point, every model failed. We return the FULL log so we know exactly why.
    return res.status(503).json({ error: `All models failed. Log: ${errorLog.join(' | ')}` });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}