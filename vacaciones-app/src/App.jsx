import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './paginas/Login';
import ListadoTrabajadores from './paginas/ListadoTrabajadores';
import FichaTrabajador from './paginas/FichaTrabajador';
import DetallePeriodo from './paginas/DetallePeriodo';
import Consulta from './paginas/Consulta';
import ConsultaTrabajador from './paginas/ConsultaTrabajador';
import ConsultaPeriodo from './paginas/ConsultaPeriodo';
import BarraSuperior from './componentes/BarraSuperior';
import { Toaster } from '@/components/ui/sonner';
import { api } from './api/cliente';

export default function App() {
  const [autenticado, setAutenticado] = useState(false);

  async function cerrarSesion() {
    await api.logout();
    setAutenticado(false);
  }

  function conBarra(elemento) {
    if (!autenticado) return <Navigate to="/login" />;
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
        <Route path="/login" element={<Login onLogin={() => setAutenticado(true)} />} />
        <Route path="/" element={conBarra(<ListadoTrabajadores />)} />
        <Route path="/trabajadores/:id" element={conBarra(<FichaTrabajador />)} />
        <Route path="/periodos/:id" element={conBarra(<DetallePeriodo />)} />
      </Routes>
    </HashRouter>
  );
}