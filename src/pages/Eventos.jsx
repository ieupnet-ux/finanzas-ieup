import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import Papa from 'papaparse';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  Plus, X, Save, Edit2, Eye, EyeOff, FileText,
  ArrowLeft, TrendingUp, TrendingDown, DollarSign, Calendar
} from 'lucide-react';

// ── Constantes ──────────────────────────────────────────────
const TIPOS_EVENTO = [
  { value: 'conferencia-pastores',    label: 'Conferencia Anual de Pastores' },
  { value: 'congreso-jovenes',        label: 'Congreso de Jóvenes' },
  { value: 'congreso-supervisores',   label: 'Congreso de Supervisores' },
  { value: 'congreso-dorcas',         label: 'Congreso de Dorcas' },
  { value: 'otro',                    label: 'Otro evento' },
];

const TIPO_COLOR = {
  'conferencia-pastores':  '#001f3f',
  'congreso-jovenes':      '#2563eb',
  'congreso-supervisores': '#7c3aed',
  'congreso-dorcas':       '#db2777',
  'otro':                  '#6b7280',
};

const COLORS = ['#001f3f','#FFD700','#2563eb','#7c3aed','#db2777','#16a34a','#ea580c','#0891b2'];

const fmt = (n) => `$ ${Number(n||0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtFecha = (s) => s ? new Date(s+'T00:00:00').toLocaleDateString('es-AR') : '—';

// ── Componente principal ────────────────────────────────────
export default function Eventos({ usuario }) {
  const puedeEditar = ['admin','tesorero'].includes(usuario?.rol);

  const [eventos, setEventos]     = useState([]);
  const [templos, setTemplos]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [mensaje, setMensaje]     = useState('');
  const [eventoActivo, setEventoActivo] = useState(null); // detalle
  const [formAbierto, setFormAbierto]   = useState(false);
  const [editandoId, setEditandoId]     = useState(null);
  const [form, setForm] = useState({
    nombre:'', tipo:'conferencia-pastores', anio: new Date().getFullYear(),
    fecha_inicio:'', fecha_fin:'', descripcion:'',
  });

  // Detalle del evento seleccionado
  const [movimientos, setMovimientos] = useState([]);
  const [loadingMovs, setLoadingMovs] = useState(false);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    const [evRes, tRes] = await Promise.all([
      supabase.from('eventos').select('*').order('anio', { ascending: false }).order('fecha_inicio', { ascending: false }),
      supabase.from('templos').select('*').order('nombre'),
    ]);
    setEventos(evRes.data || []);
    setTemplos(tRes.data || []);
    setLoading(false);
  };

  const mostrarMensaje = (txt, ok = true) => {
    setMensaje({ txt, ok });
    setTimeout(() => setMensaje(''), 5000);
  };

  // ── Abrir detalle de un evento ───────────────────────────
  const abrirDetalle = async (evento) => {
    setEventoActivo(evento);
    setLoadingMovs(true);
    const { data } = await supabase
      .from('movimientos')
      .select('*, templos(nombre)')
      .eq('evento_id', evento.id)
      .order('fecha');
    setMovimientos(data || []);
    setLoadingMovs(false);
  };

  // ── Guardar evento ───────────────────────────────────────
  const guardar = async (e) => {
    e.preventDefault();
    const datos = { ...form, updated_at: new Date().toISOString() };
    if (editandoId) {
      const { error } = await supabase.from('eventos').update(datos).eq('id', editandoId);
      if (error) return mostrarMensaje('Error: ' + error.message, false);
      mostrarMensaje('Evento actualizado');
    } else {
      const { error } = await supabase.from('eventos').insert({ ...datos, activo: true });
      if (error) return mostrarMensaje('Error: ' + error.message, false);
      mostrarMensaje('Evento creado');
    }
    setFormAbierto(false); setEditandoId(null);
    cargar();
  };

  const abrirEditar = (ev) => {
    setEditandoId(ev.id);
    setForm({ nombre: ev.nombre, tipo: ev.tipo, anio: ev.anio,
      fecha_inicio: ev.fecha_inicio || '', fecha_fin: ev.fecha_fin || '',
      descripcion: ev.descripcion || '' });
    setFormAbierto(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleActivo = async (ev) => {
    await supabase.from('eventos').update({ activo: !ev.activo }).eq('id', ev.id);
    cargar();
  };

  // ── Stats del evento activo ──────────────────────────────
  const stats = useMemo(() => {
    const ingresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((s,m) => s + m.monto, 0);
    const egresos  = movimientos.filter(m => m.tipo === 'egreso').reduce((s,m) => s + m.monto, 0);
    return { ingresos, egresos, saldo: ingresos - egresos };
  }, [movimientos]);

  // Barras por templo
  const porTemplo = useMemo(() => {
    const g = {};
    movimientos.forEach(m => {
      const t = m.templos?.nombre || 'Sin templo';
      if (!g[t]) g[t] = { templo: t, ingresos: 0, egresos: 0 };
      if (m.tipo === 'ingreso') g[t].ingresos += m.monto;
      else g[t].egresos += m.monto;
    });
    return Object.values(g).sort((a,b) => (b.ingresos+b.egresos)-(a.ingresos+a.egresos));
  }, [movimientos]);

  // Torta de egresos por concepto
  const tortaEgresos = useMemo(() => {
    const g = {};
    movimientos.filter(m => m.tipo === 'egreso').forEach(m => {
      g[m.concepto] = (g[m.concepto] || 0) + m.monto;
    });
    return Object.entries(g).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [movimientos]);

  // Torta de ingresos por concepto
  const tortaIngresos = useMemo(() => {
    const g = {};
    movimientos.filter(m => m.tipo === 'ingreso').forEach(m => {
      g[m.concepto] = (g[m.concepto] || 0) + m.monto;
    });
    return Object.entries(g).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [movimientos]);

  // Exportar CSV del evento
  const exportarCSV = () => {
    const data = movimientos.map(m => ({
      Fecha: fmtFecha(m.fecha?.split('T')[0]),
      Templo: m.templos?.nombre || '',
      Tipo: m.tipo,
      Concepto: m.concepto,
      Monto: m.monto,
      Detalle: m.detalle || '',
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob(['\ufeff'+csv], { type:'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${eventoActivo?.nombre?.replace(/\s+/g,'-')}.csv`;
    link.click();
  };

  // ── VISTA DETALLE ────────────────────────────────────────
  if (eventoActivo) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => { setEventoActivo(null); setMovimientos([]); }}
            className="btn-secondary flex items-center gap-2">
            <ArrowLeft size={18} /> Volver
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-navy">{eventoActivo.nombre}</h1>
            <p className="text-sm text-gray-500">
              {TIPOS_EVENTO.find(t => t.value === eventoActivo.tipo)?.label}
              {eventoActivo.fecha_inicio && ` · ${fmtFecha(eventoActivo.fecha_inicio)}`}
              {eventoActivo.fecha_fin && ` — ${fmtFecha(eventoActivo.fecha_fin)}`}
            </p>
          </div>
          <button onClick={exportarCSV} className="btn-secondary flex items-center gap-2">
            <FileText size={18} /> Exportar CSV
          </button>
        </div>

        {loadingMovs ? (
          <div className="card text-center text-gray-500 py-8">Cargando movimientos...</div>
        ) : (
          <>
            {/* Tarjetas resumen */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card bg-gradient-to-br from-green-50 to-green-100">
                <div className="flex items-center gap-3">
                  <TrendingUp className="text-green-600" size={36} />
                  <div>
                    <p className="text-xs text-gray-600">Total Ingresos</p>
                    <p className="text-2xl font-bold text-navy">{fmt(stats.ingresos)}</p>
                    <p className="text-xs text-gray-500">{movimientos.filter(m=>m.tipo==='ingreso').length} movimientos</p>
                  </div>
                </div>
              </div>
              <div className="card bg-gradient-to-br from-red-50 to-red-100">
                <div className="flex items-center gap-3">
                  <TrendingDown className="text-red-600" size={36} />
                  <div>
                    <p className="text-xs text-gray-600">Total Egresos</p>
                    <p className="text-2xl font-bold text-navy">{fmt(stats.egresos)}</p>
                    <p className="text-xs text-gray-500">{movimientos.filter(m=>m.tipo==='egreso').length} movimientos</p>
                  </div>
                </div>
              </div>
              <div className={`card bg-gradient-to-br ${stats.saldo >= 0 ? 'from-blue-50 to-blue-100' : 'from-orange-50 to-orange-100'}`}>
                <div className="flex items-center gap-3">
                  <DollarSign className={stats.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'} size={36} />
                  <div>
                    <p className="text-xs text-gray-600">Saldo del Evento</p>
                    <p className={`text-2xl font-bold ${stats.saldo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {stats.saldo >= 0 ? '+' : ''}{fmt(stats.saldo)}
                    </p>
                    <p className="text-xs text-gray-500">{stats.saldo >= 0 ? 'Superávit ✅' : 'Déficit ⚠️'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Gráfico Ingresos vs Egresos por templo */}
            {porTemplo.length > 0 && (
              <div className="card">
                <h2 className="text-xl font-bold text-navy mb-4">Ingresos y Egresos por Templo</h2>
                <ResponsiveContainer width="100%" height={Math.max(260, porTemplo.length * 50)}>
                  <BarChart data={porTemplo} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={n => `$${(n/1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="templo" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={v => fmt(v)} />
                    <Legend />
                    <Bar dataKey="ingresos" name="Ingresos" fill="#16a34a" radius={[0,4,4,0]} />
                    <Bar dataKey="egresos" name="Egresos" fill="#dc2626" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tortas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {tortaIngresos.length > 0 && (
                <div className="card">
                  <h2 className="text-lg font-bold text-navy mb-3">Ingresos por Concepto</h2>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={tortaIngresos} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                        {tortaIngresos.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              {tortaEgresos.length > 0 && (
                <div className="card">
                  <h2 className="text-lg font-bold text-navy mb-3">Egresos por Concepto</h2>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={tortaEgresos} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                        {tortaEgresos.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Tabla detallada */}
            <div className="card">
              <h2 className="text-xl font-bold text-navy mb-4">
                Movimientos del Evento <span className="text-sm font-normal text-gray-500">({movimientos.length})</span>
              </h2>
              {movimientos.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No hay movimientos asignados a este evento.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gold">
                        <th className="text-left p-2 text-navy font-bold">Fecha</th>
                        <th className="text-left p-2 text-navy font-bold">Templo</th>
                        <th className="text-left p-2 text-navy font-bold">Tipo</th>
                        <th className="text-left p-2 text-navy font-bold">Concepto</th>
                        <th className="text-right p-2 text-navy font-bold">Monto</th>
                        <th className="text-left p-2 text-navy font-bold">Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.map((m, i) => (
                        <tr key={m.id} className={`border-b hover:bg-gray-50 ${i%2===1?'bg-gray-50':''}`}>
                          <td className="p-2 text-xs whitespace-nowrap">{fmtFecha(m.fecha?.split('T')[0])}</td>
                          <td className="p-2 text-xs">{m.templos?.nombre || '—'}</td>
                          <td className="p-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${m.tipo==='ingreso'?'bg-green-500':'bg-red-500'}`}>
                              {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                            </span>
                          </td>
                          <td className="p-2 text-xs">{m.concepto}</td>
                          <td className={`p-2 text-right font-mono text-xs ${m.tipo==='ingreso'?'text-green-700':'text-red-700'}`}>
                            {m.tipo==='ingreso'?'+':'-'}{fmt(m.monto)}
                          </td>
                          <td className="p-2 text-xs text-gray-500 max-w-xs truncate">{m.detalle || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gold font-bold bg-gray-50">
                        <td colSpan={4} className="p-2 text-navy">TOTAL</td>
                        <td className="p-2 text-right font-mono text-sm">
                          <span className="text-green-700 block">+{fmt(stats.ingresos)}</span>
                          <span className="text-red-700 block">-{fmt(stats.egresos)}</span>
                          <span className={`block border-t mt-1 pt-1 ${stats.saldo>=0?'text-green-700':'text-red-700'}`}>{fmt(stats.saldo)}</span>
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── VISTA LISTA DE EVENTOS ───────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-navy">Eventos</h1>
          <p className="text-sm text-gray-600">Conferencias y congresos de la IEUP</p>
        </div>
        {puedeEditar && (
          <button onClick={() => { setEditandoId(null); setForm({ nombre:'', tipo:'conferencia-pastores', anio: new Date().getFullYear(), fecha_inicio:'', fecha_fin:'', descripcion:'' }); setFormAbierto(true); window.scrollTo({top:0,behavior:'smooth'}); }}
            className="btn-primary flex items-center gap-2">
            <Plus size={20} /> Nuevo Evento
          </button>
        )}
      </div>

      {mensaje && (
        <div className={`card ${mensaje.ok ? 'bg-green-50 border-l-4 border-green-500 text-green-800' : 'bg-red-50 border-l-4 border-red-500 text-red-800'}`}>
          {mensaje.txt}
        </div>
      )}

      {/* Formulario */}
      {formAbierto && puedeEditar && (
        <form onSubmit={guardar} className="card bg-blue-50 border-l-4 border-blue-500 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-navy">{editandoId ? 'Editar Evento' : 'Nuevo Evento'}</h2>
            <button type="button" onClick={() => { setFormAbierto(false); setEditandoId(null); }} className="text-gray-500 hover:text-gray-700"><X size={22}/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-navy mb-1">Nombre del evento *</label>
              <input type="text" value={form.nombre} onChange={e => setForm({...form, nombre:e.target.value})} placeholder="Ej: Conferencia IEUP 2027" className="input-field w-full" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-navy mb-1">Año *</label>
              <input type="number" value={form.anio} onChange={e => setForm({...form, anio:parseInt(e.target.value)})} className="input-field w-full" required />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-navy mb-1">Tipo *</label>
              <select value={form.tipo} onChange={e => setForm({...form, tipo:e.target.value})} className="input-field w-full" required>
                {TIPOS_EVENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-navy mb-1">Fecha inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={e => setForm({...form, fecha_inicio:e.target.value})} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs font-bold text-navy mb-1">Fecha fin</label>
              <input type="date" value={form.fecha_fin} onChange={e => setForm({...form, fecha_fin:e.target.value})} className="input-field w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-navy mb-1">Descripción (opcional)</label>
            <input type="text" value={form.descripcion} onChange={e => setForm({...form, descripcion:e.target.value})} placeholder="Notas adicionales sobre el evento" className="input-field w-full" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex items-center gap-2"><Save size={18}/>{editandoId ? 'Actualizar' : 'Crear evento'}</button>
            <button type="button" onClick={() => { setFormAbierto(false); setEditandoId(null); }} className="btn-secondary">Cancelar</button>
          </div>
        </form>
      )}

      {/* Lista de eventos */}
      {loading ? (
        <div className="card text-center text-gray-500 py-8">Cargando...</div>
      ) : eventos.length === 0 ? (
        <div className="card text-center text-gray-500 py-8">No hay eventos registrados.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {eventos.map(ev => {
            const color = TIPO_COLOR[ev.tipo] || '#6b7280';
            const tipoLabel = TIPOS_EVENTO.find(t => t.value === ev.tipo)?.label || ev.tipo;
            return (
              <div key={ev.id} className={`card border-l-4 cursor-pointer hover:shadow-lg transition-shadow ${!ev.activo ? 'opacity-50' : ''}`}
                style={{ borderColor: color }}
                onClick={() => ev.activo && abrirDetalle(ev)}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded text-white" style={{ backgroundColor: color }}>{ev.anio}</span>
                      <span className="text-xs text-gray-500">{tipoLabel}</span>
                    </div>
                    <h3 className="text-lg font-bold text-navy">{ev.nombre}</h3>
                    {(ev.fecha_inicio || ev.fecha_fin) && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                        <Calendar size={12} />
                        {ev.fecha_inicio && fmtFecha(ev.fecha_inicio)}
                        {ev.fecha_fin && ` — ${fmtFecha(ev.fecha_fin)}`}
                      </div>
                    )}
                    {ev.descripcion && <p className="text-xs text-gray-600 mt-1">{ev.descripcion}</p>}
                  </div>
                  {puedeEditar && (
                    <div className="flex gap-1 ml-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => abrirEditar(ev)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded" title="Editar"><Edit2 size={15}/></button>
                      <button onClick={() => toggleActivo(ev)} className={`p-1.5 rounded ${ev.activo ? 'text-orange-600 hover:bg-orange-100' : 'text-green-600 hover:bg-green-100'}`} title={ev.activo ? 'Desactivar' : 'Reactivar'}>{ev.activo ? <EyeOff size={15}/> : <Eye size={15}/>}</button>
                    </div>
                  )}
                </div>
                {ev.activo && (
                  <p className="text-xs text-blue-600 font-medium mt-2">Click para ver el detalle →</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
