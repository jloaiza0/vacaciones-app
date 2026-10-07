import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/cliente';

export default function ConsultaTrabajador() {
  const { id } = useParams();
  const [trabajador, setTrabajador] = useState(null);

  useEffect(() => {
    api.consultarTrabajador(id).then(setTrabajador);
  }, [id]);

  if (!trabajador) return <p className="legado contenedor">Cargando...</p>;

  return (
    <div className="legado">
      <div className="contenedor">
        <Link to="/consulta" className="volver">
          ← Volver a la búsqueda
        </Link>
        <h2>
          {trabajador.nombre} — {trabajador.cedula}
        </h2>
        <table>
          <thead>
            <tr>
              <th>Periodo</th>
              <th>Estado</th>
              <th>Pendientes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {trabajador.periodos.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.periodo_pago_inicio} – {p.periodo_pago_fin}
                </td>
                <td>{p.estado}</td>
                <td>{p.dias_pendientes}</td>
                <td>
                  <Link to={`/consulta/periodos/${p.id}`} className="enlace-tabla">
                    Ver detalle
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}