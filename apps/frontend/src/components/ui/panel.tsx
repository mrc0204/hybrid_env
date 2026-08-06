import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("panel flex flex-col overflow-hidden", className)} {...props} />;
}

interface PanelHeaderProps {
  label: string;
  detail?: ReactNode;
  className?: string;
}

/**
 * Region titles are set as micro uppercase labels rather than headings: they
 * identify a region without competing with its content for attention.
 */
export function PanelHeader({ label, detail, className }: PanelHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between px-5 pb-3 pt-4", className)}>
      <span className="eyebrow">{label}</span>
      {detail ? <div className="flex items-center gap-2">{detail}</div> : null}
    </div>
  );
}
