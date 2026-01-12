
import { GoogleGenAI, Type } from "@google/genai";
import { VoterRecord, ExtractionResponse } from "./types";

/**
 * Creates a fresh AI instance using the current environment key.
 * This is necessary to pick up changes when the user selects a new key via the dialog.
 */
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function extractVoters(input: { base64?: string, mimeType?: string, textContent?: string }): Promise<ExtractionResponse> {
  // Create a new instance right before making an API call to ensure it uses the most up-to-date API key
  const ai = getAI();
  const prompt = `
    Extract voter information from the following ${input.textContent ? 'text' : 'image'} from an electoral roll. 
    Look for: Assembly Constituency, Parliamentary Constituency, Part No, Part Name, and Polling Station.
    For each voter: EPIC No, Name, Age, Gender (M/F), Parent/Spouse Name, Serial No.
    Convert Marathi names and details to English. Return JSON.
  `;

  const contents = input.textContent 
    ? { parts: [{ text: `${prompt}\n\nCONTENT TO PROCESS:\n${input.textContent}` }] }
    : {
        parts: [
          { inlineData: { data: input.base64!, mimeType: input.mimeType! } },
          { text: prompt }
        ]
      };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            voters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  epicNo: { type: Type.STRING },
                  name: { type: Type.STRING },
                  age: { type: Type.NUMBER },
                  gender: { type: Type.STRING },
                  parentSpouseName: { type: Type.STRING },
                  serialNo: { type: Type.STRING },
                  partNo: { type: Type.STRING },
                  partName: { type: Type.STRING },
                  assemblyConstituency: { type: Type.STRING },
                  parliamentaryConstituency: { type: Type.STRING },
                  pollingStation: {
                    type: Type.OBJECT,
                    properties: { name: { type: Type.STRING }, address: { type: Type.STRING } }
                  }
                },
                required: ["epicNo", "name", "age", "gender", "parentSpouseName", "serialNo"]
              }
            },
            meta: {
              type: Type.OBJECT,
              properties: {
                assemblyConstituency: { type: Type.STRING },
                parliamentaryConstituency: { type: Type.STRING },
                partNo: { type: Type.STRING },
                partName: { type: Type.STRING }
              }
            }
          },
          required: ["voters"]
        }
      }
    });

    const rawJson = JSON.parse(response.text || '{}');
    const finalVoters: VoterRecord[] = (rawJson.voters || []).map((v: any) => ({
      epicNo: v.epicNo || `EXT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      name: v.name || 'Unknown',
      age: v.age || 0,
      gender: (v.gender === 'प' || v.gender === 'M') ? 'M' : (v.gender === 'F' ? 'F' : 'M'),
      parentSpouseName: v.parentSpouseName || 'Unknown',
      assemblyConstituency: v.assemblyConstituency || rawJson.meta?.assemblyConstituency || '',
      parliamentaryConstituency: v.parliamentaryConstituency || rawJson.meta?.parliamentaryConstituency || '',
      district: v.district || '',
      state: v.state || '',
      partNo: v.partNo || rawJson.meta?.partNo || '',
      partName: v.partName || rawJson.meta?.partName || '',
      serialNo: v.serialNo || '',
      pollingStation: {
        name: v.pollingStation?.name || '',
        address: v.pollingStation?.address || ''
      },
      lastUpdated: new Date().toISOString()
    }));

    return { voters: finalVoters, meta: rawJson.meta };
  } catch (error: any) {
    const msg = error?.message || "";
    // If Requested entity was not found, propagate the error so the UI can prompt for a new key
    if (msg.includes("Requested entity was not found")) {
      throw error;
    }
    if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
      throw new Error("QUOTA_EXCEEDED");
    }
    throw error;
  }
}

export async function verifyVoterRecord(voter: VoterRecord) {
  // Create a new instance right before making an API call to ensure it uses the most up-to-date API key
  const ai = getAI();
  const query = `Verify if this voter exists in official public records for Maharashtra/India: Name: ${voter.name}, EPIC Number: ${voter.epicNo}, Part: ${voter.partName}. Check for validity.`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: query }] },
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    return {
      text: response.text,
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error: any) {
    const msg = error?.message || "";
    // If Requested entity was not found, propagate the error so the UI can prompt for a new key
    if (msg.includes("Requested entity was not found")) {
      throw error;
    }
    if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
      throw new Error("QUOTA_EXCEEDED");
    }
    throw error;
  }
}
