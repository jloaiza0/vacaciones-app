import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/cliente';

function ListaSoloLectura({ items }) {
  if (!items.length) return <p className="secundario">Sin registros.</p>;
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          {item.fecha_inicio} – {item.fecha_fin} ({item.dias} días)
          {item.comentario ? ` · ${item.comentario}` : ''}
        </li>
      ))}
    </ul>
  );
}

function ListaTomasSoloLectura({ items }) {
  if (!items.length) return <p className="secundario">Sin registros.</p>;
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          {item.fecha_inicio} – {item.fecha_fin} · hábiles disfrutados: {item.habiles_disfrutados} · hábiles pagos:{' '}
          {item.habiles_pagos} · total días: {item.total_dias_disfrutados} · compensación: $
          {item.compensacion_dinero}
          {item.comentario ? ` · ${item.comentario}` : ''}
        </li>
      ))}
    </ul>
  );
}

export default function ConsultaPeriodo() {
  const { id } = useParams();
  const [periodo, setPeriodo] = useState(null);

  useEffect(() => {
    api.consultarPeriodo(id).then(setPeriodo);
  }, [id]);

  if (!periodo) return <p className="legado contenedor">Cargando...</p>;

  return (
    <div className="legado">
      <div className="contenedor">
        <Link to={`/consulta/trabajadores/${periodo.trabajador_id}`} className="volver">
          ← Volver a {periodo.nombre}
        </Link>

        <h2>
          Periodo {periodo.periodo_pago_inicio} – {periodo.periodo_pago_fin}
        </h2>
        <p className="secundario">
          Estado: {periodo.estado} · Días pendientes: {periodo.dias_pendientes}
        </p>
        <p className="secundario">
          Fecha liquidación: {periodo.fecha_liquidacion || '—'} · Comentario: {periodo.comentario || '—'}
        </p>

        <h3>Tomas de vacaciones</h3>
        <ListaTomasSoloLectura items={periodo.tomas} />

        <h3>Suspensiones de contrato</h3>
        <ListaSoloLectura items={periodo.suspensiones} />

        <h3>Licencias no remuneradas</h3>
        <ListaSoloLectura items={periodo.licencias} />
      </div>
    </div>
  );
}