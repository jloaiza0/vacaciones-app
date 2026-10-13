import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import FormularioCambiarPassword from '@/componentes/FormularioCambiarPassword';
import { CalendarDays, KeyRound, LogOut } from 'lucide-react';

export default function BarraSuperior({ onLogout }) {
  const navegar = useNavigate();
  const [dialogoPassword, setDialogoPassword] = useState(false);

  async function manejarLogout() {
    await onLogout();
    navegar('/login');
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-semibold text-foreground transition-colors duration-150 hover:text-foreground/70"
        >
          <CalendarDays className="size-4" />
          Gestión de vacaciones
        </Link>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Cambiar contraseña"
            onClick={() => setDialogoPassword(true)}
          >
            <KeyRound className="size-4" />
            <span className="hidden sm:inline">Cambiar contraseña</span>
          </Button>
          <Button variant="ghost" size="sm" aria-label="Cerrar sesión" onClick={manejarLogout}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </Button>
        </div>
      </div>

      <Dialog open={dialogoPassword} onOpenChange={setDialogoPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
            <DialogDescription>Al cambiarla, las demás sesiones abiertas se cerrarán.</DialogDescription>
          </DialogHeader>
          <FormularioCambiarPassword
            onCambiada={() => {
              setDialogoPassword(false);
              toast.success('Contraseña actualizada');
            }}
          />
        </DialogContent>
      </Dialog>
    </header>
  );
}