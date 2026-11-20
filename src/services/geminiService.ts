// Client-side BYO (Bring Your Own) Gemini API service
// Strictly uses browser localStorage for user-provided API key (no process.env or hardcoded keys).
// Dynamically imports @google/genai so the main initial bundle remains small and fast.

export const GEMINI_API_KEY_STORAGE_KEY = 'alam_khan_gemini_api_key';
export const GEMINI_DEFAULT_MODEL = 'gemini-4-hydrogen';

export interface GeminiResult {
  ok: boolean;
  text?: string;
  error?: string;
  needsKey?: boolean;
  errorCode?: 'MISSING_KEY' | 'INVALID_KEY' | 'PERMISSION' | 'RATE_LIMIT' | 'NOT_FOUND' | 'NETWORK' | 'UNKNOWN';
}

export function getStoredGeminiApiKey(): string {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return '';
    return (window.localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function saveStoredGeminiApiKey(apiKey: string): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const clean = apiKey.trim();
    if (!clean) {
      window.localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    } else {
      window.localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, clean);
    }
    return true;
  } catch {
    return false;
  }
}

export function clearStoredGeminiApiKey(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function maskGeminiApiKey(apiKey: string): string {
  const clean = apiKey.trim();
  if (!clean) return '';
  if (clean.length <= 10) return '••••••••';
  return `${clean.slice(0, 6)}••••••••${clean.slice(-4)}`;
}

export function mapGeminiError(err: unknown): {
  message: string;
  errorCode: NonNullable<GeminiResult['errorCode']>;
} {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      errorCode: 'NETWORK',
      message: 'ইন্টারনেট সংযোগ নেই। অনলাইনে যুক্ত হয়ে আবার চেষ্টা করুন।',
    };
  }

  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
      ? err
      : JSON.stringify(err || '');
  const lower = raw.toLowerCase();

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('invalid api key') ||
    lower.includes('400')
  ) {
    return {
      errorCode: 'INVALID_KEY',
      message:
        'প্রদত্ত Gemini API Key-টি সঠিক নয় বা বাতিল হয়ে গেছে। অনুগ্রহ করে সঠিক API Key দিয়ে আবার সেভ করুন।',
    };
  }

  if (lower.includes('403') || lower.includes('permission_denied') || lower.includes('forbidden')) {
    return {
      errorCode: 'PERMISSION',
      message:
        'এই API Key-টির Gemini ব্যবহারের অনুমতি নেই বা কী-টি ব্লক করা হয়েছে। Google AI Studio থেকে নতুন একটি ফ্রি Key তৈরি করে দিন।',
    };
  }

  if (
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit')
  ) {
    return {
      errorCode: 'RATE_LIMIT',
      message:
        'ফ্রি API Key-এর সাময়িক লিমিট পূর্ণ হয়েছে (429)। অনুগ্রহ করে ১ মিনিট অপেক্ষা করে পুনরায় চেষ্টা করুন।',
    };
  }

  if (lower.includes('404') || lower.includes('not_found') || lower.includes('not found')) {
    return {
      errorCode: 'NOT_FOUND',
      message:
        'AI মডেলটি সাময়িকভাবে পাওয়া যাচ্ছে না। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।',
    };
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('aborted')
  ) {
    return {
      errorCode: 'NETWORK',
      message:
        'নেটওয়ার্ক সমস্যার কারণে Gemini সার্ভারে সংযোগ করা যায়নি। ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।',
    };
  }

  return {
    errorCode: 'UNKNOWN',
    message: 'AI অনুরোধ প্রসেস করতে সমস্যা হয়েছে। অনুগ্রহ করে আপনার API Key ও ইন্টারনেট চেক করে পুনরায় চেষ্টা করুন।',
  };
}

export async function validateGeminiApiKey(apiKey: string): Promise<GeminiResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return {
      ok: false,
      needsKey: true,
      errorCode: 'MISSING_KEY',
      error: 'অনুগ্রহ করে প্রথমে আপনার Gemini API Key লিখুন।',
    };
  }

  if (cleanKey.length < 20) {
    return {
      ok: false,
      errorCode: 'INVALID_KEY',
      error: 'API Key-টি অসম্পূর্ণ মনে হচ্ছে। Google AI Studio থেকে প্রাপ্ত সম্পূর্ণ Key-টি পেস্ট করুন।',
    };
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: cleanKey });
    const response = await ai.models.generateContent({
      model: GEMINI_DEFAULT_MODEL,
      contents: 'Reply with only: OK',
    });
    const out = (response.text || '').trim();
    return {
      ok: true,
      text: out || 'সফলভাবে যাচাই হয়েছে!',
    };
  } catch (err) {
    const mapped = mapGeminiError(err);
    return {
      ok: false,
      errorCode: mapped.errorCode,
      error: mapped.message,
    };
  }
}

export async function generateBuildingAiAssistantResponse(params: {
  prompt: string;
  contextSummary: string;
  apiKeyOverride?: string;
}): Promise<GeminiResult> {
  const cleanKey = (params.apiKeyOverride ?? getStoredGeminiApiKey()).trim();
  if (!cleanKey) {
    return {
      ok: false,
      needsKey: true,
      errorCode: 'MISSING_KEY',
      error:
        'AI সুবিধা ব্যবহার করতে আপনার নিজের ফ্রি Gemini API Key সেট করা প্রয়োজন। উপরের "API Key সেটিংস" বক্সে Key বসিয়ে সংরক্ষণ করুন।',
    };
  }

  const userPrompt = params.prompt.trim();
  if (!userPrompt) {
    return {
      ok: false,
      errorCode: 'UNKNOWN',
      error: 'অনুগ্রহ করে আপনার প্রশ্ন বা নোটিশের বিষয় লিখুন।',
    };
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: cleanKey });

    const response = await ai.models.generateContent({
      model: GEMINI_DEFAULT_MODEL,
      contents: `${params.contextSummary}\n\nব্যবহারকারীর অনুরোধ:\n${userPrompt}`,
      config: {
        systemInstruction:
          'আপনি "আলম খান বিল্ডিং" (কর্তৃপক্ষ: হৃদয়)-এর ভাড়া ও বিদ্যুৎ বিল ব্যবস্থাপনা সহায়ক। সর্বদা সহজ, ভদ্র ও স্পষ্ট বাংলায় উত্তর দিন। প্রদত্ত তথ্যের বাইরে কোনো মনগড়া টাকা বা ভাড়াটিয়ার তথ্য বানাবেন না। ডাইনিং ও বাথরুমের যৌথ সাব-মিটার কেবল রুম ৭ হতে ৩৪ (২৮টি রুম) অনুযায়ী ভাগ হয় — এটি মনে রাখবেন।',
      },
    });

    const text = (response.text || '').trim();
    if (!text) {
      return {
        ok: false,
        errorCode: 'UNKNOWN',
        error: 'AI থেকে কোনো উত্তর পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
      };
    }

    return { ok: true, text };
  } catch (err) {
    const mapped = mapGeminiError(err);
    return {
      ok: false,
      errorCode: mapped.errorCode,
      error: mapped.message,
    };
  }
}
