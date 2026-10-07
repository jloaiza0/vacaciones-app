import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/cliente';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2Icon } from 'lucide-react';

export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navegar = useNavigate();

  async function manejarEnvio(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await api.login(usuario, password);
      onLogin();
      navegar('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-[360px]">
        <CardHeader>
          <CardTitle className="text-xl font-semibold whitespace-nowrap">Gestión de vacaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={manejarEnvio} className="flex flex-col gap-4">
            <Field label="Usuario" htmlFor="usuario">
              <Input id="usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoFocus />
            </Field>
            <Field label="Contraseña" htmlFor="password">
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={cargando} className="mt-1">
              {cargando ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Ingresar'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}