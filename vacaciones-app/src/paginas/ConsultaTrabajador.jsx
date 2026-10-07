import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/cliente';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatearFecha } from '@/lib/formato';
import { ArrowLeft, ChevronRight, CalendarX } from 'lucide-react';

function badgeEstado(estado) {
  const clases = {
    'Sin vencer': 'bg-secondary text-secondary-foreground',
    Pendiente: 'bg-warning text-warning-foreground',
    Disfrutado: 'bg-success text-success-foreground',
    Anticipadas: 'bg-accent text-accent-foreground',
  };
  return clases[estado] || 'bg-secondary text-secondary-foreground';
}

export default function ConsultaTrabajador() {
  const { id } = useParams();
  const [trabajador, setTrabajador] = useState(null);

  useEffect(() => {
    api.consultarTrabajador(id).then(setTrabajador);
  }, [id]);

  if (!trabajador) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Skeleton className="mb-4 h-6 w-32" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link
        to="/consulta"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a la búsqueda
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">{trabajador.nombre}</h1>
        <p className="tabular-nums text-sm text-muted-foreground">{trabajador.cedula}</p>
      </div>

      <h2 className="mb-2 text-sm font-medium text-foreground">Periodos</h2>
      {trabajador.periodos.length === 0 ? (
        <EmptyState icon={CalendarX} title="Sin periodos" description="Este trabajador no tiene periodos registrados." />
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
                <tr key={p.id} className="group border-t border-border">
                  <td className="px-4 py-3">
                    <Link
                      to={`/consulta/periodos/${p.id}`}
                      className="block text-foreground transition-colors duration-150 group-hover:text-foreground/70"
                    >
                      {formatearFecha(p.periodo_pago_inicio)} – {formatearFecha(p.periodo_pago_fin)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={badgeEstado(p.estado)}>{p.estado}</Badge>
                  </td>
                  <td className="tabular-nums px-4 py-3 text-muted-foreground">{p.dias_pendientes}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/consulta/periodos/${p.id}`} className="text-muted-foreground">
                      <ChevronRight className="ml-auto size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}