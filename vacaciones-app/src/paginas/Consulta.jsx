import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/cliente';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Search, Users } from 'lucide-react';

export default function Consulta() {
  const [q, setQ] = useState('');
  const [trabajadores, setTrabajadores] = useState(null);

  useEffect(() => {
    api.consultarTrabajadores(q).then(setTrabajadores);
  }, [q]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-4 text-2xl font-semibold text-foreground">Consulta de vacaciones</h1>

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o cédula"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {trabajadores === null ? (
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      ) : trabajadores.length === 0 ? (
        <EmptyState icon={Users} title="Sin resultados" description="No hay trabajadores que coincidan con la búsqueda." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-4 py-2.5 font-medium">Cédula</th>
              </tr>
            </thead>
            <tbody>
              {trabajadores.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link
                      to={`/consulta/trabajadores/${t.id}`}
                      className="font-medium text-foreground transition-colors duration-150 hover:text-foreground/70"
                    >
                      {t.nombre}
                    </Link>
                  </td>
                  <td className="tabular-nums px-4 py-3 text-muted-foreground">{t.cedula}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}