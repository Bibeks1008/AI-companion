"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";

type VoiceState = "idle" | "recording" | "transcribing";

interface Props {
  onTranscribed: (text: string) => void;
  disabled?: boolean;
}

const MAX_RECORDING_MS = 60_000;
const WARN_AT_MS = 55_000;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}


export function VoiceButton({ onTranscribed, disabled }: Props) {
  const [supported, setSupported] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia,
    );
  }, []);

  const clearTimers = useCallback(() => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    if (warnRef.current) clearTimeout(warnRef.current);
    autoStopRef.current = null;
    warnRef.current = null;
  }, []);

  const sendAudio = useCallback(
    async (blob: Blob) => {
      if (blob.size > MAX_AUDIO_BYTES) {
        toast.error("Recording too long");
        setVoiceState("idle");
        return;
      }

      setVoiceState("transcribing");
      const form = new FormData();
      form.append("audio", blob, "audio.webm");

      try {
        const res = await fetch("/api/voice/transcribe", {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
        const text: string = data.text ?? "";
        if (text.trim()) {
          onTranscribed(text.trim());
        } else {
          toast.error("Couldn't hear that, please try again");
        }
      } catch {
        toast.error("Couldn't hear that, please try again");
      } finally {
        setVoiceState("idle");
      }
    },
    [onTranscribed],
  );

  const stopRecording = useCallback(() => {
    clearTimers();
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, [clearTimers]);

  const startRecording = useCallback(async () => {
    if (voiceState !== "idle" || disabled) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionDenied(false);

      chunksRef.current = [];
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });
        sendAudio(blob);
      };

      recorder.start();
      setVoiceState("recording");

      warnRef.current = setTimeout(() => {
        toast("Recording will stop in 5 seconds");
      }, WARN_AT_MS);

      autoStopRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_RECORDING_MS);
    } catch {
      setPermissionDenied(true);
    }
  }, [voiceState, disabled, sendAudio, stopRecording]);

  // Release mic on unmount.
  useEffect(() => {
    return () => {
      clearTimers();
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
    };
  }, [clearTimers]);

  if (!supported) return null;

  if (voiceState === "transcribing") {
    return (
      <button
        type="button"
        disabled
        aria-label="Transcribing…"
        className="shrink-0 size-11 rounded-xl border border-input bg-muted/40 flex items-center justify-center text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin" />
      </button>
    );
  }

  if (voiceState === "recording") {
    return (
      <button
        type="button"
        onClick={stopRecording}
        aria-label="Stop recording"
        className="shrink-0 h-11 px-4 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center gap-2 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
      >
        <span className="flex items-center gap-[3px]">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="size-1.5 rounded-full bg-current animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
        <span className="text-sm font-medium">Stop</span>
      </button>
    );
  }

  if (permissionDenied) {
    return (
      <button
        type="button"
        disabled
        title="Microphone access needed — check browser permissions"
        aria-label="Microphone access needed"
        className="shrink-0 size-11 rounded-xl border border-input flex items-center justify-center text-muted-foreground/40 cursor-not-allowed"
      >
        <MicOff className="size-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={startRecording}
      disabled={disabled}
      aria-label="Start voice input"
      className="shrink-0 size-11 rounded-xl border border-input hover:bg-muted/40 flex items-center justify-center text-muted-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Mic className="size-4" />
    </button>
  );
}
