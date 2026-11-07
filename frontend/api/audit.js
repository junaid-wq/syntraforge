export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key missing' });
  
  try {
    // 1. Bulletproof Image Extraction
    let imageBase64 = req.body?.imageBase64 || req.body?.image || req.body?.data;
    if (typeof req.body === 'string') {
      const parsed = JSON.parse(req.body);
      imageBase64 = parsed.imageBase64 || parsed.image || parsed.data;
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

    // 3. Single Stable Model Endpoint (Flash)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${rawText.slice(0, 100)}`);
    }

    // 4. Safe JSON Parse
    const data = JSON.parse(rawText);
    const textContent = data.candidates[0].content.parts[0].text;
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) throw new Error("No JSON returned from AI");
    const parsedReport = JSON.parse(jsonMatch[0]);

    // 5. Guaranteed UI Data Structure
    return res.status(200).json({
      score: parsedReport.score || 80,
      strengths: parsedReport.strengths || ["Clean presentation"],
      improvements: parsedReport.improvements || ["Consider lighting adjustments"],
      actionItems: parsedReport.actionItems || parsedReport.action_items || "Review visual hierarchy.",
      engineUsed: "gemini-1.5-flash"
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}