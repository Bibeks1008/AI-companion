import { cn } from "@/lib/utils";

/**
 * Calm, centered page container used across the onboarding experience.
 * Mobile-first: full-width with comfortable padding, capped on larger screens.
 */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-10">
      <div className={cn("w-full max-w-md", className)}>{children}</div>
    </main>
  );
}
