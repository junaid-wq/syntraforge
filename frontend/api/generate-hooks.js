export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { topic, angle, platform } = req.body || {};

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY environment variable is missing" });
  }

  const prompt = `You are an elite viral short-form video strategist.
Generate 5 high-retention video hooks for:
Topic: ${topic}
Psychological Angle: ${angle || "Controversial"}
Platform Focus: ${platform || "Instagram Reels & YouTube Shorts"}

Return ONLY a valid raw JSON array of 5 objects with no markdown fences or conversational text:
[
  {
    "hook": "The opening line for the first 3 seconds",
    "visualCue": "Specific on-screen visual or camera movement",
    "score": "95%"
  }
]`;

  const requestPayload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  };

  // Candidate endpoints across v1 and v1beta
  const endpointsToTry = [
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
    `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent`
  ];

  // 1. Try dynamic model discovery first
  try {
    const listResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { headers: { "x-goog-api-key": apiKey } }
    );

    if (listResp.ok) {
      const modelData = await listResp.json();
      const validModels = (modelData.models || []).filter(
        (m) => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")
      );

      if (validModels.length > 0) {
        const preferred =
          validModels.find((m) => m.name.includes("flash")) ||
          validModels.find((m) => m.name.includes("gemini")) ||
          validModels[0];

        if (preferred && preferred.name) {
          endpointsToTry.unshift(
            `https://generativelanguage.googleapis.com/v1beta/${preferred.name}:generateContent`
          );
        }
      }
    }
  } catch (e) {
    console.warn("Model auto-detection skipped:", e.message);
  }

  // 2. Execute against candidates until successful
  let lastError = null;

  for (const endpoint of endpointsToTry) {
    try {
      const url = `${endpoint}?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(requestPayload)
      });

      const data = await response.json();

      if (response.ok) {
        let outputText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

        if (outputText.startsWith("```json")) outputText = outputText.slice(7);
        if (outputText.startsWith("```")) outputText = outputText.slice(3);
        if (outputText.endsWith("```")) outputText = outputText.slice(0, -3);

        const parsedHooks = JSON.parse(outputText.trim());
        return res.status(200).json({ success: true, hooks: parsedHooks, data: parsedHooks });
      } else {
        lastError = data.error?.message || "Generation request failed";
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  return res.status(500).json({ error: lastError || "Failed to generate hooks with available models" });
}
