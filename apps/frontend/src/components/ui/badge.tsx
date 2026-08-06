import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-micro uppercase transition-colors",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface text-ink-muted",
        cognition: "border-cognition/25 bg-cognition/10 text-cognition",
        low: "border-severity-low/25 bg-severity-low/10 text-severity-low",
        medium: "border-severity-medium/25 bg-severity-medium/10 text-severity-medium",
        high: "border-severity-high/25 bg-severity-high/10 text-severity-high",
        critical: "border-severity-critical/25 bg-severity-critical/10 text-severity-critical",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
