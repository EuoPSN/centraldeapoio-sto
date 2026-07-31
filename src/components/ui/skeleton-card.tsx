import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
  lines?: number;
}

export function SkeletonCard({ className, lines = 3 }: SkeletonCardProps) {
  return (
    <div
      className={cn("rounded-xl border bg-card p-6 shadow animate-pulse", className)}
      aria-hidden="true"
    >
      <div className="h-5 w-1/3 rounded bg-muted" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3.5 rounded bg-muted"
            style={{ width: `${100 - i * 12}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export default SkeletonCard;
