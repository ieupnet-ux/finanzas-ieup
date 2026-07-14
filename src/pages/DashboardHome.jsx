import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';

// Traer TODOS los movimientos superando el límite de 1000 filas de Supabase
async function fetchTodosMovimientos(tipo = null) {
  const LOTE = 1000;
  let todos = [];
  let from = 0;
  while (true) {
    let q = supabase
      .from('movimientos')
      .select('*')
      .order('fecha', { ascending: true })
      .range(from, from + LOTE - 1);
    if (tipo) q = q.eq('tipo', tipo);
    const { data, error } = await q;
    if (error) { console.error('Error cargando movimientos:', error); break; }
    if (!data || data.length === 0) break;
    todos = todos.concat(data);
    if (data.length < LOTE) break;
    from += LOTE;
  }
  return todos;
}

import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, ListChecks, Filter, Download } from 'lucide-react';
import Papa from 'papaparse';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const COLORS = ['#FFD700', '#C41E3A', '#001f3f', '#D4AF37', '#22c55e', '#3b82f6', '#a855f7', '#f97316', '#14b8a6', '#ec4899'];
const SYMBOLS = { ARS: '$', USD: 'U$S', CLP: 'CLP $' };

const TIPOS_TRANSACCION = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'deposito', label: 'Depósito Bancario' },
  { value: 'extraccion', label: 'Extracción Bancaria' },
  { value: 'plazo-fijo', label: 'Plazo Fijo' },
  { value: 'billetera-virtual', label: 'Billetera Virtual' },
];

// Helper para cargar cajas dinámicas
async function fetchCajas() {
  const { data } = await supabase.from('cajas').select('*').eq('activo', true).order('orden');
  return data || [];
}

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


// Detectar movimientos de Saldo Inicial (apertura)
const esSaldoInicial = (m) => (m.concepto || '').trim().toLowerCase() === 'saldo inicial';

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
  const [cajas, setCajas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [moneda, setMoneda] = useState('ARS');
  const [periodo, setPeriodo] = useState('este-anio');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [temploFiltro, setTemploFiltro] = useState('');
  const [cajaFiltro, setCajaFiltro] = useState('');
  const [tipoTransFiltro, setTipoTransFiltro] = useState('');
  const [metricaTC, setMetricaTC] = useState('ingresos'); // gráfico Templo × Caja
  const [incluirSI, setIncluirSI] = useState(true); // incluir Saldo Inicial

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [movs, tempRes, cajasData] = await Promise.all([
        fetchTodosMovimientos(),
        supabase.from('templos').select('*'),
        fetchCajas(),
      ]);
      setMovimientos(movs);
      setTemplos(tempRes.data || []);
      setCajas(cajasData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // UBICACIONES dinámico
  const UBICACIONES = useMemo(
    () => cajas.map(c => ({ value: c.valor, label: c.nombre })),
    [cajas]
  );

  const monedasDisponibles = useMemo(() => {
    const set = new Set(movimientos.map(m => m.moneda || 'ARS'));
    return ['ARS', 'USD', 'CLP'].filter(m => set.has(m));
  }, [movimientos]);

  // Movimientos con TODOS los filtros aplicados
  const movsFiltradosBase = useMemo(() => {
    const [ini, fin] = rangoPeriodo(periodo, desde, hasta);
    return movimientos.filter(m => {
      if ((m.moneda || 'ARS') !== moneda) return false;
      const f = parseFechaLocal(m.fecha);
      if (f < ini || f > fin) return false;
      if (temploFiltro && m.templo_id !== temploFiltro) return false;
      if (cajaFiltro && (m.ubicacion || 'general') !== cajaFiltro) return false;
      if (tipoTransFiltro && (m.tipo_transaccion || 'efectivo') !== tipoTransFiltro) return false;
      return true;
    });
  }, [movimientos, moneda, periodo, desde, hasta, temploFiltro, cajaFiltro, tipoTransFiltro]);

  // Aplicar (o no) el Saldo Inicial según el interruptor
  const movsFiltrados = useMemo(
    () => incluirSI ? movsFiltradosBase : movsFiltradosBase.filter(m => !esSaldoInicial(m)),
    [movsFiltradosBase, incluirSI]
  );

  // Monto de Saldo Inicial presente en el período (para informar al usuario)
  const totalSaldoInicial = useMemo(
    () => movsFiltradosBase.filter(esSaldoInicial).reduce((s, m) => s + (m.monto || 0), 0),
    [movsFiltradosBase]
  );

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

  // Distribución por MEDIO DE PAGO (tipo_transaccion)
  const distPorTipo = (tipo) => {
    const porTipo = {};
    movsFiltrados.forEach(m => {
      if (m.tipo !== tipo) return;
      const t = m.tipo_transaccion || 'efectivo';
      const label = TIPOS_TRANSACCION.find(x => x.value === t)?.label || t;
      porTipo[label] = (porTipo[label] || 0) + (m.monto || 0);
    });
    return Object.entries(porTipo).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };
  const tipoIngresos = useMemo(() => distPorTipo('ingreso'), [movsFiltrados]);
  const tipoEgresos = useMemo(() => distPorTipo('egreso'), [movsFiltrados]);

  // Caja × Medio de Pago (apilado): cada caja es una barra, segmentos por tipo de transacción
  const [metricaCT, setMetricaCT] = useState('ingresos');
  const cajaPorTipo = useMemo(() => {
    const tipoTarget = metricaCT === 'ingresos' ? 'ingreso' : 'egreso';
    const porCaja = {};
    const tiposSet = new Set();
    movsFiltrados.forEach(m => {
      if (m.tipo !== tipoTarget) return;
      const u = m.ubicacion || 'general';
      const cajaLabel = UBICACIONES.find(x => x.value === u)?.label || u;
      const t = m.tipo_transaccion || 'efectivo';
      const tipoLabel = TIPOS_TRANSACCION.find(x => x.value === t)?.label || t;
      tiposSet.add(tipoLabel);
      if (!porCaja[cajaLabel]) porCaja[cajaLabel] = { caja: cajaLabel, __total: 0 };
      porCaja[cajaLabel][tipoLabel] = (porCaja[cajaLabel][tipoLabel] || 0) + (m.monto || 0);
      porCaja[cajaLabel].__total += (m.monto || 0);
    });
    const data = Object.values(porCaja).sort((a, b) => b.__total - a.__total);
    return { data, tipos: [...tiposSet].sort() };
  }, [movsFiltrados, metricaCT]);

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

  // Desglose de cada templo por sus cajas (para gráfico apilado)
  const temploCaja = useMemo(() => {
    const porTemplo = {};
    const cajasSet = new Set();
    movsFiltrados.forEach(m => {
      if (m.tipo !== (metricaTC === 'ingresos' ? 'ingreso' : 'egreso')) return;
      const nombre = m.templo_id
        ? (templos.find(t => t.id === m.templo_id)?.nombre || 'Desconocido')
        : 'Sin templo';
      const u = m.ubicacion || 'general';
      const cajaLabel = UBICACIONES.find(x => x.value === u)?.label || u;
      cajasSet.add(cajaLabel);
      if (!porTemplo[nombre]) porTemplo[nombre] = { templo: nombre, __total: 0 };
      porTemplo[nombre][cajaLabel] = (porTemplo[nombre][cajaLabel] || 0) + (m.monto || 0);
      porTemplo[nombre].__total += (m.monto || 0);
    });
    const data = Object.values(porTemplo).sort((a, b) => b.__total - a.__total);
    const cajas = [...cajasSet].sort();
    return { data, cajas };
  }, [movsFiltrados, templos, metricaTC]);

  // Resumen de saldos: cada templo desglosado por sus cajas
  const resumenTemploCaja = useMemo(() => {
    const grupos = {};
    movsFiltrados.forEach(m => {
      const nombre = m.templo_id
        ? (templos.find(t => t.id === m.templo_id)?.nombre || 'Desconocido')
        : 'Sin templo';
      const u = m.ubicacion || 'general';
      const cajaLabel = UBICACIONES.find(x => x.value === u)?.label || u;
      if (!grupos[nombre]) grupos[nombre] = { templo: nombre, cajas: {}, ingresos: 0, egresos: 0 };
      if (!grupos[nombre].cajas[cajaLabel]) grupos[nombre].cajas[cajaLabel] = { ingresos: 0, egresos: 0 };
      const monto = m.monto || 0;
      if (m.tipo === 'ingreso') {
        grupos[nombre].ingresos += monto;
        grupos[nombre].cajas[cajaLabel].ingresos += monto;
      } else {
        grupos[nombre].egresos += monto;
        grupos[nombre].cajas[cajaLabel].egresos += monto;
      }
    });
    return Object.values(grupos)
      .map(g => ({
        ...g,
        saldo: g.ingresos - g.egresos,
        cajasArr: Object.entries(g.cajas)
          .map(([caja, v]) => ({ caja, ...v, saldo: v.ingresos - v.egresos }))
          .sort((a, b) => b.saldo - a.saldo),
      }))
      .sort((a, b) => b.saldo - a.saldo);
  }, [movsFiltrados, templos]);

  const totalGeneral = useMemo(() => {
    let ingresos = 0, egresos = 0;
    resumenTemploCaja.forEach(g => { ingresos += g.ingresos; egresos += g.egresos; });
    return { ingresos, egresos, saldo: ingresos - egresos };
  }, [resumenTemploCaja]);

  const exportarResumenTemploCaja = () => {
    const filas = [];
    resumenTemploCaja.forEach(g => {
      g.cajasArr.forEach(cj => {
        filas.push({
          Templo: g.templo, Caja: cj.caja,
          Ingresos: cj.ingresos, Egresos: cj.egresos, Saldo: cj.saldo,
        });
      });
      filas.push({
        Templo: `TOTAL ${g.templo.toUpperCase()}`, Caja: '',
        Ingresos: g.ingresos, Egresos: g.egresos, Saldo: g.saldo,
      });
    });
    filas.push({
      Templo: 'TOTAL GENERAL', Caja: '',
      Ingresos: totalGeneral.ingresos, Egresos: totalGeneral.egresos, Saldo: totalGeneral.saldo,
    });
    const csv = Papa.unparse(filas);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `saldos-templo-caja-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
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
          <div>
            <label className="block text-xs font-bold text-navy mb-1">Medio de Pago</label>
            <select value={tipoTransFiltro} onChange={(e) => setTipoTransFiltro(e.target.value)} className="input-field w-full">
              <option value="">Todos</option>
              {TIPOS_TRANSACCION.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
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
        <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-blue-200">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={incluirSI}
              onChange={(e) => setIncluirSI(e.target.checked)}
              className="w-4 h-4 accent-[#001f3f]"
            />
            <span className="text-sm font-bold text-navy">Incluir Saldo Inicial</span>
          </label>
          {totalSaldoInicial > 0 && (
            <span className="text-sm text-gray-700">
              Saldo Inicial en el período: <strong>{fmt(totalSaldoInicial)}</strong>
              {!incluirSI && ' (excluido de los cálculos)'}
            </span>
          )}
        </div>
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

          {/* TEMPLO DESGLOSADO POR CAJAS (APILADO) */}
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-navy">Templos desglosados por Caja</h2>
              <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setMetricaTC('ingresos')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition ${metricaTC === 'ingresos' ? 'bg-green-600 text-white shadow' : 'text-navy hover:bg-gray-200'}`}
                >
                  Ingresos
                </button>
                <button
                  onClick={() => setMetricaTC('egresos')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition ${metricaTC === 'egresos' ? 'bg-red-600 text-white shadow' : 'text-navy hover:bg-gray-200'}`}
                >
                  Egresos
                </button>
              </div>
            </div>
            {temploCaja.data.length === 0 ? (
              <p className="text-gray-500 text-center py-12">Sin datos en el período</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={Math.max(280, temploCaja.data.length * 55)}>
                  <BarChart data={temploCaja.data} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={fmtCompacto} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="templo" width={90} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => fmt(v)} />
                    <Legend />
                    {temploCaja.cajas.map((caja, i) => (
                      <Bar key={caja} dataKey={caja} stackId="tc" fill={COLORS[i % COLORS.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-xs text-gray-500 mt-2">
                  Cada barra es un templo; los segmentos de color muestran cuánto aporta cada caja. Pasa el mouse sobre un segmento para ver el detalle.
                </p>
              </>
            )}
          </div>
          {/* RESUMEN DE SALDOS: TEMPLO × CAJA */}
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-navy">Resumen de Saldos por Templo y Caja</h2>
              <button onClick={exportarResumenTemploCaja} className="btn-primary flex items-center gap-2">
                <Download size={18} /> Exportar CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gold">
                    <th className="text-left p-3 text-navy font-bold">Templo / Caja</th>
                    <th className="text-right p-3 text-navy font-bold">Ingresos</th>
                    <th className="text-right p-3 text-navy font-bold">Egresos</th>
                    <th className="text-right p-3 text-navy font-bold">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenTemploCaja.map((g) => (
                    <FragmentoTemplo key={g.templo} grupo={g} fmt={fmt} />
                  ))}
                  <tr className="bg-navy text-white font-bold">
                    <td className="p-3">TOTAL GENERAL</td>
                    <td className="p-3 text-right">{fmt(totalGeneral.ingresos)}</td>
                    <td className="p-3 text-right">{fmt(totalGeneral.egresos)}</td>
                    <td className="p-3 text-right">{fmt(totalGeneral.saldo)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          {/* MEDIO DE PAGO */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PieCard titulo="Ingresos por Medio de Pago" data={tipoIngresos} fmt={fmt} />
            <PieCard titulo="Egresos por Medio de Pago" data={tipoEgresos} fmt={fmt} />
          </div>

          {/* CAJA × MEDIO DE PAGO (APILADO) */}
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-navy">Cajas desglosadas por Medio de Pago</h2>
              <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setMetricaCT('ingresos')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition ${metricaCT === 'ingresos' ? 'bg-green-600 text-white shadow' : 'text-navy hover:bg-gray-200'}`}
                >
                  Ingresos
                </button>
                <button
                  onClick={() => setMetricaCT('egresos')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition ${metricaCT === 'egresos' ? 'bg-red-600 text-white shadow' : 'text-navy hover:bg-gray-200'}`}
                >
                  Egresos
                </button>
              </div>
            </div>
            {cajaPorTipo.data.length === 0 ? (
              <p className="text-gray-500 text-center py-12">Sin datos en el período</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={Math.max(280, cajaPorTipo.data.length * 45)}>
                  <BarChart data={cajaPorTipo.data} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={fmtCompacto} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="caja" width={110} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => fmt(v)} />
                    <Legend />
                    {cajaPorTipo.tipos.map((tipo, i) => (
                      <Bar key={tipo} dataKey={tipo} stackId="ct" fill={COLORS[i % COLORS.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-xs text-gray-500 mt-2">
                  Cada barra es una caja; los segmentos de color indican qué proporción entró como efectivo, billetera virtual, etc.
                </p>
              </>
            )}
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


function FragmentoTemplo({ grupo, fmt }) {
  return (
    <>
      <tr className="bg-gold bg-opacity-20 font-bold">
        <td className="p-3 text-navy">{grupo.templo}</td>
        <td className="p-3 text-right text-green-700">{fmt(grupo.ingresos)}</td>
        <td className="p-3 text-right text-red-600">{fmt(grupo.egresos)}</td>
        <td className={`p-3 text-right ${grupo.saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(grupo.saldo)}</td>
      </tr>
      {grupo.cajasArr.map((cj) => (
        <tr key={cj.caja} className="border-b hover:bg-gray-50">
          <td className="p-3 pl-8 text-gray-700">↳ {cj.caja}</td>
          <td className="p-3 text-right text-green-700">{fmt(cj.ingresos)}</td>
          <td className="p-3 text-right text-red-600">{fmt(cj.egresos)}</td>
          <td className={`p-3 text-right font-bold ${cj.saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(cj.saldo)}</td>
        </tr>
      ))}
    </>
  );
}
