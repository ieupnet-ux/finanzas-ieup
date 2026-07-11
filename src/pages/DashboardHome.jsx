import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, ListChecks, Filter } from 'lucide-react';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const COLORS = ['#FFD700', '#C41E3A', '#001f3f', '#D4AF37', '#22c55e', '#3b82f6', '#a855f7', '#f97316', '#14b8a6', '#ec4899'];
const SYMBOLS = { ARS: '$', USD: 'U$S', CLP: 'CLP $' };

const UBICACIONES = [
  { value: 'adolescentes', label: 'Adolescentes' },
  { value: 'ciclistas', label: 'Ciclistas' },
  { value: 'coro', label: 'Coro' },
  { value: 'coro-juvenil', label: 'Coro Juvenil' },
  { value: 'dorcas', label: 'Dorcas' },
  { value: 'general', label: 'General' },
  { value: 'jovenes', label: 'Jóvenes' },
  { value: 'ninos', label: 'Niños' },
  { value: 'porteras', label: 'Porteras' },
  { value: 'porteros', label: 'Porteros' },
  { value: 'emisora', label: 'Emisora' },
  { value: 'cajas', label: 'Cajas' },
  { value: 'reposteria', label: 'Repostería' },
  { value: 'secretaria', label: 'Secretaría' },
  { value: 'banco-nacion', label: 'Banco Nación' },
  { value: 'banco-macro', label: 'Banco Macro' },
  { value: 'plazo-fijo', label: 'Plazo Fijo' },
  { value: 'mercado-pago', label: 'Mercado Pago' },
  { value: 'billetera-virtual', label: 'Billetera Virtual' },
  { value: 'otro', label: 'Otro' },
];

const PERIODOS = [
  { value: 'este-mes', label: 'Este mes' },
  { value: 'mes-anterior', label: 'Mes anterior' },
  { value: 'ultimos-3-meses', label: 'Últimos 3 meses' },
  { value: 'este-anio', label: 'Este año' },
  { value: 'todo', label: 'Todo' },
  { value: 'personalizado', label: 'Personalizado' },
];


// Parsear fecha como fecha LOCAL (evita el corrimiento de un día por zona horaria)
function parseFechaLocal(fecha) {
  if (!fecha) return new Date(0);
  const [y, m, d] = String(fecha).split('T')[0].split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function rangoPeriodo(periodo, desde, hasta) {
  const hoy = new Date();
  const inicioDia = (d) => { d.setHours(0, 0, 0, 0); return d; };
  const finDia = (d) => { d.setHours(23, 59, 59, 999); return d; };
  switch (periodo) {
    case 'este-mes':
      return [inicioDia(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), finDia(new Date(hoy))];
    case 'mes-anterior':
      return [
        inicioDia(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
        finDia(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
      ];
    case 'ultimos-3-meses':
      return [inicioDia(new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1)), finDia(new Date(hoy))];
    case 'este-anio':
      return [inicioDia(new Date(hoy.getFullYear(), 0, 1)), finDia(new Date(hoy))];
    case 'personalizado':
      return [
        desde ? inicioDia(new Date(desde + 'T00:00:00')) : new Date(2000, 0, 1),
        hasta ? finDia(new Date(hasta + 'T00:00:00')) : finDia(new Date(hoy)),
      ];
    default: // todo
      return [new Date(2000, 0, 1), finDia(new Date(hoy))];
  }
}

export default function DashboardHome() {
  const [movimientos, setMovimientos] = useState([]);
  const [templos, setTemplos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [moneda, setMoneda] = useState('ARS');
  const [periodo, setPeriodo] = useState('este-anio');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [temploFiltro, setTemploFiltro] = useState('');
  const [cajaFiltro, setCajaFiltro] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [movRes, tempRes] = await Promise.all([
        supabase.from('movimientos').select('*').order('fecha', { ascending: true }),
        supabase.from('templos').select('*'),
      ]);
      setMovimientos(movRes.data || []);
      setTemplos(tempRes.data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const monedasDisponibles = useMemo(() => {
    const set = new Set(movimientos.map(m => m.moneda || 'ARS'));
    return ['ARS', 'USD', 'CLP'].filter(m => set.has(m));
  }, [movimientos]);

  // Movimientos con TODOS los filtros aplicados
  const movsFiltrados = useMemo(() => {
    const [ini, fin] = rangoPeriodo(periodo, desde, hasta);
    return movimientos.filter(m => {
      if ((m.moneda || 'ARS') !== moneda) return false;
      const f = parseFechaLocal(m.fecha);
      if (f < ini || f > fin) return false;
      if (temploFiltro && m.templo_id !== temploFiltro) return false;
      if (cajaFiltro && (m.ubicacion || 'general') !== cajaFiltro) return false;
      return true;
    });
  }, [movimientos, moneda, periodo, desde, hasta, temploFiltro, cajaFiltro]);

  // Totales del período filtrado
  const stats = useMemo(() => {
    let ingresos = 0, egresos = 0;
    movsFiltrados.forEach(m => {
      if (m.tipo === 'ingreso') ingresos += m.monto || 0;
      else egresos += m.monto || 0;
    });
    return { ingresos, egresos, saldo: ingresos - egresos, cantidad: movsFiltrados.length };
  }, [movsFiltrados]);

  // Evolución: diaria si el rango es corto, mensual si es largo
  const evolucion = useMemo(() => {
    const [ini, fin] = rangoPeriodo(periodo, desde, hasta);
    const dias = (fin - ini) / (1000 * 60 * 60 * 24);
    const porMes = dias > 62;
    const grouped = {};
    movsFiltrados.forEach(m => {
      const f = parseFechaLocal(m.fecha);
      const key = porMes
        ? `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`
        : m.fecha.split('T')[0];
      const label = porMes ? `${MESES[f.getMonth()]} ${String(f.getFullYear()).slice(2)}` : key.slice(5);
      if (!grouped[key]) grouped[key] = { key, label, ingresos: 0, egresos: 0 };
      if (m.tipo === 'ingreso') grouped[key].ingresos += m.monto || 0;
      else grouped[key].egresos += m.monto || 0;
    });
    return Object.keys(grouped).sort().map(k => grouped[k]);
  }, [movsFiltrados, periodo, desde, hasta]);

  // Distribución por concepto (ingresos y egresos)
  const distribucion = (tipo) => {
    const porConcepto = {};
    movsFiltrados.forEach(m => {
      if (m.tipo !== tipo) return;
      const c = m.concepto || 'Sin concepto';
      porConcepto[c] = (porConcepto[c] || 0) + (m.monto || 0);
    });
    const ordenado = Object.entries(porConcepto)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    if (ordenado.length > 7) {
      const top = ordenado.slice(0, 7);
      top.push({ name: 'Otros', value: ordenado.slice(7).reduce((s, x) => s + x.value, 0) });
      return top;
    }
    return ordenado;
  };
  const distIngresos = useMemo(() => distribucion('ingreso'), [movsFiltrados]);
  const distEgresos = useMemo(() => distribucion('egreso'), [movsFiltrados]);

  // Ingresos vs Egresos por Templo
  const porTemplo = useMemo(() => {
    const grouped = {};
    movsFiltrados.forEach(m => {
      const nombre = m.templo_id
        ? (templos.find(t => t.id === m.templo_id)?.nombre || 'Desconocido')
        : 'Sin templo';
      if (!grouped[nombre]) grouped[nombre] = { templo: nombre, ingresos: 0, egresos: 0 };
      if (m.tipo === 'ingreso') grouped[nombre].ingresos += m.monto || 0;
      else grouped[nombre].egresos += m.monto || 0;
    });
    return Object.values(grouped).sort((a, b) => b.ingresos - a.ingresos);
  }, [movsFiltrados, templos]);

  // Saldo por Caja
  const porCaja = useMemo(() => {
    const grouped = {};
    movsFiltrados.forEach(m => {
      const u = m.ubicacion || 'general';
      const label = UBICACIONES.find(x => x.value === u)?.label || u;
      if (!grouped[label]) grouped[label] = { caja: label, ingresos: 0, egresos: 0, saldo: 0 };
      if (m.tipo === 'ingreso') grouped[label].ingresos += m.monto || 0;
      else grouped[label].egresos += m.monto || 0;
      grouped[label].saldo = grouped[label].ingresos - grouped[label].egresos;
    });
    return Object.values(grouped).sort((a, b) => b.saldo - a.saldo);
  }, [movsFiltrados]);

  const fmt = (n) =>
    `${SYMBOLS[moneda] || '$'} ${(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtCompacto = (n) => {
    if (Math.abs(n) >= 1000000) return `${(n / 1000000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`;
    if (Math.abs(n) >= 1000) return `${(n / 1000).toLocaleString('es-AR', { maximumFractionDigits: 0 })}k`;
    return n.toString();
  };

  const limpiarFiltros = () => {
    setPeriodo('este-anio');
    setDesde('');
    setHasta('');
    setTemploFiltro('');
    setCajaFiltro('');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img src="/logo-navy.png" alt="IEUP" className="w-16 h-16" />
          <div>
            <h1 className="text-4xl font-bold text-navy mb-2">Dashboard Finanzas</h1>
            <p className="text-gray-600">
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        {monedasDisponibles.length > 1 && (
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            {monedasDisponibles.map((m) => (
              <button
                key={m}
                onClick={() => setMoneda(m)}
                className={`px-4 py-2 rounded-md text-sm font-bold transition ${moneda === m ? 'bg-navy text-white shadow' : 'text-navy hover:bg-gray-200'}`}
              >
                {m === 'ARS' && '🇦🇷 ARS'}
                {m === 'USD' && '🇺🇸 USD'}
                {m === 'CLP' && '🇨🇱 CLP'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* BARRA DE FILTROS */}
      <div className="card bg-blue-50 border-l-4 border-blue-500">
        <h2 className="text-lg font-bold text-navy mb-3 flex items-center gap-2">
          <Filter size={20} /> Filtros
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-navy mb-1">Período</label>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="input-field w-full">
              {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-navy mb-1">Templo</label>
            <select value={temploFiltro} onChange={(e) => setTemploFiltro(e.target.value)} className="input-field w-full">
              <option value="">Todos los templos</option>
              {templos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-navy mb-1">Caja / Ubicación</label>
            <select value={cajaFiltro} onChange={(e) => setCajaFiltro(e.target.value)} className="input-field w-full">
              <option value="">Todas las cajas</option>
              {UBICACIONES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={limpiarFiltros} className="btn-secondary w-full">Limpiar filtros</button>
          </div>
        </div>
        {periodo === 'personalizado' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs font-bold text-navy mb-1">Desde</label>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs font-bold text-navy mb-1">Hasta</label>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="input-field w-full" />
            </div>
          </div>
        )}
      </div>

      {/* TARJETAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Ingresos" amount={fmt(stats.ingresos)} color="bg-green-100" textColor="text-green-800" />
        <StatCard icon={TrendingDown} label="Egresos" amount={fmt(stats.egresos)} color="bg-red-100" textColor="text-red-800" />
        <StatCard icon={Wallet} label="Saldo" amount={fmt(stats.saldo)} color="bg-gold bg-opacity-20" textColor="text-oro" />
        <StatCard icon={ListChecks} label="Movimientos" amount={stats.cantidad.toLocaleString('es-AR')} color="bg-navy bg-opacity-20" textColor="text-navy" />
      </div>

      {loading ? (
        <div className="card text-center text-gray-500 py-12">Cargando datos...</div>
      ) : movsFiltrados.length === 0 ? (
        <div className="card text-center text-gray-500 py-12">
          No hay movimientos con los filtros seleccionados
        </div>
      ) : (
        <>
          {/* EVOLUCIÓN */}
          <div className="card">
            <h2 className="text-xl font-bold text-navy mb-4">Evolución del Período</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolucion} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#666" tick={{ fontSize: 12 }} />
                <YAxis stroke="#666" tickFormatter={fmtCompacto} tick={{ fontSize: 12 }} width={55} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Legend />
                <Line type="monotone" dataKey="ingresos" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="egresos" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* DISTRIBUCIONES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PieCard titulo="Ingresos por Concepto" data={distIngresos} fmt={fmt} />
            <PieCard titulo="Egresos por Concepto" data={distEgresos} fmt={fmt} />
          </div>

          {/* POR TEMPLO Y POR CAJA */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="text-xl font-bold text-navy mb-4">Ingresos vs Egresos por Templo</h2>
              <ResponsiveContainer width="100%" height={Math.max(250, porTemplo.length * 45)}>
                <BarChart data={porTemplo} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={fmtCompacto} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="templo" width={90} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="ingresos" fill="#22c55e" radius={[0, 6, 6, 0]} />
                  <Bar dataKey="egresos" fill="#ef4444" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h2 className="text-xl font-bold text-navy mb-4">Saldo por Caja</h2>
              <ResponsiveContainer width="100%" height={Math.max(250, porCaja.length * 40)}>
                <BarChart data={porCaja} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={fmtCompacto} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="caja" width={110} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Bar dataKey="saldo" radius={[0, 6, 6, 0]}>
                    {porCaja.map((entry, index) => (
                      <Cell key={index} fill={entry.saldo >= 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PieCard({ titulo, data, fmt }) {
  return (
    <div className="card">
      <h2 className="text-xl font-bold text-navy mb-4">{titulo}</h2>
      {data.length === 0 ? (
        <p className="text-gray-500 text-center py-12">Sin datos en el período</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data} cx="50%" cy="50%" outerRadius={90}
              dataKey="value" nameKey="name"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={{ strokeWidth: 1 }}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => fmt(v)} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, amount, color, textColor }) {
  return (
    <div className={`${color} rounded-lg p-6 ${textColor}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{label}</p>
          <p className="text-2xl font-bold mt-2">{amount}</p>
        </div>
        <Icon size={32} className="opacity-50" />
      </div>
    </div>
  );
}
