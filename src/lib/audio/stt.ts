import { toFile } from 'openai';
import { openai, STT_MODEL } from '@/lib/openai';

export type SttProvider = (audio: ArrayBuffer, mimeType: string) => Promise<{ text: string }>;

const MIME_EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/mpga': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
};

export const fakeStt: SttProvider = async () => {
  return { text: 'spoken test answer' };
};

export const openAiStt: SttProvider = async (audio, mimeType) => {
  const ext = MIME_EXT[mimeType.split(';')[0] ?? ''] ?? 'webm';
  const file = await toFile(Buffer.from(audio), `speech.${ext}`, { type: mimeType });
  const result = await openai().audio.transcriptions.create({ file, model: STT_MODEL });
  return { text: result.text ?? '' };
};

export function getStt(): SttProvider {
  return process.env.AUDIO_FAKE === '1' ? fakeStt : openAiStt;
}
