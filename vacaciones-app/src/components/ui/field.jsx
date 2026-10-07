import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Agrupa label + input/select/lo-que-sea + mensaje de error, con el espaciado
// y tipografía consistentes en todos los formularios de la app.
function Field({ label, htmlFor, error, hint, className, children }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor} className="text-xs text-muted-foreground font-normal">
          {label}
        </Label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export { Field };