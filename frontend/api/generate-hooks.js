import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { topic, angle, platform } = req.body || {};

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

    const result = await model.generateContent(prompt);
    let outputText = result.response.text().trim();

    // Strip accidental Markdown fences if returned by the model
    if (outputText.startsWith("```json")) {
      outputText = outputText.slice(7);
    } else if (outputText.startsWith("```")) {
      outputText = outputText.slice(3);
    }
    if (outputText.endsWith("```")) {
      outputText = outputText.slice(0, -3);
    }

    const data = JSON.parse(outputText.trim());
    return res.status(200).json({ success: true, hooks: data, data: data });
  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate hooks" });
  }
}
