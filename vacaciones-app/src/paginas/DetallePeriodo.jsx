import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../api/cliente';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { DataRow } from '@/components/ui/data-row';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatearFecha, formatearDinero, pluralDias } from '@/lib/formato';
import { ArrowLeft, Plus, Pencil, Trash2, Loader2Icon, CalendarOff } from 'lucide-react';

function badgeEstado(estado) {
  const clases = {
    'Sin vencer': 'bg-secondary text-secondary-foreground',
    Pendiente: 'bg-warning text-warning-foreground',
    Disfrutado: 'bg-success text-success-foreground',
    Anticipadas: 'bg-accent text-accent-foreground',
  };
  return clases[estado] || 'bg-secondary text-secondary-foreground';
}

// --- Formularios, todos dentro de un <Dialog> ---

function FormularioRango({ valoresIniciales, onGuardar }) {
  const [fecha_inicio, setInicio] = useState(valoresIniciales?.fecha_inicio || '');
  const [fecha_fin, setFin] = useState(valoresIniciales?.fecha_fin || '');
  const [dias, setDias] = useState(valoresIniciales?.dias ?? '');
  const [comentario, setComentario] = useState(valoresIniciales?.comentario || '');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    if (fecha_fin < fecha_inicio) {
      setError('La fecha fin no puede ser anterior a la fecha inicio');
      return;
    }
    setError('');
    setCargando(true);
    try {
      await onGuardar({ fecha_inicio, fecha_fin, dias: Number(dias), comentario });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Fecha inicio">
          <Input type="date" value={fecha_inicio} onChange={(e) => setInicio(e.target.value)} required autoFocus />
        </Field>
        <Field label="Fecha fin">
          <Input
            type="date"
            value={fecha_fin}
            min={fecha_inicio || undefined}
            onChange={(e) => setFin(e.target.value)}
            required
          />
        </Field>
      </div>
      <Field label="Días">
        <Input type="number" min="0" step="1" value={dias} onChange={(e) => setDias(e.target.value)} required />
      </Field>
      <Field label="Comentario">
        <Input value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Opcional" />
      </Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={cargando} className="self-start">
        {cargando ? <Loader2Icon className="size-4 animate-spin" /> : 'Guardar'}
      </Button>
    </form>
  );
}

function FormularioToma({ valoresIniciales, salario, onGuardar }) {
  const [fecha_inicio, setInicio] = useState(valoresIniciales?.fecha_inicio || '');
  const [fecha_fin, setFin] = useState(valoresIniciales?.fecha_fin || '');
  const [habilesDisfrutados, setHabilesDisfrutados] = useState(valoresIniciales?.habiles_disfrutados ?? '');
  const [habilesPagos, setHabilesPagos] = useState(valoresIniciales?.habiles_pagos ?? '');
  const [totalDiasDisfrutados, setTotalDiasDisfrutados] = useState(valoresIniciales?.total_dias_disfrutados ?? '');
  const [compensacion, setCompensacion] = useState(valoresIniciales?.compensacion_dinero ?? 0);
  const [comentario, setComentario] = useState(valoresIniciales?.comentario || '');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  function cambiarHabilesPagos(valor) {
    setHabilesPagos(valor);
    const numero = Number(valor) || 0;
    setCompensacion(numero > 0 && salario ? Math.round(((salario / 30) * numero + Number.EPSILON) * 100) / 100 : 0);
  }

  function soloPositivo(valor) {
    return valor === '' || (Number(valor) >= 0 && !isNaN(valor));
  }

  async function enviar(e) {
    e.preventDefault();
    if (fecha_fin < fecha_inicio) {
      setError('La fecha fin no puede ser anterior a la fecha inicio');
      return;
    }
    setError('');
    setCargando(true);
    try {
      await onGuardar({
        fecha_inicio,
        fecha_fin,
        habiles_disfrutados: Number(habilesDisfrutados) || 0,
        habiles_pagos: Number(habilesPagos) || 0,
        total_dias_disfrutados: Number(totalDiasDisfrutados) || 0,
        compensacion_dinero: Number(compensacion) || 0,
        comentario,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Fecha inicio">
          <Input type="date" value={fecha_inicio} onChange={(e) => setInicio(e.target.value)} required autoFocus />
        </Field>
        <Field label="Fecha fin">
          <Input
            type="date"
            value={fecha_fin}
            min={fecha_inicio || undefined}
            onChange={(e) => setFin(e.target.value)}
            required
          />
        </Field>
        <Field label="Hábiles disfrutados">
          <Input
            type="number"
            min="0"
            step="1"
            value={habilesDisfrutados}
            onChange={(e) => soloPositivo(e.target.value) && setHabilesDisfrutados(e.target.value)}
            required
          />
        </Field>
        <Field label="Hábiles pagos">
          <Input
            type="number"
            min="0"
            step="1"
            value={habilesPagos}
            onChange={(e) => soloPositivo(e.target.value) && cambiarHabilesPagos(e.target.value)}
            required
          />
        </Field>
        <Field label="Total días disfrutados" hint="Informativo">
          <Input
            type="number"
            min="0"
            step="1"
            value={totalDiasDisfrutados}
            onChange={(e) => soloPositivo(e.target.value) && setTotalDiasDisfrutados(e.target.value)}
          />
        </Field>
        <Field label="Compensación">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={compensacion}
            disabled={!(Number(habilesPagos) > 0)}
            onChange={(e) => soloPositivo(e.target.value) && setCompensacion(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Comentario">
        <Input value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Opcional" />
      </Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={cargando} className="self-start">
        {cargando ? <Loader2Icon className="size-4 animate-spin" /> : 'Guardar'}
      </Button>
    </form>
  );
}

function FormularioEditarPeriodo({ periodo, onGuardar }) {
  const [datos, setDatos] = useState({
    estado: periodo.estado,
    comentario: periodo.comentario || '',
    fecha_liquidacion: periodo.fecha_liquidacion || '',
  });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  function actualizar(campo, valor) {
    setDatos((d) => ({ ...d, [campo]: valor }));
  }

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await onGuardar(datos);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Estado">
          <select
            value={datos.estado}
            onChange={(e) => actualizar('estado', e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="Sin vencer">Sin vencer</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Disfrutado">Disfrutado</option>
            <option value="Anticipadas">Anticipadas</option>
          </select>
        </Field>
        <Field label="Fecha de liquidación">
          <div className="flex gap-2">
            <Input
              type="date"
              value={datos.fecha_liquidacion}
              onChange={(e) => actualizar('fecha_liquidacion', e.target.value)}
            />
            <Button type="button" variant="ghost" onClick={() => actualizar('fecha_liquidacion', '')}>
              Limpiar
            </Button>
          </div>
        </Field>
      </div>
      <Field label="Comentario">
        <Input
          value={datos.comentario}
          onChange={(e) => actualizar('comentario', e.target.value)}
          placeholder="Notas del periodo"
        />
      </Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={cargando} className="self-start">
        {cargando ? <Loader2Icon className="size-4 animate-spin" /> : 'Guardar cambios'}
      </Button>
    </form>
  );
}

// --- Sección reutilizable para tomas / SC / LNR ---

function SeccionRegistros({ titulo, items, vacioTexto, renderCampos, renderFormulario, onEliminarConfirmado }) {
  const [itemEditando, setItemEditando] = useState(null); // objeto item, o 'nuevo', o null
  const [aEliminar, setAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  async function confirmarEliminar() {
    setEliminando(true);
    try {
      await onEliminarConfirmado(aEliminar);
      setAEliminar(null);
      toast.success('Registro eliminado');
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">{titulo}</h2>
        <Button size="sm" variant="outline" onClick={() => setItemEditando('nuevo')}>
          <Plus className="size-4" />
          Agregar
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={CalendarOff} title={vacioTexto} />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <DataRow
              key={item.id}
              fields={renderCampos(item)}
              actions={
                <>
                  <Button size="sm" variant="ghost" onClick={() => setItemEditando(item)}>
                    <Pencil className="size-3.5" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setAEliminar(item.id)}
                  >
                    <Trash2 className="size-3.5" />
                    Eliminar
                  </Button>
                </>
              }
            />
          ))}
        </div>
      )}

      <Dialog open={itemEditando !== null} onOpenChange={(abierto) => !abierto && setItemEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{itemEditando === 'nuevo' ? `Agregar – ${titulo}` : `Editar – ${titulo}`}</DialogTitle>
          </DialogHeader>
          {itemEditando !== null &&
            renderFormulario(itemEditando === 'nuevo' ? null : itemEditando, () => setItemEditando(null))}
        </DialogContent>
      </Dialog>

      <Dialog open={aEliminar !== null} onOpenChange={(abierto) => !abierto && setAEliminar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar este registro?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAEliminar(null)} disabled={eliminando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarEliminar} disabled={eliminando}>
              {eliminando ? <Loader2Icon className="size-4 animate-spin" /> : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DetallePeriodo() {
  const { id } = useParams();
  const [periodo, setPeriodo] = useState(null);
  const [dialogoEditarPeriodo, setDialogoEditarPeriodo] = useState(false);

  function recargar() {
    api.obtenerPeriodo(id).then(setPeriodo);
  }
  useEffect(recargar, [id]);

  async function guardarEdicionPeriodo(datos) {
    await api.actualizarPeriodo(id, datos);
    setDialogoEditarPeriodo(false);
    recargar();
    toast.success('Periodo actualizado');
  }

  if (!periodo) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Skeleton className="mb-4 h-6 w-32" />
        <Skeleton className="mb-6 h-28 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link
        to={`/trabajadores/${periodo.trabajador_id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a la ficha
      </Link>

      <h1 className="mb-4 text-2xl font-semibold text-foreground">
        Periodo {formatearFecha(periodo.periodo_pago_inicio)} – {formatearFecha(periodo.periodo_pago_fin)}
      </h1>

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Días pendientes</p>
          <p className="tabular-nums text-3xl font-semibold text-foreground">{periodo.dias_pendientes}</p>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Estado</p>
          <Badge className={badgeEstado(periodo.estado)}>{periodo.estado}</Badge>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Fecha liquidación</p>
          <p className="text-sm text-foreground">{formatearFecha(periodo.fecha_liquidacion)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Comentario</p>
          <p className="text-sm text-foreground">{periodo.comentario || '—'}</p>
        </div>
      </div>
      <div className="mb-8">
        <Button variant="outline" size="sm" onClick={() => setDialogoEditarPeriodo(true)}>
          <Pencil className="size-3.5" />
          Editar periodo
        </Button>
      </div>

      <SeccionRegistros
        titulo="Tomas de vacaciones"
        items={periodo.tomas}
        vacioTexto="Sin tomas registradas"
        onEliminarConfirmado={async (tomaId) => {
          await api.eliminarToma(id, tomaId);
          recargar();
        }}
        renderCampos={(item) => [
          { label: 'Fecha inicio', value: formatearFecha(item.fecha_inicio) },
          { label: 'Fecha fin', value: formatearFecha(item.fecha_fin) },
          { label: 'Hábiles disfrutados', value: pluralDias(item.habiles_disfrutados), tabular: true },
          { label: 'Hábiles pagos', value: pluralDias(item.habiles_pagos), tabular: true },
          { label: 'Total días', value: pluralDias(item.total_dias_disfrutados), tabular: true },
          { label: 'Compensación', value: formatearDinero(item.compensacion_dinero), tabular: true },
          ...(item.comentario ? [{ label: 'Comentario', value: item.comentario }] : []),
        ]}
        renderFormulario={(item, cerrar) => (
          <FormularioToma
            valoresIniciales={item}
            salario={periodo.salario_trabajador}
            onGuardar={async (datos) => {
              if (item) await api.editarToma(id, item.id, datos);
              else await api.agregarToma(id, datos);
              cerrar();
              recargar();
              toast.success(item ? 'Toma actualizada' : 'Toma agregada');
            }}
          />
        )}
      />

      <SeccionRegistros
        titulo="Suspensiones de contrato"
        items={periodo.suspensiones}
        vacioTexto="Sin suspensiones registradas"
        onEliminarConfirmado={async (suspId) => {
          await api.eliminarSuspension(id, suspId);
          recargar();
        }}
        renderCampos={(item) => [
          { label: 'Fecha inicio', value: formatearFecha(item.fecha_inicio) },
          { label: 'Fecha fin', value: formatearFecha(item.fecha_fin) },
          { label: 'Días', value: pluralDias(item.dias), tabular: true },
          ...(item.comentario ? [{ label: 'Comentario', value: item.comentario }] : []),
        ]}
        renderFormulario={(item, cerrar) => (
          <FormularioRango
            valoresIniciales={item}
            onGuardar={async (datos) => {
              if (item) await api.editarSuspension(id, item.id, datos);
              else await api.agregarSuspension(id, datos);
              cerrar();
              recargar();
              toast.success(item ? 'Suspensión actualizada' : 'Suspensión agregada');
            }}
          />
        )}
      />

      <SeccionRegistros
        titulo="Licencias no remuneradas"
        items={periodo.licencias}
        vacioTexto="Sin licencias registradas"
        onEliminarConfirmado={async (licId) => {
          await api.eliminarLicencia(id, licId);
          recargar();
        }}
        renderCampos={(item) => [
          { label: 'Fecha inicio', value: formatearFecha(item.fecha_inicio) },
          { label: 'Fecha fin', value: formatearFecha(item.fecha_fin) },
          { label: 'Días', value: pluralDias(item.dias), tabular: true },
          ...(item.comentario ? [{ label: 'Comentario', value: item.comentario }] : []),
        ]}
        renderFormulario={(item, cerrar) => (
          <FormularioRango
            valoresIniciales={item}
            onGuardar={async (datos) => {
              if (item) await api.editarLicencia(id, item.id, datos);
              else await api.agregarLicencia(id, datos);
              cerrar();
              recargar();
              toast.success(item ? 'Licencia actualizada' : 'Licencia agregada');
            }}
          />
        )}
      />

      <Dialog open={dialogoEditarPeriodo} onOpenChange={setDialogoEditarPeriodo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar periodo</DialogTitle>
          </DialogHeader>
          <FormularioEditarPeriodo periodo={periodo} onGuardar={guardarEdicionPeriodo} />
        </DialogContent>
      </Dialog>
    </div>
  );
}