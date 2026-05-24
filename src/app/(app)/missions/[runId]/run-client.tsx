'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Turn = { id: string; role: 'user' | 'assistant'; content: string; correction: string | null };
type Status = 'in_progress' | 'success' | 'incomplete';

export function RunClient({
  runId,
  objective,
  turnLimit,
  initialStatus,
  initialTurns,
}: {
  runId: string;
  objective: string;
  turnLimit: number;
  initialStatus: Status;
  initialTurns: { role: 'user' | 'assistant'; content: string; correction: string | null }[];
}) {
  const [turns, setTurns] = useState<Turn[]>(() =>
    initialTurns.map((t) => ({ ...t, id: crypto.randomUUID() })),
  );
  const [status, setStatus] = useState<Status>(initialStatus);
  const [turnsLeft, setTurnsLeft] = useState<number>(
    turnLimit - initialTurns.filter((t) => t.role === 'user').length,
  );
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  // Mirror soundOn in a ref so playReply (called after an in-flight request)
  // reads the latest value, not the one captured when it was defined.
  const soundOnRef = useRef(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function toggleSound() {
    const next = !soundOnRef.current;
    soundOnRef.current = next;
    setSoundOn(next);
  }

  // Plays the TTS for a text. Always plays when called directly (e.g. the
  // "Écouter" button = a real user gesture, never blocked by autoplay policy).
  // Auto-play after a turn is gated by soundOn at the call site instead.
  async function playReply(text: string) {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      // audio is best-effort; ignore failures
    }
  }

  async function submitMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending || status !== 'in_progress') return;
    setDraft('');
    setError(null);
    setTurns((t) => [
      ...t,
      { id: crypto.randomUUID(), role: 'user', content: trimmed, correction: null },
    ]);
    setPending(true);
    try {
      const res = await fetch('/api/missions/turn', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ runId, message: trimmed }),
      });
      if (!res.ok) throw new Error('network');
      const data = (await res.json()) as {
        reply: string;
        correction: string | null;
        status: Status;
        turnsLeft: number;
      };
      setTurns((t) => [
        ...t,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.reply,
          correction: data.correction,
        },
      ]);
      setStatus(data.status);
      setTurnsLeft(data.turnsLeft);
      if (soundOnRef.current) void playReply(data.reply);
    } catch {
      setError('Petit souci. Réessaie.');
    } finally {
      setPending(false);
    }
  }

  async function startRecording() {
    if (recording || pending || status !== 'in_progress') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        for (const track of stream.getTracks()) track.stop();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        await transcribeAndSend(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError('Micro indisponible — autorise-le ou tape ta réponse.');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function transcribeAndSend(blob: Blob) {
    setError(null);
    setPending(true);
    try {
      const form = new FormData();
      form.append('audio', blob, 'speech.webm');
      const res = await fetch('/api/transcribe', { method: 'POST', body: form });
      if (!res.ok) throw new Error('network');
      const { text } = (await res.json()) as { text: string };
      if (!text.trim()) {
        setError("Je n'ai pas bien entendu — réessaie ou tape.");
        setPending(false);
        return;
      }
      setPending(false);
      await submitMessage(text);
    } catch {
      setError('Petit souci de transcription. Réessaie ou tape.');
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-gray-100 p-3 text-sm">
        <span className="font-medium">Objectif :</span> {objective}
        {status === 'in_progress' && (
          <span className="ml-2 text-gray-500">· {turnsLeft} tour(s) restant(s)</span>
        )}
      </div>

      <div className="space-y-3 rounded-md border border-gray-200 bg-white p-4">
        {turns.map((t) => (
          <div key={t.id} className={t.role === 'user' ? 'text-right' : 'text-left'}>
            <span
              className={`inline-block max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                t.role === 'user' ? 'bg-black text-white' : 'bg-gray-100 text-gray-900'
              }`}
            >
              {t.content}
            </span>
            {t.correction && <p className="mt-1 text-xs text-amber-700">✍️ {t.correction}</p>}
            {t.role === 'assistant' && (
              <button
                type="button"
                onClick={() => void playReply(t.content)}
                className="mt-1 block text-xs text-gray-500 underline hover:text-black"
              >
                🔊 Écouter
              </button>
            )}
          </div>
        ))}
        {pending && <p className="text-sm text-gray-400">…</p>}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {status === 'in_progress' ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                if (recording) stopRecording();
                else void startRecording();
              }}
            >
              {recording ? '⏹ Arrêter' : '🎤 Parler'}
            </Button>
            <Button type="button" variant="ghost" onClick={toggleSound}>
              {soundOn ? '🔊 Son activé' : '🔇 Son coupé'}
            </Button>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submitMessage(draft);
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ta réponse en anglais…"
              aria-label="Réponse"
              disabled={pending}
            />
            <Button type="submit" disabled={pending || draft.trim().length === 0}>
              Envoyer
            </Button>
          </form>
        </div>
      ) : (
        <div className="space-y-3 rounded-md border border-gray-200 bg-white p-4">
          <p className={`font-medium ${status === 'success' ? 'text-green-700' : 'text-red-600'}`}>
            {status === 'success' ? '🎉 Mission réussie !' : 'Mission à retravailler.'}
          </p>
          <div className="flex gap-2">
            <Link href="/missions">
              <Button variant="ghost">Retour aux missions</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
