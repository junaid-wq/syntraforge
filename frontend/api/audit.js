// frontend/api/audit.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MODELS = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.5-pro"];

const MODELS = process.env.GEMINI_MODELS
  ? process.env.GEMINI_MODELS.split(",").map((m) => m.trim()).filter(Boolean)
  : DEFAULT_MODELS;

const PROMPT = `You are a visual design auditor. Analyze the attached image and respond ONLY with JSON matching this schema:
{
  "score": number (0-100),
  "strengths": string[],
  "improvements": string[],
  "actionItems": string
}
Be specific and concrete. "actionItems" is a single string summarizing the prioritized next steps.`;

// ---------- Helpers ----------

function parseBody(body) {
  let parsed = body;
  // Body may be a string, possibly double-stringified
  for (let i = 0; i < 2 && typeof parsed === "string"; i++) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      break; // not JSON; treat as raw string payload
    }
  }
  return parsed;
}

function extractImage(body) {
  const parsed = parseBody(body);
  let raw;

  if (typeof parsed === "string") {
    raw = parsed; // raw base64 or data URI sent as the body
  } else if (parsed && typeof parsed === "object") {
    raw = parsed.imageBase64 ?? parsed.image ?? parsed.data;
  }

  if (typeof raw !== "string" || !raw.trim()) return null;

  let mimeType = "image/jpeg";
  const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  if (match) mimeType = match[1];

  const data = raw
    .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "")
    .replace(/\s/g, "");

  return data ? { data, mimeType } : null;
}

function parseModelJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in model response");
  const obj = JSON.parse(match[0]);

  return {
    score: Number.isFinite(Number(obj.score)) ? Number(obj.score) : 0,
    strengths: Array.isArray(obj.strengths) ? obj.strengths.map(String) : [],
    improvements: Array.isArray(obj.improvements) ? obj.improvements.map(String) : [],
    actionItems: Array.isArray(obj.actionItems)
      ? obj.actionItems.join("\n")
      : String(obj.actionItems ?? ""),
  };
}

// ---------- Handler ----------

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not set" });
  }

  const image = extractImage(req.body);
  if (!image) {
    return res.status(400).json({
      error: "No image found. Send JSON with one of: imageBase64, image, data.",
    });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const failures = [];

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
        },
      });

      const result = await model.generateContent([
        PROMPT,
        { inlineData: { data: image.data, mimeType: image.mimeType } },
      ]);

      const text = result.response.text();
      const audit = parseModelJson(text);

      return res.status(200).json({ ...audit, model: modelName });
    } catch (err) {
      const failure = {
        model: modelName,
        status: err?.status ?? err?.statusCode ?? null,
        message: err?.message ?? String(err),
      };
      failures.push(failure);
      console.error(`[audit] ${modelName} failed:`, failure);
    }
  }

  return res.status(503).json({
    error: "All models failed",
    failures,
  });
}