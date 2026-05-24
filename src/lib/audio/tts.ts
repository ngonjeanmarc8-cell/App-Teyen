import { openai, TTS_MODEL, TTS_VOICE } from '@/lib/openai';

export type TtsProvider = (text: string) => Promise<{ audio: Buffer; contentType: string }>;

// Minimal MP3 frame header bytes — enough to be a non-empty audio payload in tests.
const FAKE_MP3 = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00]);

export const fakeTts: TtsProvider = async () => {
  return { audio: FAKE_MP3, contentType: 'audio/mpeg' };
};

export const openAiTts: TtsProvider = async (text) => {
  const response = await openai().audio.speech.create({
    model: TTS_MODEL,
    voice: TTS_VOICE,
    input: text,
    response_format: 'mp3',
  });
  const audio = Buffer.from(await response.arrayBuffer());
  return { audio, contentType: 'audio/mpeg' };
};

export function getTts(): TtsProvider {
  return process.env.AUDIO_FAKE === '1' ? fakeTts : openAiTts;
}
