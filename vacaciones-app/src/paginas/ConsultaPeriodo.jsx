import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/cliente';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { DataRow } from '@/components/ui/data-row';
import { formatearFecha, formatearDinero, pluralDias } from '@/lib/formato';
import { ArrowLeft, CalendarOff } from 'lucide-react';

function badgeEstado(estado) {
  const clases = {
    'Sin vencer': 'bg-secondary text-secondary-foreground',
    Pendiente: 'bg-warning text-warning-foreground',
    Disfrutado: 'bg-success text-success-foreground',
    Anticipadas: 'bg-accent text-accent-foreground',
  };
  return clases[estado] || 'bg-secondary text-secondary-foreground';
}

function SeccionSoloLectura({ titulo, items, vacioTexto, renderCampos }) {
  return (
    <div className="mb-8">
      <h2 className="mb-2 text-sm font-medium text-foreground">{titulo}</h2>
      {items.length === 0 ? (
        <EmptyState icon={CalendarOff} title={vacioTexto} />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <DataRow key={item.id} fields={renderCampos(item)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ConsultaPeriodo() {
  const { id } = useParams();
  const [periodo, setPeriodo] = useState(null);

  useEffect(() => {
    api.consultarPeriodo(id).then(setPeriodo);
  }, [id]);

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
        to={`/consulta/trabajadores/${periodo.trabajador_id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a {periodo.nombre}
      </Link>

      <h1 className="mb-4 text-2xl font-semibold text-foreground">
        Periodo {formatearFecha(periodo.periodo_pago_inicio)} – {formatearFecha(periodo.periodo_pago_fin)}
      </h1>

      <div className="mb-8 grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-4">
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

      <SeccionSoloLectura
        titulo="Tomas de vacaciones"
        items={periodo.tomas}
        vacioTexto="Sin tomas registradas"
        renderCampos={(item) => [
          { label: 'Fecha inicio', value: formatearFecha(item.fecha_inicio) },
          { label: 'Fecha fin', value: formatearFecha(item.fecha_fin) },
          { label: 'Hábiles disfrutados', value: pluralDias(item.habiles_disfrutados), tabular: true },
          { label: 'Hábiles pagos', value: pluralDias(item.habiles_pagos), tabular: true },
          { label: 'Total días', value: pluralDias(item.total_dias_disfrutados), tabular: true },
          { label: 'Compensación', value: formatearDinero(item.compensacion_dinero), tabular: true },
          ...(item.comentario ? [{ label: 'Comentario', value: item.comentario }] : []),
        ]}
      />

      <SeccionSoloLectura
        titulo="Suspensiones de contrato"
        items={periodo.suspensiones}
        vacioTexto="Sin suspensiones registradas"
        renderCampos={(item) => [
          { label: 'Fecha inicio', value: formatearFecha(item.fecha_inicio) },
          { label: 'Fecha fin', value: formatearFecha(item.fecha_fin) },
          { label: 'Días', value: pluralDias(item.dias), tabular: true },
          ...(item.comentario ? [{ label: 'Comentario', value: item.comentario }] : []),
        ]}
      />

      <SeccionSoloLectura
        titulo="Licencias no remuneradas"
        items={periodo.licencias}
        vacioTexto="Sin licencias registradas"
        renderCampos={(item) => [
          { label: 'Fecha inicio', value: formatearFecha(item.fecha_inicio) },
          { label: 'Fecha fin', value: formatearFecha(item.fecha_fin) },
          { label: 'Días', value: pluralDias(item.dias), tabular: true },
          ...(item.comentario ? [{ label: 'Comentario', value: item.comentario }] : []),
        ]}
      />
    </div>
  );
}