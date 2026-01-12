
import { GoogleGenAI } from "@google/genai";
import { VoterRecord } from "./types";

/**
 * Creates a fresh AI instance using the current environment key.
 */
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getDatabaseInsights(voters: VoterRecord[]) {
  if (voters.length === 0) return null;

  // Create a new instance right before making an API call to ensure it always uses the most up-to-date API key
  const ai = getAI();
  const dataSummary = {
    total: voters.length,
    genderSplit: {
      M: voters.filter(v => v.gender === 'M').length,
      F: voters.filter(v => v.gender === 'F').length
    },
    avgAge: voters.reduce((acc, v) => acc + v.age, 0) / voters.length,
    constituencies: [...new Set(voters.map(v => v.assemblyConstituency))].filter(Boolean)
  };

  const prompt = `
    Analyze this voter database summary and provide a brief strategic 3-bullet point executive insight.
    Data: ${JSON.stringify(dataSummary)}
    Focus on: Gender balance, age demographics, and regional coverage.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: prompt }] }
    });

    return {
      stats: dataSummary,
      aiInsights: response.text
    };
  } catch (error: any) {
    const msg = error?.message || "";
    // If Requested entity was not found, propagate the error as per GenAI guidelines
    if (msg.includes("Requested entity was not found")) {
      throw error;
    }
    return { stats: dataSummary, aiInsights: "AI Analysis unavailable at the moment." };
  }
}
