import { GoogleGenAI, Type } from '@google/genai';

// Lazy initialization helper to avoid crash if API Key is missing on startup
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is not set. Please set it in your environment variables.');
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

/**
 * Analyzes patient symptoms before the visit.
 */
export async function analyzeSymptoms(chiefComplaint: string) {
  try {
    const ai = getGeminiClient();
    const prompt = `You are an expert clinical triage assistant. Analyze the following chief complaint and patient-reported symptoms. Ensure safety first.
Chief Complaint: "${chiefComplaint}"

Provide structured assessment details in JSON format. Do not include markdown code block formatting in your response if responseMimeType is set.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            urgency: {
              type: Type.STRING,
              description: "How urgently this patient needs to be seen. Allowed values: 'High', 'Medium', 'Low'",
              enum: ['High', 'Medium', 'Low'],
            },
            chiefComplaint: {
              type: Type.STRING,
              description: "Refined, professional medical summary of the chief complaint",
            },
            possibleCauses: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of 3-4 potential conditions or causes based on the symptoms",
            },
            suggestedQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of 4-5 follow-up questions the practitioner should ask during the intake",
            },
          },
          required: ['urgency', 'chiefComplaint', 'possibleCauses', 'suggestedQuestions'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini');
    }
    return JSON.parse(text);
  } catch (error) {
    console.error('Error during symptom analysis with Gemini:', error);
    throw error;
  }
}

/**
 * Converts clinical visit notes and prescriptions into a patient-friendly summary.
 */
export async function summarizeVisitNotes(clinicalNotes: string, medicationsText: string) {
  try {
    const ai = getGeminiClient();
    const prompt = `You are a warm, highly professional medical communicator. Translate the following clinical visit notes and prescribed medications into structured, compassionate, and patient-friendly instructions.
Clinical Notes: "${clinicalNotes}"
Medications: "${medicationsText}"

Provide details in JSON format.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "A compassionate, patient-friendly translation of the visit summary. Use clear, non-technical language.",
            },
            medicationSchedule: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Name of the medication" },
                  instructions: { type: Type.STRING, description: "Clear instructions on when and how to take it (e.g., 'Take 1 tablet in the morning after breakfast')" },
                  duration: { type: Type.STRING, description: "How long to take it (e.g., 'For 7 days')" }
                },
                required: ['name', 'instructions', 'duration']
              },
              description: "Structured medication schedule and intake guide",
            },
            precautions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Important safety warnings, side effects to watch for, or activities to avoid",
            },
            followUpAdvice: {
              type: Type.OBJECT,
              properties: {
                timeframe: { type: Type.STRING, description: "When the patient should follow up (e.g. 'In 2 weeks')" },
                warningSigns: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Specific symptoms or signs that should prompt immediate medical attention"
                }
              },
              required: ['timeframe', 'warningSigns'],
              description: "Actionable follow-up details and safety nets",
            },
          },
          required: ['summary', 'medicationSchedule', 'precautions', 'followUpAdvice'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini');
    }
    return JSON.parse(text);
  } catch (error) {
    console.error('Error during note summarization with Gemini:', error);
    throw error;
  }
}
