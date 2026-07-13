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

import { Download, Filter } from 'lucide-react';
import Papa from 'papaparse';

const SYMBOLS = { ARS: '$', USD: 'U$S', CLP: 'CLP $' };

const LABELS = {
  'adolescentes': 'Adolescentes', 'ciclistas': 'Ciclistas', 'coro': 'Coro',
  'coro-juvenil': 'Coro Juvenil', 'dorcas': 'Dorcas', 'general': 'General',
  'jovenes': 'Jóvenes', 'ninos': 'Niños', 'porteras': 'Porteras',
  'porteros': 'Porteros', 'emisora': 'Emisora', 'cajas': 'Cajas',
  'reposteria': 'Repostería', 'secretaria': 'Secretaría',
  'kiosco': 'Kiosco', 'comedor': 'Comedor', 'libreria': 'Librería',
  'banco-nacion': 'Banco Nación', 'banco-macro': 'Banco Macro',
  'plazo-fijo': 'Plazo Fijo', 'mercado-pago': 'Mercado Pago',
  'billetera-virtual': 'Billetera Virtual', 'otro': 'Otro',
};

const TIPOS_TRANSACCION = {
  'efectivo': 'Efectivo', 'deposito': 'Depósito Bancario',
  'extraccion': 'Extracción Bancaria', 'plazo-fijo': 'Plazo Fijo',
  'billetera-virtual': 'Billetera Virtual',
};

const PERIODOS = [
  { value: 'este-mes', label: 'Este mes' },
  { value: 'mes-anterior', label: 'Mes anterior' },
  { value: 'ultimos-3-meses', label: 'Últimos 3 meses' },
  { value: 'este-anio', label: 'Este año' },
  { value: 'anio-anterior', label: 'Año anterior' },
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
      return [inicioDia(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)), finDia(new Date(hoy.getFullYear(), hoy.getMonth(), 0))];
    case 'ultimos-3-meses':
      return [inicioDia(new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1)), finDia(new Date(hoy))];
    case 'este-anio':
      return [inicioDia(new Date(hoy.getFullYear(), 0, 1)), finDia(new Date(hoy))];
    case 'anio-anterior':
      return [inicioDia(new Date(hoy.getFullYear() - 1, 0, 1)), finDia(new Date(hoy.getFullYear() - 1, 11, 31))];
    case 'personalizado':
      return [
        desde ? inicioDia(new Date(desde + 'T00:00:00')) : new Date(2000, 0, 1),
        hasta ? finDia(new Date(hasta + 'T00:00:00')) : finDia(new Date(hoy)),
      ];
    default:
      return [new Date(2000, 0, 1), finDia(new Date(hoy))];
  }
}

export default function Reportes() {
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
  const [tipoFiltro, setTipoFiltro] = useState(''); // ingreso / egreso / ''
  const [conceptoFiltro, setConceptoFiltro] = useState('');
  const [incluirSI, setIncluirSI] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [movs, tempRes] = await Promise.all([
        fetchTodosMovimientos(),
        supabase.from('templos').select('*'),
      ]);
      setMovimientos(movs.reverse()); // más recientes primero
      setTemplos(tempRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const monedasDisponibles = useMemo(() => {
    const set = new Set(movimientos.map(m => m.moneda || 'ARS'));
    return ['ARS', 'USD', 'CLP'].filter(m => set.has(m));
  }, [movimientos]);

  const conceptosDisponibles = useMemo(() => {
    const set = new Set(movimientos.map(m => m.concepto).filter(Boolean));
    return [...set].sort();
  }, [movimientos]);

  const filtrados = useMemo(() => {
    const [ini, fin] = rangoPeriodo(periodo, desde, hasta);
    return movimientos.filter(m => {
      if ((m.moneda || 'ARS') !== moneda) return false;
      const f = parseFechaLocal(m.fecha);
      if (f < ini || f > fin) return false;
      if (temploFiltro && m.templo_id !== temploFiltro) return false;
      if (cajaFiltro && (m.ubicacion || 'general') !== cajaFiltro) return false;
      if (tipoFiltro && m.tipo !== tipoFiltro) return false;
      if (conceptoFiltro && m.concepto !== conceptoFiltro) return false;
      if (!incluirSI && esSaldoInicial(m)) return false;
      return true;
    });
  }, [movimientos, moneda, periodo, desde, hasta, temploFiltro, cajaFiltro, tipoFiltro, conceptoFiltro, incluirSI]);

  const stats = useMemo(() => {
    let ingresos = 0, egresos = 0;
    filtrados.forEach(m => {
      if (m.tipo === 'ingreso') ingresos += m.monto || 0;
      else egresos += m.monto || 0;
    });
    return { ingresos, egresos, saldo: ingresos - egresos };
  }, [filtrados]);

  // Resumen por concepto
  const resumenConcepto = useMemo(() => {
    const g = {};
    filtrados.forEach(m => {
      const c = m.concepto || 'Sin concepto';
      if (!g[c]) g[c] = { concepto: c, ingresos: 0, egresos: 0 };
      if (m.tipo === 'ingreso') g[c].ingresos += m.monto || 0;
      else g[c].egresos += m.monto || 0;
    });
    return Object.values(g).sort((a, b) => (b.ingresos + b.egresos) - (a.ingresos + a.egresos));
  }, [filtrados]);

  // Resumen por templo
  const resumenTemplo = useMemo(() => {
    const g = {};
    filtrados.forEach(m => {
      const nombre = m.templo_id
        ? (templos.find(t => t.id === m.templo_id)?.nombre || 'Desconocido')
        : 'Sin templo';
      if (!g[nombre]) g[nombre] = { templo: nombre, ingresos: 0, egresos: 0 };
      if (m.tipo === 'ingreso') g[nombre].ingresos += m.monto || 0;
      else g[nombre].egresos += m.monto || 0;
    });
    return Object.values(g).sort((a, b) => (b.ingresos - b.egresos) - (a.ingresos - a.egresos));
  }, [filtrados, templos]);

  // Resumen por caja
  const resumenCaja = useMemo(() => {
    const g = {};
    filtrados.forEach(m => {
      const u = m.ubicacion || 'general';
      const label = LABELS[u] || u;
      if (!g[label]) g[label] = { caja: label, ingresos: 0, egresos: 0 };
      if (m.tipo === 'ingreso') g[label].ingresos += m.monto || 0;
      else g[label].egresos += m.monto || 0;
    });
    return Object.values(g).sort((a, b) => (b.ingresos - b.egresos) - (a.ingresos - a.egresos));
  }, [filtrados]);

  const fmt = (n) =>
    `${SYMBOLS[moneda] || '$'} ${(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const nombreTemplo = (id) => id ? (templos.find(t => t.id === id)?.nombre || '—') : '—';

  const exportarCSV = () => {
    const data = filtrados.map(m => ({
      Fecha: parseFechaLocal(m.fecha).toLocaleDateString('es-ES'),
      Tipo: m.tipo === 'ingreso' ? 'INGRESO' : 'EGRESO',
      Concepto: m.concepto,
      Monto: m.monto,
      Moneda: m.moneda || 'ARS',
      'Tipo Transacción': TIPOS_TRANSACCION[m.tipo_transaccion] || '—',
      Caja: LABELS[m.ubicacion] || m.ubicacion || '—',
      Templo: nombreTemplo(m.templo_id),
      Detalle: m.detalle || '—',
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte-${periodo}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const limpiarFiltros = () => {
    setPeriodo('este-anio'); setDesde(''); setHasta('');
    setTemploFiltro(''); setCajaFiltro(''); setTipoFiltro(''); setConceptoFiltro('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-navy mb-2">Reportes Financieros</h1>
          <p className="text-gray-600">Análisis detallado con filtros combinables</p>
        </div>
        <div className="flex gap-3">
          {monedasDisponibles.length > 1 && (
            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
              {monedasDisponibles.map((m) => (
                <button
                  key={m}
                  onClick={() => setMoneda(m)}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition ${moneda === m ? 'bg-navy text-white shadow' : 'text-navy hover:bg-gray-200'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          <button onClick={exportarCSV} className="btn-primary flex items-center gap-2">
            <Download size={20} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* FILTROS */}
      <div className="card bg-blue-50 border-l-4 border-blue-500">
        <h2 className="text-lg font-bold text-navy mb-3 flex items-center gap-2">
          <Filter size={20} /> Filtros
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-bold text-navy mb-1">Período</label>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="input-field w-full">
              {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-navy mb-1">Templo</label>
            <select value={temploFiltro} onChange={(e) => setTemploFiltro(e.target.value)} className="input-field w-full">
              <option value="">Todos</option>
              {templos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-navy mb-1">Caja</label>
            <select value={cajaFiltro} onChange={(e) => setCajaFiltro(e.target.value)} className="input-field w-full">
              <option value="">Todas</option>
              {Object.entries(LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-navy mb-1">Tipo</label>
            <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} className="input-field w-full">
              <option value="">Todos</option>
              <option value="ingreso">Solo Ingresos</option>
              <option value="egreso">Solo Egresos</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-navy mb-1">Concepto</label>
            <select value={conceptoFiltro} onChange={(e) => setConceptoFiltro(e.target.value)} className="input-field w-full">
              <option value="">Todos</option>
              {conceptosDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
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
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button onClick={limpiarFiltros} className="btn-secondary">Limpiar filtros</button>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={incluirSI}
              onChange={(e) => setIncluirSI(e.target.checked)}
              className="w-4 h-4 accent-[#001f3f]"
            />
            <span className="text-sm font-bold text-navy">Incluir Saldo Inicial</span>
          </label>
        </div>
      </div>

      {/* TOTALES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-100 text-green-800 rounded-lg p-6">
          <p className="text-sm font-medium opacity-75">Ingresos</p>
          <p className="text-2xl font-bold mt-2">{fmt(stats.ingresos)}</p>
        </div>
        <div className="bg-red-100 text-red-800 rounded-lg p-6">
          <p className="text-sm font-medium opacity-75">Egresos</p>
          <p className="text-2xl font-bold mt-2">{fmt(stats.egresos)}</p>
        </div>
        <div className="bg-gold bg-opacity-20 text-oro rounded-lg p-6">
          <p className="text-sm font-medium opacity-75">Saldo del Período</p>
          <p className={`text-2xl font-bold mt-2 ${stats.saldo < 0 ? 'text-red-600' : ''}`}>{fmt(stats.saldo)}</p>
        </div>
      </div>

      {loading ? (
        <div className="card text-center text-gray-500 py-12">Cargando datos...</div>
      ) : (
        <>
          {/* RESÚMENES */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ResumenTabla titulo="Por Concepto" columna="concepto" data={resumenConcepto} keyField="concepto" fmt={fmt} />
            <ResumenTabla titulo="Por Templo" columna="templo" data={resumenTemplo} keyField="templo" fmt={fmt} />
            <ResumenTabla titulo="Por Caja" columna="caja" data={resumenCaja} keyField="caja" fmt={fmt} />
          </div>

          {/* DETALLE */}
          <div className="card">
            <h2 className="text-xl font-bold text-navy mb-4">
              Detalle de Movimientos ({filtrados.length.toLocaleString('es-AR')})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gold">
                    <th className="text-left p-3 text-navy font-bold">Fecha</th>
                    <th className="text-left p-3 text-navy font-bold">Tipo</th>
                    <th className="text-left p-3 text-navy font-bold">Concepto</th>
                    <th className="text-right p-3 text-navy font-bold">Monto</th>
                    <th className="text-left p-3 text-navy font-bold">Caja</th>
                    <th className="text-left p-3 text-navy font-bold">Templo</th>
                    <th className="text-left p-3 text-navy font-bold">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-6 text-center text-gray-500">
                        No hay movimientos con los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    filtrados.slice(0, 200).map((m, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="p-3">{parseFechaLocal(m.fecha).toLocaleDateString('es-ES')}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${m.tipo === 'ingreso' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {m.tipo === 'ingreso' ? 'INGRESO' : 'EGRESO'}
                          </span>
                        </td>
                        <td className="p-3 font-medium">{m.concepto}</td>
                        <td className={`p-3 text-right font-bold ${m.tipo === 'ingreso' ? 'text-green-700' : 'text-red-600'}`}>
                          {fmt(m.monto)}
                        </td>
                        <td className="p-3 text-xs">{LABELS[m.ubicacion] || m.ubicacion || '—'}</td>
                        <td className="p-3 text-xs">{nombreTemplo(m.templo_id)}</td>
                        <td className="p-3 text-gray-600 text-xs">{m.detalle || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {filtrados.length > 200 && (
                <p className="text-xs text-gray-500 mt-2">
                  Mostrando los primeros 200 de {filtrados.length.toLocaleString('es-AR')} movimientos. Usa "Exportar CSV" para verlos todos.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ResumenTabla({ titulo, data, keyField, fmt }) {
  return (
    <div className="card">
      <h2 className="text-lg font-bold text-navy mb-3">{titulo}</h2>
      {data.length === 0 ? (
        <p className="text-gray-500 text-sm">Sin datos</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-gold">
                <th className="text-left p-2 text-navy font-bold">Nombre</th>
                <th className="text-right p-2 text-navy font-bold">Ingresos</th>
                <th className="text-right p-2 text-navy font-bold">Egresos</th>
                <th className="text-right p-2 text-navy font-bold">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 12).map((row, idx) => {
                const saldo = row.ingresos - row.egresos;
                return (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{row[keyField]}</td>
                    <td className="p-2 text-right text-green-700">{fmt(row.ingresos)}</td>
                    <td className="p-2 text-right text-red-600">{fmt(row.egresos)}</td>
                    <td className={`p-2 text-right font-bold ${saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(saldo)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
