import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './paginas/Login';
import ListadoTrabajadores from './paginas/ListadoTrabajadores';
import FichaTrabajador from './paginas/FichaTrabajador';
import DetallePeriodo from './paginas/DetallePeriodo';
import Consulta from './paginas/Consulta';
import ConsultaTrabajador from './paginas/ConsultaTrabajador';
import ConsultaPeriodo from './paginas/ConsultaPeriodo';
import CambioPasswordObligatorio from './paginas/CambioPasswordObligatorio';
import BarraSuperior from './componentes/BarraSuperior';
import { Toaster } from '@/components/ui/sonner';
import { api } from './api/cliente';

export default function App() {
  const [autenticado, setAutenticado] = useState(false);
  const [debeCambiar, setDebeCambiar] = useState(false);

  function alIniciarSesion(debeCambiarPassword) {
    setAutenticado(true);
    setDebeCambiar(debeCambiarPassword);
  }

  async function cerrarSesion() {
    await api.logout();
    setAutenticado(false);
    setDebeCambiar(false);
  }

  function conBarra(elemento) {
    if (!autenticado) return <Navigate to="/login" />;
    if (debeCambiar) {
      return <CambioPasswordObligatorio onCambiada={() => setDebeCambiar(false)} onLogout={cerrarSesion} />;
    }
    return (
      <>
        <BarraSuperior onLogout={cerrarSesion} />
        {elemento}
      </>
    );
  }

  return (
    <HashRouter>
      <Toaster position="bottom-right" />
      <Routes>
        <Route path="/consulta" element={<Consulta />} />
        <Route path="/consulta/trabajadores/:id" element={<ConsultaTrabajador />} />
        <Route path="/consulta/periodos/:id" element={<ConsultaPeriodo />} />
        <Route path="/login" element={<Login onLogin={alIniciarSesion} />} />
        <Route path="/" element={conBarra(<ListadoTrabajadores />)} />
        <Route path="/trabajadores/:id" element={conBarra(<FichaTrabajador />)} />
        <Route path="/periodos/:id" element={conBarra(<DetallePeriodo />)} />
      </Routes>
    </HashRouter>
  );
}