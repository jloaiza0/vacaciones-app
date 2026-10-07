import * as React from "react";
import { cn } from "@/lib/utils";

// Estado vacío consistente para tablas/listas sin resultados.
function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-12 text-center",
        className
      )}
    >
      {Icon && <Icon className="size-8 text-muted-foreground" strokeWidth={1.5} />}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export { EmptyState };