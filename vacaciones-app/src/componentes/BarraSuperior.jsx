import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../api/cliente';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import FormularioCambiarPassword from '@/componentes/FormularioCambiarPassword';
import { cn } from '@/lib/utils';
import { CalendarDays, DatabaseBackup, KeyRound, Loader2Icon, LogOut } from 'lucide-react';

// "hoy 8:03 a. m.", "ayer 8:03 p. m." o "11 oct"
function describirMomento(iso) {
  if (!iso) return 'sin respaldos';
  const fecha = new Date(iso);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  const hora = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' }).format(fecha);
  if (fecha.toDateString() === hoy.toDateString()) return `hoy ${hora}`;
  if (fecha.toDateString() === ayer.toDateString()) return `ayer ${hora}`;
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(fecha).replace('.', '');
}

// Convierte lo que responde el servidor en lo que se muestra: un texto corto, un detalle
// para el cursor encima y si hay algo que merezca atención.
function evaluarRespaldo(estado) {
  if (!estado) return null;
  const { local, externa } = estado;

  const problemas = [];
  if (local.error) problemas.push(`Error al respaldar: ${local.error}`);
  else if (local.atrasado) {
    problemas.push(local.ultimoRespaldo ? 'El último respaldo tiene más de 2 días' : 'Todavía no hay respaldos');
  }
  if (externa.configurada) {
    if (externa.error) problemas.push(`Copia externa con error: ${externa.error}`);
    else if (externa.atrasado) problemas.push('La copia externa está atrasada');
  }

  const datos = [];
  if (local.ultimoRespaldo) datos.push(`Último respaldo: ${describirMomento(local.ultimoRespaldo)}`);
  if (externa.configurada && externa.ultimoRespaldo) {
    datos.push(`Copia externa: ${describirMomento(externa.ultimoRespaldo)}`);
  }

  return {
    alerta: problemas.length > 0,
    texto: problemas.length > 0 ? 'Respaldo con problemas' : `Respaldo: ${describirMomento(local.ultimoRespaldo)}`,
    detalle: [...problemas, ...datos].join(' · '),
  };
}

export default function BarraSuperior({ onLogout }) {
  const navegar = useNavigate();
  const [dialogoPassword, setDialogoPassword] = useState(false);
  const [estadoRespaldo, setEstadoRespaldo] = useState(null);
  const [respaldando, setRespaldando] = useState(false);

  useEffect(() => {
    api.estadoRespaldos().then(setEstadoRespaldo).catch(() => {});
  }, []);

  async function manejarLogout() {
    await onLogout();
    navegar('/login');
  }

  async function respaldarAhora() {
    setRespaldando(true);
    try {
      const resultado = await api.respaldarAhora();
      setEstadoRespaldo(resultado.estado);
      if (resultado.externa.configurada && !resultado.externa.ok) {
        toast.warning(`Respaldo creado, pero falló la copia externa: ${resultado.externa.error}`);
      } else {
        toast.success('Respaldo creado');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRespaldando(false);
    }
  }

  const respaldo = evaluarRespaldo(estadoRespaldo);

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
          {respaldo && (
            <span
              title={respaldo.detalle}
              className={cn(
                'mr-2 hidden text-xs lg:inline',
                respaldo.alerta ? 'text-warning-foreground' : 'text-muted-foreground'
              )}
            >
              {respaldo.texto}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            aria-label="Respaldar ahora"
            title={respaldo ? respaldo.detalle : 'Respaldar ahora'}
            disabled={respaldando}
            onClick={respaldarAhora}
          >
            {respaldando ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <DatabaseBackup className={cn('size-4', respaldo?.alerta && 'text-warning-foreground')} />
            )}
            <span className="hidden md:inline">Respaldar ahora</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Cambiar contraseña"
            onClick={() => setDialogoPassword(true)}
          >
            <KeyRound className="size-4" />
            <span className="hidden md:inline">Cambiar contraseña</span>
          </Button>
          <Button variant="ghost" size="sm" aria-label="Cerrar sesión" onClick={manejarLogout}>
            <LogOut className="size-4" />
            <span className="hidden md:inline">Cerrar sesión</span>
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