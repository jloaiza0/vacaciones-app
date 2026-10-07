import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function BarraSuperior({ onLogout }) {
  const navegar = useNavigate();

  async function manejarLogout() {
    await onLogout();
    navegar('/login');
  }

  return (
    <div className="legado barra-superior">
      <span>Gestión de vacaciones</span>
      <button type="button" onClick={manejarLogout}>
        Cerrar sesión
      </button>
    </div>
  );
}