import { GoogleGenerativeAI } from '@google/generative-ai';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AI_KEY_STORAGE = 'gemini_api_key';

export async function saveAiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(AI_KEY_STORAGE, key.trim());
}

export async function getAiKey(): Promise<string | null> {
  return await AsyncStorage.getItem(AI_KEY_STORAGE);
}

export async function getAiExplanation(
  question: string,
  options: string,
  correctAnswer: string
): Promise<string> {
  const apiKey = await getAiKey();

  if (!apiKey) {
    return "AI Key missing. Please add your Gemini API Key in the Settings tab.";
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
      You are an expert AWS tutor helping a student prepare for the AWS Certified AI Practitioner (AIF-C01) exam.

      Question: ${question}
      Options: ${options}
      Correct Answer: ${correctAnswer}

      Task: Explain WHY the correct answer is right and why the other options are less suitable for this specific AWS use case.
      Keep the explanation concise (max 3-4 sentences), encouraging, and easy to understand.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    if (error?.message?.includes('API_KEY_INVALID')) {
      return "Invalid API Key. Please check your key in the Settings tab.";
    }
    return "Sorry, I couldn't generate an AI explanation right now. Please check your internet connection.";
  }
}
