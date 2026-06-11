"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Conversation } from "@11labs/client";
import type { UIMessage } from "ai";
import { AudioLines, Loader2, MicOff, Square } from "lucide-react";
import { toast } from "sonner";

type ConvStatus = "idle" | "connecting" | "connected" | "disconnecting";

interface Props {
  sessionId: string | null;
  voiceId: string | null;
  disabled?: boolean;
  messages?: UIMessage[];
  onMessage: (text: string, source: "user" | "ai") => void;
  onSpeakingChange: (isSpeaking: boolean) => void;
}

export function VoiceModeButton({
  sessionId,
  voiceId,
  disabled,
  messages,
  onMessage,
  onSpeakingChange,
}: Props) {
  const [status, setStatus] = useState<ConvStatus>("idle");
  const convRef = useRef<Conversation | null>(null);

  // Clean up on unmount if a session is still open.
  useEffect(() => {
    return () => {
      convRef.current?.endSession().catch(() => {});
    };
  }, []);

  const start = useCallback(async () => {
    if (!sessionId) {
      toast.error("Session not ready — try again in a moment");
      return;
    }

    setStatus("connecting");
    console.log("[Voice] start() called, sessionId:", sessionId);
    try {
      // Request mic permission early so the browser dialog appears before the
      // ElevenLabs WebSocket handshake. Release the tracks immediately — the
      // SDK creates its own stream internally; holding this one causes conflicts.
      console.log("[Voice] requesting mic permission...");
      const permStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permStream.getTracks().forEach((t) => t.stop());
      console.log("[Voice] mic permission granted, fetching signed URL...");

      // Parallel-fetch signed URL + persona before opening the WebSocket so
      // the system prompt is injected at handshake time. Persona only —
      // memories are retrieved per-turn by the search_memory client tool.
      const [urlRes, contextRes] = await Promise.all([
        fetch("/api/voice/signed-url"),
        fetch(`/api/voice/context?session_id=${sessionId}`),
      ]);
      if (!urlRes.ok) {
        throw new Error(`Failed to get signed URL: ${urlRes.status}`);
      }
      const { signedUrl } = await urlRes.json();
      const contextData = contextRes.ok ? await contextRes.json() : null;
      console.log("[Voice] contextData:", {
        hasContext: !!contextData?.context,
        contextLength: contextData?.context?.length ?? 0,
        contextPreview: contextData?.context?.slice(0, 120),
      });
      console.log("[Voice] signed URL + persona obtained, starting ElevenLabs session...");

      const conv = await Conversation.startSession({
        signedUrl,
        // Inject the persona as a system-prompt override sent in the first
        // WebSocket handshake message, before the agent speaks.
        overrides: {
          ...(contextData?.context
            ? { agent: { prompt: { prompt: contextData.context } } }
            : {}),
          ...(voiceId && process.env.NEXT_PUBLIC_ELEVENLABS_ALLOW_VOICE_OVERRIDE === "true"
            ? { tts: { voiceId } }
            : {}),
        },
        dynamicVariables: { session_id: sessionId },
        clientTools: {
          // Per-turn mem0 retrieval. The ElevenLabs agent calls this on every
          // user turn (dashboard tool config: `search_memory` with a `query`
          // param of value type "LLM Prompt" and Wait-for-response ON), passing
          // what the user just said. The agent blocks until this returns, so
          // the memories land in the SAME turn's reply.
          search_memory: async ({ query }: { query?: string } = {}) => {
            console.log("[Voice] search_memory called, query:", query?.slice(0, 60));
            if (!query?.trim()) return "No relevant memories.";
            // Hard client-side deadline. Must sit below the ElevenLabs tool
            // Response timeout (set to 3 s in the dashboard) and above the
            // server-side mem0 cap (2 s), leaving room for the round-trip.
            const controller = new AbortController();
            const deadline = setTimeout(() => controller.abort(), 2500);
            try {
              const res = await fetch(
                `/api/voice/memory-search?query=${encodeURIComponent(query)}`,
                { signal: controller.signal },
              );
              if (!res.ok) return "No relevant memories.";
              const { text } = await res.json();
              return text || "No relevant memories.";
            } catch (e) {
              if (e instanceof Error && e.name === "AbortError") {
                console.warn("[Voice] search_memory aborted — took >750 ms");
              } else {
                console.error("[Voice] search_memory network error:", e);
              }
              return "No relevant memories.";
            } finally {
              clearTimeout(deadline);
            }
          },
        },
        // Fires if ElevenLabs sends a tool_name that has no matching key in
        // clientTools. Logs the exact name so we can detect mismatches.
        onUnhandledClientToolCall: (call) => {
          console.error("[Voice] UNHANDLED tool call — name mismatch?", call);
        },
        onConnect: ({ conversationId }) => {
          console.log("[Voice] connected, conversationId:", conversationId);
          setStatus("connected");
        },
        onDisconnect: (details) => {
          console.log("[Voice] disconnected:", details);
          onSpeakingChange(false);
          setStatus("idle");
          convRef.current = null;
        },
        onError: (msg, ctx) => {
          console.error("[Voice] error:", msg, ctx);
          toast.error(`Voice error: ${msg}`);
          onSpeakingChange(false);
          setStatus("idle");
          convRef.current = null;
        },
        onMessage: ({ message, source }) => {
          console.log("[ElevenLabs onMessage]", source, message?.slice(0, 80));
          onMessage(message, source);
        },
        onModeChange: ({ mode }) => {
          console.log("[ElevenLabs onModeChange]", mode);
          onSpeakingChange(mode === "speaking");
        },
        onDebug: (msg) => {
          console.log("[ElevenLabs debug]", JSON.stringify(msg)?.slice(0, 120));
        },
      });

      console.log("[Voice] session started successfully");
      convRef.current = conv;

      // Send the prior in-session text/voice transcript as a contextual update
      // so voice continuity picks up exactly where text left off. The persona +
      // mem0 context is already injected via overrides.agent.prompt.prompt above;
      // this only adds the in-session conversation history.
      if (messages && messages.length > 0 && convRef.current) {
        const transcript = messages
          .flatMap((m) =>
            m.parts
              .filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => `${m.role === "assistant" ? "Companion" : "User"}: ${p.text}`),
          )
          .join("\n");
        if (transcript) {
          console.log("[Voice] injecting session transcript via sendContextualUpdate, turns:", messages.length);
          convRef.current.sendContextualUpdate(
            `[Earlier in this session — continue naturally without re-introducing yourself]:\n${transcript}`,
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[Voice] startSession failed:", msg, err);
      if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied")) {
        toast.error("Microphone access needed — check browser permissions");
      } else {
        toast.error(`Voice failed: ${msg.slice(0, 80)}`);
      }
      setStatus("idle");
    }
  }, [sessionId, voiceId, messages, onMessage, onSpeakingChange]);

  const stop = useCallback(async () => {
    if (!convRef.current) return;
    setStatus("disconnecting");
    try {
      await convRef.current.endSession();
    } catch {
      // onDisconnect will still fire and reset state.
    }
  }, []);

  // Idle
  if (status === "idle") {
    return (
      <button
        type="button"
        onClick={start}
        disabled={disabled || !sessionId}
        aria-label="Start voice conversation"
        className="shrink-0 size-11 rounded-xl border border-input hover:bg-muted/40 flex items-center justify-center text-muted-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <AudioLines className="size-4" />
      </button>
    );
  }

  // Connecting
  if (status === "connecting") {
    return (
      <button
        type="button"
        disabled
        aria-label="Connecting…"
        className="shrink-0 size-11 rounded-xl border border-input bg-muted/40 flex items-center justify-center text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin" />
      </button>
    );
  }

  // Disconnecting
  if (status === "disconnecting") {
    return (
      <button
        type="button"
        disabled
        aria-label="Ending session…"
        className="shrink-0 size-11 rounded-xl border border-input bg-muted/40 flex items-center justify-center text-muted-foreground"
      >
        <MicOff className="size-4 animate-pulse" />
      </button>
    );
  }

  // Connected — show stop button
  return (
    <button
      type="button"
      onClick={stop}
      aria-label="End voice conversation"
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
      <Square className="size-3 fill-current" />
      <span className="text-sm font-medium">End</span>
    </button>
  );
}
