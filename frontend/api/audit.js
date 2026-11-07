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

    // 2. Strict JSON Payload
    const payload = {
      contents: [{
        parts: [
          { text: "Analyze this storefront. Return pure JSON with: score (number), strengths (array of strings), improvements (array of strings), actionItems (string)." },
          { inline_data: { mime_type: "image/jpeg", data: base64Data } }
        ]
      }],
      generationConfig: { response_mime_type: "application/json" }
    };

    // 3. Self-Healing Model Pool
    // The server will try these from top to bottom. If any model 404s or 503s, it auto-switches to the next.
    const MODEL_POOL = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];

    let lastError = "All AI models are currently unavailable.";

    for (const model of MODEL_POOL) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const rawText = await response.text();
        
        // If the model name is wrong (404) or busy (429/503), skip to the next model
        if (!response.ok) {
          lastError = `Model ${model} failed: ${rawText.slice(0, 100)}`;
          console.warn(lastError);
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
        lastError = `Model ${model} exception: ${modelErr.message}`;
        console.warn(lastError);
        // Continue to the next model in the loop
      }
    }

    // If it reaches this point, every model in the array failed
    return res.status(503).json({ error: lastError });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}