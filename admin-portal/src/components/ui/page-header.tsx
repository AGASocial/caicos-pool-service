import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Page-level title and description.
 *
 * Use at the top of every page (under the navbar). This is the single source
 * of truth for page header styling — do not inline a different title/description
 * class string anywhere else. The title is theme-aware via `text-foreground`
 * (which maps to a high-contrast token in both light and dark modes).
 */
interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional slot rendered to the right of the title (e.g. primary action button). */
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {description != null && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions != null && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
