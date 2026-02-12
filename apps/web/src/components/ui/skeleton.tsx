import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-md bg-muted animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/5 to-muted bg-[length:200%_100%]',
        className,
      )}
      {...props}
    />
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-48" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-[300px] w-full" />
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonChart };
