import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../api/cliente';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatearFecha, formatearDinero } from '@/lib/formato';
import { ArrowLeft, Plus, Pencil, UserX, UserCheck, ChevronRight, Loader2Icon, CalendarX } from 'lucide-react';

const HOY = new Date().toISOString().slice(0, 10);

function badgeEstado(estado) {
  const clases = {
    'Sin vencer': 'bg-secondary text-secondary-foreground',
    Pendiente: 'bg-warning text-warning-foreground',
    Disfrutado: 'bg-success text-success-foreground',
    Anticipadas: 'bg-accent text-accent-foreground',
  };
  return clases[estado] || 'bg-secondary text-secondary-foreground';
}

function FormularioEditarTrabajador({ trabajador, onGuardar }) {
  const [datos, setDatos] = useState({
    cedula: trabajador.cedula,
    nombre: trabajador.nombre,
    fecha_ingreso: trabajador.fecha_ingreso,
    firmado: trabajador.firmado || 'No',
    salario: trabajador.salario ?? '',
  });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  function actualizar(campo, valor) {
    setDatos((d) => ({ ...d, [campo]: valor }));
  }

  async function enviar(e) {
    e.preventDefault();
    if (datos.fecha_ingreso > HOY) {
      setError('La fecha de ingreso no puede ser posterior a hoy');
      return;
    }
    setError('');
    setCargando(true);
    try {
      await onGuardar({ ...datos, salario: Number(datos.salario) || null });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Cédula">
          <Input value={datos.cedula} onChange={(e) => actualizar('cedula', e.target.value)} required autoFocus />
        </Field>
        <Field label="Nombre">
          <Input value={datos.nombre} onChange={(e) => actualizar('nombre', e.target.value)} required />
        </Field>
        <Field label="Fecha de ingreso">
          <Input
            type="date"
            max={HOY}
            value={datos.fecha_ingreso}
            onChange={(e) => actualizar('fecha_ingreso', e.target.value)}
            required
          />
        </Field>
        <Field label="Firmado">
          <select
            value={datos.firmado}
            onChange={(e) => actualizar('firmado', e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="No">No</option>
            <option value="Si">Sí</option>
          </select>
        </Field>
        <Field label="Salario" className="col-span-2">
          <Input value={datos.salario} onChange={(e) => actualizar('salario', e.target.value)} />
        </Field>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={cargando} className="self-start">
        {cargando ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            Guardando...
          </>
        ) : (
          'Guardar cambios'
        )}
      </Button>
    </form>
  );
}

function FormularioNuevoPeriodo({ onGuardar }) {
  const [fecha, setFecha] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    if (!fecha) return;
    setError('');
    setCargando(true);
    try {
      await onGuardar(fecha);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <Field label="Fecha de causación del periodo">
        <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required autoFocus />
      </Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={cargando} className="self-start">
        {cargando ? <Loader2Icon className="size-4 animate-spin" /> : 'Guardar'}
      </Button>
    </form>
  );
}

export default function FichaTrabajador() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [trabajador, setTrabajador] = useState(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [dialogoEditar, setDialogoEditar] = useState(false);
  const [dialogoNuevoPeriodo, setDialogoNuevoPeriodo] = useState(false);
  const [dialogoActivo, setDialogoActivo] = useState(false);
  const [procesandoActivo, setProcesandoActivo] = useState(false);

  function recargar() {
    setErrorCarga('');
    api.obtenerTrabajador(id).then(setTrabajador).catch((err) => setErrorCarga(err.message));
  }
  useEffect(recargar, [id]);

  async function guardarEdicion(datos) {
    await api.actualizarTrabajador(id, datos);
    setDialogoEditar(false);
    recargar();
    toast.success('Datos guardados');
  }

  async function confirmarAlternarActivo() {
    setProcesandoActivo(true);
    try {
      if (trabajador.activo) {
        await api.eliminarTrabajador(id);
        toast.success('Trabajador desactivado');
        setDialogoActivo(false);
        navegar('/');
      } else {
        await api.activarTrabajador(id);
        toast.success('Trabajador reactivado');
        setDialogoActivo(false);
        recargar();
      }
    } finally {
      setProcesandoActivo(false);
    }
  }

  async function crearPeriodo(fecha) {
    await api.crearPeriodo({ trabajador_id: id, periodo_pago_inicio: fecha });
    setDialogoNuevoPeriodo(false);
    recargar();
    toast.success('Periodo creado');
  }

  if (errorCarga) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <p className="text-sm text-destructive">Error: {errorCarga}</p>
      </div>
    );
  }

  if (!trabajador) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Skeleton className="mb-4 h-6 w-40" />
        <Skeleton className="mb-6 h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver al listado
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">{trabajador.nombre}</h1>
        <p className="tabular-nums text-sm text-muted-foreground">{trabajador.cedula}</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Ingreso</p>
          <p className="text-sm text-foreground">{formatearFecha(trabajador.fecha_ingreso)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Firmado</p>
          <p className="text-sm text-foreground">{trabajador.firmado || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Salario</p>
          <p className="tabular-nums text-sm text-foreground">{formatearDinero(trabajador.salario)}</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button onClick={() => setDialogoNuevoPeriodo(true)}>
          <Plus className="size-4" />
          Nuevo periodo
        </Button>
        <Button variant="outline" onClick={() => setDialogoEditar(true)}>
          <Pencil className="size-4" />
          Editar datos
        </Button>
        <Button
          variant="ghost"
          className="ml-auto text-muted-foreground hover:text-destructive"
          onClick={() => setDialogoActivo(true)}
        >
          {trabajador.activo ? (
            <>
              <UserX className="size-4" />
              Desactivar trabajador
            </>
          ) : (
            <>
              <UserCheck className="size-4" />
              Activar trabajador
            </>
          )}
        </Button>
      </div>

      <h2 className="mb-2 text-sm font-medium text-foreground">Periodos</h2>
      {trabajador.periodos.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title="Sin periodos"
          description="Este trabajador todavía no tiene periodos de vacaciones registrados."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Periodo</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium">Pendientes</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {trabajador.periodos.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navegar(`/periodos/${p.id}`)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navegar(`/periodos/${p.id}`)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver detalle del periodo ${formatearFecha(p.periodo_pago_inicio)}`}
                  className="group cursor-pointer border-t border-border transition-colors duration-150 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <td className="px-4 py-3 text-foreground">
                    {formatearFecha(p.periodo_pago_inicio)} – {formatearFecha(p.periodo_pago_fin)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={badgeEstado(p.estado)}>{p.estado}</Badge>
                  </td>
                  <td className="tabular-nums px-4 py-3 text-muted-foreground">{p.dias_pendientes}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    <span className="inline-flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      Ver detalle <ChevronRight className="size-3.5" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogoEditar} onOpenChange={setDialogoEditar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar datos del trabajador</DialogTitle>
          </DialogHeader>
          <FormularioEditarTrabajador trabajador={trabajador} onGuardar={guardarEdicion} />
        </DialogContent>
      </Dialog>

      <Dialog open={dialogoNuevoPeriodo} onOpenChange={setDialogoNuevoPeriodo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo periodo</DialogTitle>
            <DialogDescription>Se generan 15 días y vence en 1 año si no se disfruta.</DialogDescription>
          </DialogHeader>
          <FormularioNuevoPeriodo onGuardar={crearPeriodo} />
        </DialogContent>
      </Dialog>

      <Dialog open={dialogoActivo} onOpenChange={setDialogoActivo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{trabajador.activo ? '¿Desactivar trabajador?' : '¿Reactivar trabajador?'}</DialogTitle>
            <DialogDescription>
              {trabajador.activo
                ? 'Sus periodos y datos se conservan; solo deja de aparecer en el listado de activos.'
                : 'Volverá a aparecer en el listado de activos.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoActivo(false)} disabled={procesandoActivo}>
              Cancelar
            </Button>
            <Button
              variant={trabajador.activo ? 'destructive' : 'default'}
              onClick={confirmarAlternarActivo}
              disabled={procesandoActivo}
            >
              {procesandoActivo ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : trabajador.activo ? (
                'Desactivar'
              ) : (
                'Activar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}