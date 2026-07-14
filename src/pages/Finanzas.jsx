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
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { Wallet, Landmark, Smartphone, Filter, PiggyBank } from 'lucide-react';

const SYMBOLS = { ARS: '$', USD: 'U$S', CLP: 'CLP $' };
const COLORS = ['#FFD700', '#C41E3A', '#001f3f', '#D4AF37', '#22c55e', '#3b82f6', '#a855f7', '#f97316', '#14b8a6', '#ec4899'];

// Iconos y títulos de cada grupo (los items se cargan de la BD)
const GRUPOS_META = {
  cajas: { titulo: 'Cajas', icon: Wallet },
  bancos: { titulo: 'Bancos', icon: Landmark },
  billeteras: { titulo: 'Billeteras y Otros', icon: Smartphone },
};

// Helper para cargar cajas dinámicas
async function fetchCajas() {
  const { data } = await supabase.from('cajas').select('*').eq('activo', true).order('orden');
  return data || [];
}

const PERIODOS = [
  { value: 'todo', label: 'Todo (saldo histórico)' },
  { value: 'este-mes', label: 'Este mes' },
  { value: 'mes-anterior', label: 'Mes anterior' },
  { value: 'ultimos-3-meses', label: 'Últimos 3 meses' },
  { value: 'este-anio', label: 'Este año' },
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
    case 'personalizado':
      return [
        desde ? inicioDia(new Date(desde + 'T00:00:00')) : new Date(2000, 0, 1),
        hasta ? finDia(new Date(hasta + 'T00:00:00')) : finDia(new Date(hoy)),
      ];
    default:
      return [new Date(2000, 0, 1), finDia(new Date(hoy))];
  }
}

export default function Finanzas() {
  const [movimientos, setMovimientos] = useState([]);
  const [templos, setTemplos] = useState([]);
  const [cajas, setCajas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [moneda, setMoneda] = useState('ARS');
  const [periodo, setPeriodo] = useState('todo');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [temploFiltro, setTemploFiltro] = useState('');
  const [incluirSI, setIncluirSI] = useState(true);

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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // GRUPOS y LABELS derivados de las cajas de la BD
  const GRUPOS = useMemo(() => {
    const g = { cajas: { ...GRUPOS_META.cajas, items: [] },
                bancos: { ...GRUPOS_META.bancos, items: [] },
                otros: { ...GRUPOS_META.billeteras, items: [] } };
    cajas.forEach(c => {
      const target = c.grupo === 'billeteras' ? 'otros' : c.grupo;
      if (g[target]) g[target].items.push(c.valor);
    });
    return g;
  }, [cajas]);

  const LABELS = useMemo(() => {
    const l = {};
    cajas.forEach(c => { l[c.valor] = c.nombre; });
    return l;
  }, [cajas]);

  const monedasDisponibles = useMemo(() => {
    const set = new Set(movimientos.map(m => m.moneda || 'ARS'));
    return ['ARS', 'USD', 'CLP'].filter(m => set.has(m));
  }, [movimientos]);

  const movsFiltradosBase = useMemo(() => {
    const [ini, fin] = rangoPeriodo(periodo, desde, hasta);
    return movimientos.filter(m => {
      if ((m.moneda || 'ARS') !== moneda) return false;
      const f = parseFechaLocal(m.fecha);
      if (f < ini || f > fin) return false;
      if (temploFiltro && m.templo_id !== temploFiltro) return false;
      return true;
    });
  }, [movimientos, moneda, periodo, desde, hasta, temploFiltro]);

  const movsFiltrados = useMemo(
    () => incluirSI ? movsFiltradosBase : movsFiltradosBase.filter(m => !esSaldoInicial(m)),
    [movsFiltradosBase, incluirSI]
  );

  const totalSaldoInicial = useMemo(
    () => movsFiltradosBase.filter(esSaldoInicial).reduce((s, m) => s + (m.monto || 0), 0),
    [movsFiltradosBase]
  );

  // Resumen consolidado en TODAS las monedas (respeta período/templo/saldo inicial, ignora el selector de moneda)
  const resumenMultimoneda = useMemo(() => {
    const [ini, fin] = rangoPeriodo(periodo, desde, hasta);
    const res = {};
    movimientos.forEach(m => {
      const f = parseFechaLocal(m.fecha);
      if (f < ini || f > fin) return;
      if (temploFiltro && m.templo_id !== temploFiltro) return;
      if (!incluirSI && esSaldoInicial(m)) return;
      const mon = m.moneda || 'ARS';
      if (!res[mon]) res[mon] = { cajas: 0, bancos: 0, otros: 0, saldoInicial: 0, total: 0 };
      const u = m.ubicacion || 'general';
      const grupo = GRUPOS.bancos.items.includes(u) ? 'bancos'
        : GRUPOS.otros.items.includes(u) ? 'otros' : 'cajas';
      const delta = m.tipo === 'ingreso' ? (m.monto || 0) : -(m.monto || 0);
      res[mon][grupo] += delta;
      res[mon].total += delta;
      if (esSaldoInicial(m)) res[mon].saldoInicial += (m.monto || 0);
    });
    return Object.entries(res).map(([mon, v]) => ({ moneda: mon, ...v }));
  }, [movimientos, periodo, desde, hasta, temploFiltro, incluirSI]);

  // Saldos por ubicación
  const saldos = useMemo(() => {
    const porUbicacion = {};
    movsFiltrados.forEach(m => {
      const u = m.ubicacion || 'general';
      if (!porUbicacion[u]) porUbicacion[u] = { ingresos: 0, egresos: 0 };
      if (m.tipo === 'ingreso') porUbicacion[u].ingresos += m.monto || 0;
      else porUbicacion[u].egresos += m.monto || 0;
    });
    return porUbicacion;
  }, [movsFiltrados]);

  const saldoDe = (u) => {
    const s = saldos[u];
    return s ? s.ingresos - s.egresos : 0;
  };

  const totalGrupo = (grupo) =>
    GRUPOS[grupo].items.reduce((sum, u) => sum + saldoDe(u), 0);

  const saldoTotal = Object.keys(GRUPOS).reduce((sum, g) => sum + totalGrupo(g), 0);

  // Datos para gráfico de composición del saldo (solo positivos)
  const composicion = useMemo(() => {
    return Object.entries(saldos)
      .map(([u, s]) => ({ name: LABELS[u] || u, value: s.ingresos - s.egresos }))
      .filter(x => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [saldos]);

  // Movimiento del período por grupo (ingresos/egresos)
  const flujoGrupos = useMemo(() => {
    return Object.entries(GRUPOS).map(([key, g]) => {
      let ingresos = 0, egresos = 0;
      g.items.forEach(u => {
        if (saldos[u]) {
          ingresos += saldos[u].ingresos;
          egresos += saldos[u].egresos;
        }
      });
      return { grupo: g.titulo, ingresos, egresos };
    });
  }, [saldos]);

  const fmt = (n) =>
    `${SYMBOLS[moneda] || '$'} ${(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtCompacto = (n) => {
    if (Math.abs(n) >= 1000000) return `${(n / 1000000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`;
    if (Math.abs(n) >= 1000) return `${(n / 1000).toLocaleString('es-AR', { maximumFractionDigits: 0 })}k`;
    return n.toString();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-navy mb-2">Finanzas</h1>
          <p className="text-gray-600">Estado de cajas, bancos y billeteras</p>
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

      {/* FILTROS */}
      <div className="card bg-blue-50 border-l-4 border-blue-500">
        <h2 className="text-lg font-bold text-navy mb-3 flex items-center gap-2">
          <Filter size={20} /> Filtros
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
          <div className="flex items-end">
            <button
              onClick={() => { setPeriodo('todo'); setDesde(''); setHasta(''); setTemploFiltro(''); }}
              className="btn-secondary w-full"
            >
              Limpiar filtros
            </button>
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
        <p className="text-xs text-gray-600 mt-3">
          💡 Con el período "Todo" ves el <strong>saldo real acumulado</strong> de cada caja. Con otros períodos ves solo el movimiento de ese lapso.
        </p>
      </div>

      {/* SALDO TOTAL */}
      <div className="card bg-gold bg-opacity-20 border-l-4 border-gold">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-oro opacity-75">SALDO TOTAL ({moneda})</p>
            <p className={`text-4xl font-bold mt-1 ${saldoTotal >= 0 ? 'text-oro' : 'text-red-600'}`}>{fmt(saldoTotal)}</p>
          </div>
          <PiggyBank size={48} className="text-oro opacity-50" />
        </div>
      </div>

      {/* RESUMEN CONSOLIDADO MULTIMONEDA */}
      {resumenMultimoneda.length > 1 && (
        <div className="card">
          <h2 className="text-xl font-bold text-navy mb-4">Resumen por Moneda</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gold">
                  <th className="text-left p-3 text-navy font-bold">Moneda</th>
                  <th className="text-right p-3 text-navy font-bold">Cajas</th>
                  <th className="text-right p-3 text-navy font-bold">Bancos</th>
                  <th className="text-right p-3 text-navy font-bold">Billeteras / Plazo Fijo</th>
                  <th className="text-right p-3 text-navy font-bold">Saldo Inicial incluido</th>
                  <th className="text-right p-3 text-navy font-bold">Saldo Total</th>
                </tr>
              </thead>
              <tbody>
                {resumenMultimoneda.map((r) => {
                  const sym = SYMBOLS[r.moneda] || '$';
                  const f = (n) => `${sym} ${(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  return (
                    <tr key={r.moneda} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-bold">
                        {r.moneda === 'ARS' && '🇦🇷 ARS'}
                        {r.moneda === 'USD' && '🇺🇸 USD'}
                        {r.moneda === 'CLP' && '🇨🇱 CLP'}
                      </td>
                      <td className={`p-3 text-right ${r.cajas >= 0 ? '' : 'text-red-600'}`}>{f(r.cajas)}</td>
                      <td className={`p-3 text-right ${r.bancos >= 0 ? '' : 'text-red-600'}`}>{f(r.bancos)}</td>
                      <td className={`p-3 text-right ${r.otros >= 0 ? '' : 'text-red-600'}`}>{f(r.otros)}</td>
                      <td className="p-3 text-right text-gray-600">{incluirSI ? f(r.saldoInicial) : '— (excluido)'}</td>
                      <td className={`p-3 text-right font-bold ${r.total >= 0 ? 'text-green-700' : 'text-red-600'}`}>{f(r.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Este cuadro consolida todas las monedas del período y templo seleccionados, sin importar la moneda elegida arriba.
          </p>
        </div>
      )}

      {loading ? (
        <div className="card text-center text-gray-500 py-12">Cargando datos...</div>
      ) : (
        <>
          {/* GRUPOS: CAJAS / BANCOS / OTROS */}
          {Object.entries(GRUPOS).map(([key, grupo]) => {
            const Icon = grupo.icon;
            const itemsConMovimiento = grupo.items.filter(u => saldos[u]);
            return (
              <div key={key} className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-navy flex items-center gap-2">
                    <Icon size={22} /> {grupo.titulo}
                  </h2>
                  <span className={`text-xl font-bold ${totalGrupo(key) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmt(totalGrupo(key))}
                  </span>
                </div>
                {itemsConMovimiento.length === 0 ? (
                  <p className="text-gray-500 text-sm">Sin movimientos en el período</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-gold">
                          <th className="text-left p-3 text-navy font-bold">Nombre</th>
                          <th className="text-right p-3 text-navy font-bold">Ingresos</th>
                          <th className="text-right p-3 text-navy font-bold">Egresos</th>
                          <th className="text-right p-3 text-navy font-bold">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsConMovimiento
                          .sort((a, b) => saldoDe(b) - saldoDe(a))
                          .map(u => (
                            <tr key={u} className="border-b hover:bg-gray-50">
                              <td className="p-3 font-medium">{LABELS[u] || u}</td>
                              <td className="p-3 text-right text-green-700">{fmt(saldos[u].ingresos)}</td>
                              <td className="p-3 text-right text-red-600">{fmt(saldos[u].egresos)}</td>
                              <td className={`p-3 text-right font-bold ${saldoDe(u) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                {fmt(saldoDe(u))}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {/* GRÁFICOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="text-xl font-bold text-navy mb-4">Composición del Saldo</h2>
              {composicion.length === 0 ? (
                <p className="text-gray-500 text-center py-12">Sin saldos positivos</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={composicion} cx="50%" cy="50%" outerRadius={90}
                      dataKey="value" nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={{ strokeWidth: 1 }}
                    >
                      {composicion.map((entry, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <h2 className="text-xl font-bold text-navy mb-4">Flujo por Grupo</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={flujoGrupos} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="grupo" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={fmtCompacto} tick={{ fontSize: 12 }} width={55} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="ingresos" fill="#22c55e" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="egresos" fill="#ef4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
