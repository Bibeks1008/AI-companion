"use client";

import ReactMarkdown from "react-markdown";
import type { UIMessage } from "ai";

interface Props {
  message: UIMessage;
  personaInitial: string;
}

function extractText(message: UIMessage): string {
  return (
    message.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") ?? ""
  );
}

export function MessageBubble({ message, personaInitial }: Props) {
  const isUser = message.role === "user";
  const text = extractText(message);

  if (isUser) {
    return (
      <div className="flex justify-end animate-in fade-in slide-in-from-bottom-1 duration-200">
        <div className="max-w-[70%]">
          <div className="rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground leading-relaxed">
            {text}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 animate-in fade-in duration-300">
      <div className="size-7 flex-shrink-0 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-xs font-semibold mt-0.5">
        {personaInitial}
      </div>
      <div className="max-w-[85%] text-sm leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:pl-4 [&_ul]:list-disc [&_ol]:pl-4 [&_ol]:list-decimal [&_strong]:font-semibold">
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    </div>
  );
}
