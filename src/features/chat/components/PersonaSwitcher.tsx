"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Check } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { switchPersona, type PersonaRow } from "@/features/chat/actions";

interface Props {
  personas: PersonaRow[];
  activePersonaId: string;
  sessionId: string | null;
  onSwitch: (name: string) => void;
}

export function PersonaSwitcher({ personas, activePersonaId, sessionId, onSwitch }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSelect = (persona: PersonaRow) => {
    if (persona.id === activePersonaId || isPending) return;

    startTransition(async () => {
      const result = await switchPersona(persona.id);
      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }
      onSwitch(persona.name);
      // router.refresh() triggers ChatWindow unmount → useChatSession cleanup → endSession,
      // then remount → useChatSession init → startSession with new active persona.
      router.refresh();
    });
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Switch companion"
          className="shrink-0 size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <ArrowLeftRight className="size-4" />
        </button>
      </SheetTrigger>

      <SheetContent side="bottom" className="rounded-t-2xl px-0 pb-8 max-h-[85dvh] overflow-y-auto">
        <SheetHeader className="px-6 pb-4 border-b border-border">
          <SheetTitle className="text-base">Switch Companion</SheetTitle>
        </SheetHeader>

        <div className="px-4 pt-3 space-y-2">
          {personas.map((p) => {
            const isActive = p.id === activePersonaId;
            return (
              <button
                key={p.id}
                type="button"
                disabled={isPending}
                onClick={() => handleSelect(p)}
                className={[
                  "w-full text-left rounded-xl px-4 py-3.5 flex items-start gap-3 transition-colors",
                  isActive
                    ? "bg-accent border border-accent-foreground/10"
                    : "bg-card hover:bg-muted/50 border border-transparent",
                  isPending && !isActive ? "opacity-50 cursor-not-allowed" : "",
                ].join(" ")}
              >
                <div className="size-9 shrink-0 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-semibold text-sm mt-0.5">
                  {p.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold leading-tight">{p.name}</span>
                    {isActive && <Check className="size-3.5 text-emerald-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                    {p.archetype}
                  </p>
                  {p.best_for && (
                    <p className="text-xs text-muted-foreground/70 leading-snug mt-1">
                      Best for: {p.best_for}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
