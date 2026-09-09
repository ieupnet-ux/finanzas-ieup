import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import Papa from 'papaparse';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, PlusCircle, Edit3, Trash2, FileText, ChevronDown, ChevronUp, Plus, X, ClipboardCheck } from 'lucide-react';

// Fecha actual en zona horaria Argentina (evita el bug de UTC a partir de las 21hs)
const hoyAR = () => {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
};


// ============ Helpers ============
const OPERACIONES = {
  INSERT: { label: 'Alta', color: 'bg-green-500' },
  UPDATE: { label: 'Edición', color: 'bg-blue-500' },
  DELETE: { label: 'Eliminación', color: 'bg-red-500' },
};

// Campos de movimientos que vale la pena mostrar en el diff
const CAMPOS_DIFF = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'concepto', label: 'Concepto' },
  { key: 'monto', label: 'Monto' },
  { key: 'moneda', label: 'Moneda' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'ubicacion', label: 'Caja' },
  { key: 'templo_id', label: 'Templo' },
  { key: 'tipo_transaccion', label: 'Medio de pago' },
  { key: 'detalle', label: 'Detalle' },
];

const fmtMonto = (n) => `$ ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtFechaCorta = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? String(s) : d.toLocaleDateString('es-AR');
};

export default function Auditoria({ usuario }) {
  const [logs, setLogs] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [templos, setTemplos] = useState([]);
  const [cajas, setCajas] = useState([]);
  const [revisores, setRevisores] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [periodo, setPeriodo] = useState('30d');
  const [usuarioFiltro, setUsuarioFiltro] = useState('');
  const [operacionFiltro, setOperacionFiltro] = useState('');
  const [filaAbierta, setFilaAbierta] = useState(null);
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 25;

  // Revisores
  const [formRevisorAbierto, setFormRevisorAbierto] = useState(false);
  const [nuevoRevisor, setNuevoRevisor] = useState({
    nombre: '', fecha_revision: hoyAR(), observaciones: '',
  });

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    const [logsRes, usuariosRes, templosRes, cajasRes, revisoresRes] = await Promise.all([
      supabase.from('auditoria').select('*').order('fecha', { ascending: false }).limit(500),
      supabase.from('usuarios').select('id, email, nombre'),
      supabase.from('templos').select('id, nombre'),
      supabase.from('cajas').select('valor, nombre'),
      supabase.from('revisores_cuenta').select('*').order('fecha_revision', { ascending: false }),
    ]);
    setLogs(logsRes.data || []);
    setUsuarios(usuariosRes.data || []);
    setTemplos(templosRes.data || []);
    setCajas(cajasRes.data || []);
    setRevisores(revisoresRes.data || []);
    setLoading(false);
  };

  // ---- lookups ----
  const nombreUsuario = (id) => {
    const u = usuarios.find(x => x.id === id);
    return u ? (u.nombre || u.email) : 'Sistema';
  };
  const nombreTemplo = (id) => templos.find(t => t.id === id)?.nombre || '—';
  const nombreCaja = (valor) => cajas.find(c => c.valor === valor)?.nombre || valor || '—';

  const valorLegible = (key, valor) => {
    if (valor === null || valor === undefined || valor === '') return '—';
    if (key === 'monto') return fmtMonto(valor);
    if (key === 'fecha') return fmtFechaCorta(valor);
    if (key === 'templo_id') return nombreTemplo(valor);
    if (key === 'ubicacion') return nombreCaja(valor);
    return String(valor);
  };

  // Resumen de una fila: qué cambió
  const resumenCambio = (log) => {
    const ant = log.datos_anteriores;
    const nue = log.datos_nuevos;
    if (log.tipo_operacion === 'INSERT') {
      return `${nue?.tipo === 'egreso' ? 'Egreso' : 'Ingreso'} ${fmtMonto(nue?.monto)} — ${nue?.concepto || ''} (${nombreCaja(nue?.ubicacion)})`;
    }
    if (log.tipo_operacion === 'DELETE') {
      return `${ant?.tipo === 'egreso' ? 'Egreso' : 'Ingreso'} ${fmtMonto(ant?.monto)} — ${ant?.concepto || ''} (${nombreCaja(ant?.ubicacion)})`;
    }
    // UPDATE: listar los campos que cambiaron
    const cambios = CAMPOS_DIFF
      .filter(c => JSON.stringify(ant?.[c.key]) !== JSON.stringify(nue?.[c.key]))
      .map(c => c.label);
    const base = `${nue?.concepto || ant?.concepto || ''} ${fmtMonto(nue?.monto ?? ant?.monto)}`;
    return cambios.length > 0 ? `${base} — cambió: ${cambios.join(', ')}` : `${base} — sin cambios visibles`;
  };

  // Diff detallado para la fila expandida
  const diffDetallado = (log) => {
    const ant = log.datos_anteriores || {};
    const nue = log.datos_nuevos || {};
    if (log.tipo_operacion === 'INSERT') {
      return CAMPOS_DIFF.map(c => ({ campo: c.label, antes: null, despues: valorLegible(c.key, nue[c.key]) }))
        .filter(d => d.despues !== '—');
    }
    if (log.tipo_operacion === 'DELETE') {
      return CAMPOS_DIFF.map(c => ({ campo: c.label, antes: valorLegible(c.key, ant[c.key]), despues: null }))
        .filter(d => d.antes !== '—');
    }
    return CAMPOS_DIFF
      .filter(c => JSON.stringify(ant[c.key]) !== JSON.stringify(nue[c.key]))
      .map(c => ({ campo: c.label, antes: valorLegible(c.key, ant[c.key]), despues: valorLegible(c.key, nue[c.key]) }));
  };

  // ---- filtros ----
  const logsFiltrados = useMemo(() => {
    const ahora = new Date();
    let desde = null;
    if (periodo === 'hoy') { desde = new Date(ahora); desde.setHours(0, 0, 0, 0); }
    if (periodo === '7d') { desde = new Date(ahora); desde.setDate(desde.getDate() - 7); }
    if (periodo === '30d') { desde = new Date(ahora); desde.setDate(desde.getDate() - 30); }

    return logs.filter(l => {
      if (desde && new Date(l.fecha) < desde) return false;
      if (usuarioFiltro && l.usuario_id !== usuarioFiltro) return false;
      if (operacionFiltro && l.tipo_operacion !== operacionFiltro) return false;
      return true;
    });
  }, [logs, periodo, usuarioFiltro, operacionFiltro]);

  useEffect(() => { setPagina(1); }, [periodo, usuarioFiltro, operacionFiltro]);

  const totalPaginas = Math.max(1, Math.ceil(logsFiltrados.length / POR_PAGINA));
  const logsPagina = logsFiltrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  // ---- stats ----
  const stats = useMemo(() => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return {
      total: logsFiltrados.length,
      altas: logsFiltrados.filter(l => l.tipo_operacion === 'INSERT').length,
      ediciones: logsFiltrados.filter(l => l.tipo_operacion === 'UPDATE').length,
      eliminaciones: logsFiltrados.filter(l => l.tipo_operacion === 'DELETE').length,
    };
  }, [logsFiltrados]);

  // Timeline por día (del conjunto filtrado)
  const timeline = useMemo(() => {
    const porDia = {};
    logsFiltrados.forEach(l => {
      const dia = new Date(l.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
      porDia[dia] = (porDia[dia] || 0) + 1;
    });
    return Object.entries(porDia).map(([dia, cambios]) => ({ dia, cambios })).reverse();
  }, [logsFiltrados]);

  // ---- export ----
  const exportarCSV = () => {
    const data = logsFiltrados.map(l => ({
      Fecha: new Date(l.fecha).toLocaleString('es-AR'),
      Usuario: nombreUsuario(l.usuario_id),
      Operacion: OPERACIONES[l.tipo_operacion]?.label || l.tipo_operacion,
      Tabla: l.tabla_afectada,
      Resumen: resumenCambio(l),
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `auditoria-${hoyAR()}.csv`;
    link.click();
  };

  // ---- revisores ----
  const agregarRevisor = async (e) => {
    e.preventDefault();
    if (!nuevoRevisor.nombre.trim()) return;
    const { error } = await supabase.from('revisores_cuenta').insert({
      nombre: nuevoRevisor.nombre.trim(),
      fecha_revision: nuevoRevisor.fecha_revision,
      observaciones: nuevoRevisor.observaciones.trim() || null,
      discrepancias_encontradas: false,
    });
    if (error) { alert('Error: ' + error.message); return; }
    setNuevoRevisor({ nombre: '', fecha_revision: hoyAR(), observaciones: '' });
    setFormRevisorAbierto(false);
    cargar();
  };

  const toggleDiscrepancia = async (r) => {
    await supabase.from('revisores_cuenta')
      .update({ discrepancias_encontradas: !r.discrepancias_encontradas })
      .eq('id', r.id);
    cargar();
  };

  const eliminarRevision = async (id) => {
    if (!confirm('¿Eliminar este registro de revisión?')) return;
    await supabase.from('revisores_cuenta').delete().eq('id', id);
    cargar();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-navy">Auditoría del Sistema</h1>
          <p className="text-gray-600 text-sm">Registro de cambios: quién hizo qué y cuándo</p>
        </div>
        <button onClick={exportarCSV} className="btn-secondary flex items-center gap-2">
          <FileText size={18} /> Exportar CSV
        </button>
      </div>

      {/* FILTROS */}
      <div className="card bg-blue-50 border-l-4 border-blue-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-navy mb-1">Período</label>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="input-field w-full">
              <option value="hoy">Hoy</option>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
              <option value="todo">Todo (últimos 500 registros)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-navy mb-1">Usuario</label>
            <select value={usuarioFiltro} onChange={(e) => setUsuarioFiltro(e.target.value)} className="input-field w-full">
              <option value="">Todos</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre || u.email}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-navy mb-1">Operación</label>
            <select value={operacionFiltro} onChange={(e) => setOperacionFiltro(e.target.value)} className="input-field w-full">
              <option value="">Todas</option>
              <option value="INSERT">Altas</option>
              <option value="UPDATE">Ediciones</option>
              <option value="DELETE">Eliminaciones</option>
            </select>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="flex items-center gap-3">
            <Activity className="text-blue-600" size={32} />
            <div>
              <p className="text-xs text-gray-600">Cambios en el período</p>
              <p className="text-2xl font-bold text-navy">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-green-50 to-green-100">
          <div className="flex items-center gap-3">
            <PlusCircle className="text-green-600" size={32} />
            <div>
              <p className="text-xs text-gray-600">Altas</p>
              <p className="text-2xl font-bold text-navy">{stats.altas}</p>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="flex items-center gap-3">
            <Edit3 className="text-indigo-600" size={32} />
            <div>
              <p className="text-xs text-gray-600">Ediciones</p>
              <p className="text-2xl font-bold text-navy">{stats.ediciones}</p>
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-red-50 to-red-100">
          <div className="flex items-center gap-3">
            <Trash2 className="text-red-600" size={32} />
            <div>
              <p className="text-xs text-gray-600">Eliminaciones</p>
              <p className="text-2xl font-bold text-navy">{stats.eliminaciones}</p>
            </div>
          </div>
        </div>
      </div>

      {/* TIMELINE */}
      {timeline.length > 1 && (
        <div className="card">
          <h2 className="text-xl font-bold text-navy mb-4">Cambios por día</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="cambios" fill="#FFD700" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* REGISTRO DE CAMBIOS */}
      <div className="card">
        <h2 className="text-xl font-bold text-navy mb-4">
          Registro de Cambios <span className="text-sm font-normal text-gray-500">({logsFiltrados.length})</span>
        </h2>

        {loading ? (
          <p className="text-center text-gray-500 py-8">Cargando...</p>
        ) : logsPagina.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No hay cambios con los filtros seleccionados</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gold">
                    <th className="text-left p-2 text-navy font-bold">Fecha y hora</th>
                    <th className="text-left p-2 text-navy font-bold">Usuario</th>
                    <th className="text-left p-2 text-navy font-bold">Operación</th>
                    <th className="text-left p-2 text-navy font-bold">Resumen</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {logsPagina.map((log) => {
                    const abierta = filaAbierta === log.id;
                    const op = OPERACIONES[log.tipo_operacion] || { label: log.tipo_operacion, color: 'bg-gray-500' };
                    const diff = abierta ? diffDetallado(log) : [];
                    return (
                      <>
                        <tr
                          key={log.id}
                          className="border-b hover:bg-gray-50 cursor-pointer"
                          onClick={() => setFilaAbierta(abierta ? null : log.id)}
                        >
                          <td className="p-2 text-xs whitespace-nowrap">
                            {new Date(log.fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-2 text-xs font-medium">{nombreUsuario(log.usuario_id)}</td>
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded text-white text-xs font-bold ${op.color}`}>
                              {op.label}
                            </span>
                          </td>
                          <td className="p-2 text-xs text-gray-700">{resumenCambio(log)}</td>
                          <td className="p-2 text-gray-400">
                            {abierta ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </td>
                        </tr>
                        {abierta && (
                          <tr key={log.id + '-detalle'} className="bg-blue-50">
                            <td colSpan={5} className="p-3">
                              {diff.length === 0 ? (
                                <p className="text-xs text-gray-500">Sin diferencias en los campos principales.</p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-navy font-bold">
                                      <td className="p-1 w-40">Campo</td>
                                      <td className="p-1">Antes</td>
                                      <td className="p-1">Después</td>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {diff.map((d, i) => (
                                      <tr key={i} className="border-t border-blue-200">
                                        <td className="p-1 font-medium">{d.campo}</td>
                                        <td className="p-1 text-red-700">{d.antes ?? '—'}</td>
                                        <td className="p-1 text-green-700">{d.despues ?? '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between mt-3">
                <button
                  onClick={() => setPagina(p => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                  className="btn-secondary text-sm disabled:opacity-40"
                >
                  ← Anterior
                </button>
                <span className="text-sm text-gray-600">Página {pagina} de {totalPaginas}</span>
                <button
                  onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                  disabled={pagina === totalPaginas}
                  className="btn-secondary text-sm disabled:opacity-40"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* REVISIONES DE CUENTAS (simplificado) */}
      <div className="card border-l-4 border-purple-600">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="text-purple-600" size={24} />
            <h2 className="text-xl font-bold text-navy">Revisiones de Cuentas</h2>
          </div>
          <button onClick={() => setFormRevisorAbierto(!formRevisorAbierto)} className="btn-primary flex items-center gap-2 text-sm">
            {formRevisorAbierto ? <X size={16} /> : <Plus size={16} />}
            {formRevisorAbierto ? 'Cancelar' : 'Registrar revisión'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Registro de las visitas del revisor de cuentas: quién revisó, cuándo y si encontró discrepancias.
        </p>

        {formRevisorAbierto && (
          <form onSubmit={agregarRevisor} className="bg-purple-50 p-4 rounded mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Nombre del revisor"
              value={nuevoRevisor.nombre}
              onChange={(e) => setNuevoRevisor({ ...nuevoRevisor, nombre: e.target.value })}
              className="input-field"
              required
            />
            <input
              type="date"
              value={nuevoRevisor.fecha_revision}
              onChange={(e) => setNuevoRevisor({ ...nuevoRevisor, fecha_revision: e.target.value })}
              className="input-field"
            />
            <input
              type="text"
              placeholder="Observaciones (opcional)"
              value={nuevoRevisor.observaciones}
              onChange={(e) => setNuevoRevisor({ ...nuevoRevisor, observaciones: e.target.value })}
              className="input-field"
            />
            <button type="submit" className="btn-primary">Guardar</button>
          </form>
        )}

        {revisores.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">Aún no hay revisiones registradas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gold">
                  <th className="text-left p-2 text-navy font-bold">Revisor</th>
                  <th className="text-left p-2 text-navy font-bold">Fecha</th>
                  <th className="text-left p-2 text-navy font-bold">Discrepancias</th>
                  <th className="text-left p-2 text-navy font-bold">Observaciones</th>
                  <th className="text-center p-2 text-navy font-bold w-16"></th>
                </tr>
              </thead>
              <tbody>
                {revisores.map(r => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{r.nombre}</td>
                    <td className="p-2 text-xs">{fmtFechaCorta(r.fecha_revision)}</td>
                    <td className="p-2">
                      <button
                        onClick={() => toggleDiscrepancia(r)}
                        className={`px-3 py-1 rounded text-white text-xs font-bold ${r.discrepancias_encontradas ? 'bg-red-500' : 'bg-green-500'}`}
                        title="Click para cambiar"
                      >
                        {r.discrepancias_encontradas ? 'SÍ' : 'NO'}
                      </button>
                    </td>
                    <td className="p-2 text-xs text-gray-600">{r.observaciones || '—'}</td>
                    <td className="p-2 text-center">
                      <button onClick={() => eliminarRevision(r.id)} className="p-1 text-red-600 hover:bg-red-100 rounded">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
