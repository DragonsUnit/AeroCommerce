import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

