import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";

export function WelcomeStep({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Heart className="size-7" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">
        Let&apos;s find your companion
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-balance text-muted-foreground">
        A few gentle questions help us match you with the companion who fits how
        you&apos;re feeling right now. It takes about two minutes, and there are
        no wrong answers.
      </p>
      <Button size="lg" className="mt-8 w-full" onClick={onBegin}>
        Begin
      </Button>
    </div>
  );
}
