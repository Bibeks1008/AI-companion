import { Progress } from "@/components/ui/progress";

/**
 * Step progress for the questionnaire. `current` and `total` are 1-based step
 * counts (the welcome screen is excluded).
 */
export function ProgressIndicator({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const value = Math.round((current / total) * 100);

  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Step {current} of {total}
        </span>
        <span>{value}%</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}
