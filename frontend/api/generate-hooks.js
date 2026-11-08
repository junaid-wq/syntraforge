export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { topic, angle, platform } = req.body || {};

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is missing in environment variables" });
  }

  const prompt = `You are a world-class viral video strategist.
Generate 5 high-retention video hooks for:
Topic: ${topic}
Psychological Angle: ${angle || "Controversial"}
Platform Focus: ${platform || "Shorts/Reels/TikTok"}

Format your response strictly as valid raw JSON with no Markdown wrapping or backticks. Return an array of 5 objects matching this schema:
[
  {
    "hook": "The opening verbal line (first 3 seconds)",
    "visualCue": "Actionable on-screen text, gesture, or shot composition",
    "score": "Virality retention score like 94%"
  }
]`;

  try {
    // Works with standard AIza keys as well as AQ. bearer tokens
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error details:", data);
      return res.status(response.status).json({
        error: data.error?.message || "Google Generative API returned an error",
        details: data
      });
    }

    let outputText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (outputText.startsWith("```json")) outputText = outputText.slice(7);
    if (outputText.startsWith("```")) outputText = outputText.slice(3);
    if (outputText.endsWith("```")) outputText = outputText.slice(0, -3);

    const parsedHooks = JSON.parse(outputText.trim());
    return res.status(200).json({ success: true, hooks: parsedHooks, data: parsedHooks });
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate hooks" });
  }
}
