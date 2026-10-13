import React from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import FormularioCambiarPassword from '@/componentes/FormularioCambiarPassword';
import { ShieldAlert } from 'lucide-react';

// Pantalla completa que reemplaza a la app mientras la contraseña sea la de fábrica
// o una temporal de emergencia. No tiene botón de cerrar: solo se sale cambiándola
// o cerrando sesión.
export default function CambioPasswordObligatorio({ onCambiada, onLogout }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-[400px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <ShieldAlert className="size-5 text-warning-foreground" />
            Elige una contraseña nueva
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Por seguridad, antes de continuar debes reemplazar la contraseña actual (de fábrica o temporal)
            por una tuya.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <FormularioCambiarPassword
            onCambiada={() => {
              toast.success('Contraseña actualizada');
              onCambiada();
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground"
            onClick={onLogout}
          >
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}