import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/cliente';

export default function Consulta() {
  const [q, setQ] = useState('');
  const [trabajadores, setTrabajadores] = useState([]);

  useEffect(() => {
    api.consultarTrabajadores(q).then(setTrabajadores);
  }, [q]);

  return (
    <div className="legado">
      <div className="contenedor">
        <h2>Consulta de vacaciones</h2>
        <input placeholder="Buscar por nombre o cédula" value={q} onChange={(e) => setQ(e.target.value)} />
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Cédula</th>
            </tr>
          </thead>
          <tbody>
            {trabajadores.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link to={`/consulta/trabajadores/${t.id}`} className="enlace-tabla">
                    {t.nombre}
                  </Link>
                </td>
                <td>{t.cedula}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}