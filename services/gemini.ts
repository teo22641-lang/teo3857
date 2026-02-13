
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export async function getGameAdvice(score: number, powerMode: boolean, ghostCount: number) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The player is currently playing a Pac-Man game. 
      Current Score: ${score}. 
      Power Mode Active: ${powerMode ? 'Yes' : 'No'}.
      Ghosts nearby: ${ghostCount}.
      Give a short, snappy, 1-sentence retro gamer tip in Spanish. 
      Example: "¡Cuidado! Los fantasmas te están rodeando."`,
      config: {
        maxOutputTokens: 50,
      }
    });
    return response.text.trim();
  } catch (error) {
    console.error("Gemini advice failed", error);
    return "¡Sigue comiendo esos puntos!";
  }
}
