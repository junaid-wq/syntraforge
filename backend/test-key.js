const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const rawKey = process.env.GEMINI_API_KEY || "";
const key = rawKey.replace(/^["']|["']$/g, '').trim();

async function check() {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await res.json();
    if (data.models) {
      console.log("\n=== VALID MODELS FOR YOUR KEY ===");
      const models = data.models
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
        .map(m => m.name.replace("models/", ""));
      console.log(models.join("\n"));
    } else {
      console.log("Response:", data);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}
check();
