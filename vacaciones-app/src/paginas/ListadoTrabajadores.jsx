import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../api/cliente';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatearFecha } from '@/lib/formato';
import { Plus, Search, Users, Loader2Icon } from 'lucide-react';

const HOY = new Date().toISOString().slice(0, 10);

function FormularioNuevoTrabajador({ onCreado }) {
  const [datos, setDatos] = useState({ cedula: '', nombre: '', fecha_ingreso: '', firmado: 'No', salario: '' });
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
      const respuesta = await api.crearTrabajador({ ...datos, salario: Number(datos.salario) || null });
      if (!respuesta?.id) {
        setError('El servidor no devolvió el id del trabajador creado.');
        return;
      }
      onCreado(respuesta.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
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
          'Guardar'
        )}
      </Button>
    </form>
  );
}

export default function ListadoTrabajadores() {
  const [trabajadores, setTrabajadores] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('activos');
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const navegar = useNavigate();

  useEffect(() => {
    setTrabajadores(null);
    api.listarTrabajadores(filtro).then(setTrabajadores);
  }, [filtro]);

  const visibles = (trabajadores || []).filter(
    (t) => t.nombre.toLowerCase().includes(busqueda.toLowerCase()) || t.cedula.includes(busqueda)
  );

  function trabajadorCreado(id) {
    setDialogoAbierto(false);
    toast.success('Trabajador creado');
    navegar(`/trabajadores/${id}`);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o cédula"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
          <option value="todos">Todos</option>
        </select>
        <Button onClick={() => setDialogoAbierto(true)} className="whitespace-nowrap">
          <Plus className="size-4" />
          Nuevo trabajador
        </Button>
      </div>

      {trabajadores === null ? (
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      ) : visibles.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin trabajadores"
          description={
            busqueda ? 'No hay resultados para esa búsqueda.' : 'Todavía no hay trabajadores en esta vista.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-4 py-2.5 font-medium">Cédula</th>
                <th className="px-4 py-2.5 font-medium">Ingreso</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => navegar(`/trabajadores/${t.id}`)}
                  className="cursor-pointer border-t border-border transition-colors duration-150 hover:bg-muted/40"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{t.nombre}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{t.cedula}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatearFecha(t.fecha_ingreso)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo trabajador</DialogTitle>
            <DialogDescription>Se crea sin periodos; los agregas después desde su ficha.</DialogDescription>
          </DialogHeader>
          <FormularioNuevoTrabajador onCreado={trabajadorCreado} />
        </DialogContent>
      </Dialog>
    </div>
  );
}