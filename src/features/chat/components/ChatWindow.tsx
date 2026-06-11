"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";

import { useChatSession } from "@/features/chat/hooks/useChatSession";
import { MessageBubble } from "./MessageBubble";
import { VoiceModeButton } from "./VoiceModeButton";
import { PersonaSwitcher } from "./PersonaSwitcher";
import type { PersonaRow } from "@/features/chat/actions";

interface Props {
  personaName: string;
  personaArchetype: string;
  activePersonaId: string;
  personas: PersonaRow[];
  initialMessages: UIMessage[];
}


export function ChatWindow({
  personaName,
  personaArchetype,
  activePersonaId,
  personas,
  initialMessages,
}: Props) {
  const { messages, setMessages, sendMessage, status, error, sessionError, isReady, sessionId, voiceId } =
    useChatSession({ initialMessages });

  const [input, setInput] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceIdxRef = useRef(0);
  // Buffers the latest user utterance until the AI responds so we can save the pair.
  const pendingVoiceUserRef = useRef<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Flush any buffered user turn on page unload.
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!sessionId || !pendingVoiceUserRef.current) return;
      navigator.sendBeacon(
        "/api/voice/save-turns",
        new Blob(
          [JSON.stringify({ sessionId, turns: [{ role: "user", content: pendingVoiceUserRef.current }] })],
          { type: "application/json" },
        ),
      );
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [sessionId]);

  const isStreaming = status === "submitted" || status === "streaming";

  // Voice messages are injected directly into the shared `messages` state so
  // that voice and text turns appear in a single chronological list. This also
  // means subsequent text-chat turns send full conversation context (including
  // voice turns) to the LLM.
  const handleVoiceMessage = useCallback((text: string, source: "user" | "ai") => {
    const idx = voiceIdxRef.current++;
    const newMessage: UIMessage = {
      id: `voice-${source}-${idx}-${Date.now()}`,
      role: source === "ai" ? "assistant" : "user",
      parts: [{ type: "text" as const, text }],
      metadata: {},
    };
    setMessages((prev) => [...prev, newMessage]);

    // Persist pair to Supabase + mem0.
    if (source === "user") {
      pendingVoiceUserRef.current = text;
    } else if (source === "ai" && pendingVoiceUserRef.current && sessionId) {
      const userText = pendingVoiceUserRef.current;
      pendingVoiceUserRef.current = null;
      fetch("/api/voice/save-turns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          turns: [
            { role: "user", content: userText },
            { role: "assistant", content: text },
          ],
        }),
      }).catch(() => {
        console.warn("[ChatWindow] Failed to save voice turns");
      });
    }
  }, [sessionId, setMessages]);

  const submit = () => {
    const text = input.trim();
    if (!text || !isReady || isStreaming) return;
    sendMessage(text);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
  };

  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const handlePersonaSwitch = useCallback((name: string) => {
    setSwitchingTo(name);
  }, []);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Header ── */}
      <header className="shrink-0 border-b border-border px-4 py-3 flex items-center gap-3 bg-card/80 backdrop-blur-sm">
        <div className="relative shrink-0">
          <div className="size-10 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-semibold text-base">
            {personaName[0]}
          </div>
          <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-400 ring-2 ring-card" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight truncate">
            {personaName}
          </p>
          <p className="text-xs text-muted-foreground/80 leading-tight truncate">
            {isSpeaking ? (
              <span className="text-emerald-500/80">Speaking…</span>
            ) : (
              <>{personaArchetype} · Here for you</>
            )}
          </p>
        </div>
        <PersonaSwitcher
          personas={personas}
          activePersonaId={activePersonaId}
          sessionId={sessionId}
          onSwitch={handlePersonaSwitch}
        />
      </header>

      {/* ── Message list ── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {sessionError && (
          <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive text-center">
            {sessionError}
          </div>
        )}

        {!sessionError && messages.length === 0 && (
          <div className="flex items-center justify-center h-full pb-16">
            {switchingTo ? (
              <p className="text-sm text-muted-foreground animate-pulse">
                Starting fresh with {switchingTo}…
              </p>
            ) : (
              <div className="text-center space-y-4 max-w-xs px-4">
                <div className="size-16 mx-auto rounded-full bg-accent flex items-center justify-center text-accent-foreground text-2xl font-semibold">
                  {personaName[0]}
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-foreground">
                    {personaName} is here
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    This is a safe space to say anything on your mind. No judgment, no advice unless you want it.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground/60 italic">
                  How are you feeling right now?
                </p>
              </div>
            )}
          </div>
        )}

        {messages.map((msg: UIMessage) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            personaInitial={personaName[0]}
          />
        ))}

        {isStreaming && (
          <div className="flex items-end gap-2.5">
            <div className="size-7 shrink-0 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-xs font-semibold">
              {personaName[0]}
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-muted/60 px-4 py-3">
              <span className="flex gap-1">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="size-2 rounded-full bg-muted-foreground/50 animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-center text-xs text-destructive">
            Something went wrong. Please try again.
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="shrink-0 border-t border-border bg-card/80 backdrop-blur-sm px-4 pt-3 pb-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            placeholder={`Message ${personaName}…`}
            disabled={!isReady || isStreaming}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[42px] max-h-32 disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button
            type="button"
            onClick={submit}
            disabled={!isReady || isStreaming || !input.trim()}
            className="shrink-0 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors h-11"
          >
            Send
          </button>
          <VoiceModeButton
            sessionId={sessionId}
            voiceId={voiceId}
            disabled={!isReady}
            messages={messages}
            onMessage={handleVoiceMessage}
            onSpeakingChange={setIsSpeaking}
          />
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground/70">
          Not a therapist. In crisis? Call or text{" "}
          <a href="tel:988" className="underline underline-offset-2">
            988
          </a>
          .
        </p>
      </div>
    </div>
  );
}
