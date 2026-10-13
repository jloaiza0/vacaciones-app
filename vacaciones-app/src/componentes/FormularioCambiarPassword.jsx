import React, { useState } from 'react';
import { api } from '../api/cliente';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Loader2Icon } from 'lucide-react';

const LARGO_MINIMO = 8;

// Formulario compartido: lo usa el diálogo "Cambiar contraseña" de la barra superior
// y la pantalla de cambio obligatorio.
export default function FormularioCambiarPassword({ onCambiada }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errores, setErrores] = useState({});
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();

    const nuevosErrores = {};
    if (nueva.length < LARGO_MINIMO) {
      nuevosErrores.nueva = `Debe tener al menos ${LARGO_MINIMO} caracteres`;
    } else if (nueva === actual) {
      nuevosErrores.nueva = 'Debe ser distinta de la actual';
    }
    if (nueva !== confirmacion) {
      nuevosErrores.confirmacion = 'No coincide con la contraseña nueva';
    }
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }

    setErrores({});
    setCargando(true);
    try {
      await api.cambiarPassword(actual, nueva);
      onCambiada();
    } catch (err) {
      if (err.message === 'La contraseña actual no es correcta') {
        setErrores({ actual: err.message });
      } else {
        setErrores({ general: err.message });
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <Field label="Contraseña actual" htmlFor="pw-actual" error={errores.actual}>
        <Input
          id="pw-actual"
          type="password"
          autoComplete="current-password"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          required
          autoFocus
        />
      </Field>
      <Field
        label="Contraseña nueva"
        htmlFor="pw-nueva"
        hint={`Mínimo ${LARGO_MINIMO} caracteres`}
        error={errores.nueva}
      >
        <Input
          id="pw-nueva"
          type="password"
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          required
        />
      </Field>
      <Field label="Repite la contraseña nueva" htmlFor="pw-confirmacion" error={errores.confirmacion}>
        <Input
          id="pw-confirmacion"
          type="password"
          autoComplete="new-password"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          required
        />
      </Field>
      {errores.general && <p className="text-sm text-destructive">{errores.general}</p>}
      <Button type="submit" disabled={cargando} className="self-start">
        {cargando ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            Guardando...
          </>
        ) : (
          'Cambiar contraseña'
        )}
      </Button>
    </form>
  );
}