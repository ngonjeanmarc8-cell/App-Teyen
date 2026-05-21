import OpenAI from 'openai';
import { env } from '@/lib/env';

let cached: OpenAI | undefined;

export function openai(): OpenAI {
  if (!cached) {
    cached = new OpenAI({ apiKey: env().OPENAI_API_KEY });
  }
  return cached;
}

export const GENERATION_MODEL = 'gpt-4o-mini';
export const CHAT_MODEL = 'gpt-4o-mini';
