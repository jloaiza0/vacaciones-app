import * as React from "react";
import { cn } from "@/lib/utils";

// Fila de un registro (toma, SC, LNR) mostrada en columnas: cada "field" es
// una etiqueta chiquita arriba y el valor abajo, en vez de texto corrido.
// `actions` son los botones de Editar/Eliminar, alineados a la derecha.
function DataRow({ fields, actions, className }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-card px-4 py-3",
        className
      )}
    >
      <div className="flex flex-1 flex-wrap gap-x-6 gap-y-2">
        {fields.map((f, i) => (
          <div key={i} className="flex flex-col gap-0.5 min-w-[88px]">
            <span className="text-xs text-muted-foreground">{f.label}</span>
            <span className={cn("text-sm text-foreground", f.tabular && "tabular-nums")}>{f.value}</span>
          </div>
        ))}
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  );
}

export { DataRow };