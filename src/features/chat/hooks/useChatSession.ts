"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";

import { startSession, endSession } from "@/features/chat/actions";

interface Options {
  initialMessages: UIMessage[];
}

/**
 * Manages session lifecycle on top of the AI SDK v6 useChat hook.
 *
 * On mount: calls startSession() (idempotent — returns existing open session).
 * On unmount: calls endSession() to record ended_at.
 *
 * sessionIdRef provides the session ID lazily to the HttpChatTransport body
 * so it's resolved at send-time, not at hook init time when sessionId is null.
 */
export function useChatSession({ initialMessages }: Options) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    startSession().then((result) => {
      if ("error" in result) {
        if (mounted) setSessionError(result.error);
        return;
      }
      const id = result.sessionId;
      sessionIdRef.current = id;
      if (mounted) {
        setSessionId(id);
        setVoiceId(result.voiceId);
      } else {
        // Unmounted before session resolved — end it immediately.
        endSession(id);
      }
    });

    // sendBeacon guarantees delivery on tab/window close, unlike the server
    // action fetch which the browser aborts when the page is killed.
    const handleBeforeUnload = () => {
      if (sessionIdRef.current) {
        navigator.sendBeacon(
          "/api/session/end",
          new Blob(
            [JSON.stringify({ sessionId: sessionIdRef.current })],
            { type: "application/json" },
          ),
        );
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      mounted = false;
      if (sessionIdRef.current) {
        endSession(sessionIdRef.current);
      }
    };
  }, []);

  const getBody = useCallback(() => ({ sessionId: sessionIdRef.current }), []);

  // Stable transport — recreating it on every render would reset the AI SDK state.
  const transport = useMemo(
    // eslint-disable-next-line react-hooks/refs -- body() runs at send-time, not during render
    () => new DefaultChatTransport({ api: "/api/chat", body: getBody }),
    [getBody]
  );

  const chat = useChat({ transport, messages: initialMessages });

  // Wrap sendMessage to guard against submitting before session is ready.
  const sendMessage = (text: string) => {
    if (!sessionId || !text.trim()) return;
    chat.sendMessage({ text });
  };

  return {
    messages: chat.messages,
    setMessages: chat.setMessages,
    status: chat.status,
    error: chat.error,
    stop: chat.stop,
    sendMessage,
    sessionId,
    voiceId,
    sessionError,
    isReady: !!sessionId,
  };
}
