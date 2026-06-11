/** @format */

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

function apiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
  return key;
}

/**
 * Speech-to-text: converts an audio Blob to a text transcript.
 * Throws on failure — caller owns error handling.
 */
export async function transcribe(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", audio, "audio.webm");
  form.append("model_id", "scribe_v1");

  const res = await fetch(`${ELEVENLABS_BASE}/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": apiKey() },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`STT error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return (data.text ?? "") as string;
}

/**
 * Text-to-speech: converts text to an audio/mpeg Blob using the given voice.
 * Uses eleven_turbo_v2_5 for low-latency conversational responses.
 * Throws on failure — caller owns error handling.
 */
export async function speak(text: string, voiceId: string): Promise<Blob> {
  const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    throw new Error(`TTS error ${res.status}: ${await res.text()}`);
  }

  return res.blob();
}

export const elevenlabs = { transcribe, speak };
