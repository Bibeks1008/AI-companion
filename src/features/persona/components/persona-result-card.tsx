import { Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PersonaResultView } from "@/features/persona/queries";

export function PersonaResultCard({ result }: { result: PersonaResultView }) {
  const { persona, reasoning, confidence, emotions, isFallback } = result;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="items-center text-center">
        <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Sparkles className="size-6" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Meet your companion
        </p>
        <CardTitle className="text-2xl">{persona.name}</CardTitle>
        <CardDescription>{persona.archetype}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {isFallback && (
          <p className="rounded-lg bg-accent px-4 py-3 text-center text-sm text-accent-foreground">
            We&apos;ve started you with The Gentle Listener — a calm,
            non-judgmental presence. You can explore other companions later.
          </p>
        )}

        <p className="text-center text-pretty text-muted-foreground">
          {persona.description}
        </p>

        <div className="rounded-xl bg-muted/60 px-4 py-3.5">
          <p className="text-sm font-medium">Why this fits you</p>
          <p className="mt-1 text-pretty text-sm text-muted-foreground">
            {reasoning}
          </p>
        </div>

        {emotions.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">What we noticed</p>
            <div className="flex flex-wrap gap-2">
              {emotions.map((e) => (
                <span
                  key={e.name}
                  className="rounded-full bg-secondary px-3 py-1 text-xs font-medium capitalize text-secondary-foreground"
                >
                  {e.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Match confidence: {confidence}%
        </p>
      </CardContent>
    </Card>
  );
}
