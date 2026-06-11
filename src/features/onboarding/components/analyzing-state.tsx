import { Loader2 } from "lucide-react";

export function AnalyzingState() {
  return (
    <div className="py-10 text-center">
      <Loader2 className="mx-auto size-8 animate-spin text-primary" />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">
        Finding your companion
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-balance text-muted-foreground">
        We&apos;re reflecting on your answers to match you with the right
        presence. This only takes a moment.
      </p>
    </div>
  );
}
