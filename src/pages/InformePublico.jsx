import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';

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
  { value: 'kiosco', label: 'Kiosco' },
  { value: 'comedor', label: 'Comedor' },
  { value: 'libreria', label: 'Librería' },
  { value: 'banco-nacion', label: 'Banco Nación' },
  { value: 'banco-macro', label: 'Banco Macro' },
  { value: 'plazo-fijo', label: 'Plazo Fijo' },
  { value: 'mercado-pago', label: 'Mercado Pago' },
  { value: 'billetera-virtual', label: 'Billetera Virtual' },
  { value: 'otro', label: 'Otro' },
];

const CONCEPTOS_INTERNOS = new Set([
  'Saldo Inicial',
  'Transferencia entre Cajas',
  'Préstamo entre Cajas',
  'Devolución de Préstamo',
  'Extracción Bancaria',
  'Aporte a Fondo Común',
  'Cambio Monetario',
]);

function parseFechaLocal(fecha) {
  if (!fecha) return new Date(0);
  const [y, m, d] = String(fecha).split('T')[0].split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const fmt = (n) =>
  `$ ${(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const nombreCaja = (valor) =>
  UBICACIONES.find(x => x.value === valor)?.label || valor || 'General';

async function fetchTodosMovimientos() {
  const LOTE = 1000;
  let todos = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('movimientos')
      .select('id, tipo, monto, moneda, ubicacion, templo_id, concepto, fecha')
      .eq('moneda', 'ARS')
      .order('fecha', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + LOTE - 1);
    if (error || !data || data.length === 0) break;
    todos = todos.concat(data);
    if (data.length < LOTE) break;
    from += LOTE;
  }
  return todos;
}

const PERIODOS = [
  { value: 'este-mes', label: 'Este mes' },
  { value: 'mes-anterior', label: 'Mes anterior' },
  { value: 'ultimos-3-meses', label: 'Últimos 3 meses' },
  { value: 'este-anio', label: 'Este año' },
  { value: 'todo', label: 'Todo' },
];

function rangoPeriodo(periodo) {
  const hoy = new Date();
  const ini = (d) => { d.setHours(0, 0, 0, 0); return d; };
  const fin = (d) => { d.setHours(23, 59, 59, 999); return d; };
  switch (periodo) {
    case 'este-mes':
      return [ini(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), fin(new Date(hoy))];
    case 'mes-anterior':
      return [
        ini(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
        fin(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
      ];
    case 'ultimos-3-meses':
      return [ini(new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1)), fin(new Date(hoy))];
    case 'este-anio':
      return [ini(new Date(hoy.getFullYear(), 0, 1)), fin(new Date(hoy))];
    default:
      return [new Date(2000, 0, 1), fin(new Date(hoy))];
  }
}

export default function InformePublico() {
  const [movimientos, setMovimientos] = useState([]);
  const [templos, setTemplos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('este-anio');
  const [temploFiltro, setTemploFiltro] = useState('');

  useEffect(() => {
    const cargar = async () => {
      const [movs, tempRes] = await Promise.all([
        fetchTodosMovimientos(),
        supabase.from('templos').select('id, nombre'),
      ]);
      setMovimientos(movs);
      setTemplos(tempRes.data || []);
      setLoading(false);
    };
    cargar();
  }, []);

  const resumen = useMemo(() => {
    const [ini, fin] = rangoPeriodo(periodo);
    const grupos = {};
    movimientos.forEach(m => {
      if (CONCEPTOS_INTERNOS.has((m.concepto || '').trim())) return;
      const f = parseFechaLocal(m.fecha);
      if (f < ini || f > fin) return;
      if (temploFiltro && m.templo_id !== temploFiltro) return;

      const nombre = m.templo_id
        ? (templos.find(t => t.id === m.templo_id)?.nombre || 'Desconocido')
        : 'Sin templo';
      const cajaLabel = nombreCaja(m.ubicacion || 'general');

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
  }, [movimientos, templos, periodo, temploFiltro]);

  const total = useMemo(() => {
    let ingresos = 0, egresos = 0;
    resumen.forEach(g => { ingresos += g.ingresos; egresos += g.egresos; });
    return { ingresos, egresos, saldo: ingresos - egresos };
  }, [resumen]);

  const labelPeriodo = PERIODOS.find(p => p.value === periodo)?.label || '';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-navy text-white py-6 px-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <img src="/logo-navy.png" alt="IEUP" className="w-14 h-14 brightness-0 invert" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Informe de Cuentas</h1>
            <p className="text-gold text-sm mt-1">Iglesia Evangélica Unión Pentecostal</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Aviso */}
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded p-4 text-sm text-blue-800">
          Este informe es de carácter público y refleja el resumen de ingresos, egresos y saldos
          por templo y caja. No incluye el detalle de los movimientos individuales.
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-navy mb-1">Período</label>
            <select
              value={periodo}
              onChange={e => setPeriodo(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
            >
              {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-navy mb-1">Templo</label>
            <select
              value={temploFiltro}
              onChange={e => setTemploFiltro(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
            >
              <option value="">Todos los templos</option>
              {templos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">Cargando informe...</div>
        ) : resumen.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No hay datos para el período seleccionado</div>
        ) : (
          <>
            {/* Totales generales */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Ingresos</p>
                <p className="text-lg font-bold text-green-700">{fmt(total.ingresos)}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Egresos</p>
                <p className="text-lg font-bold text-red-600">{fmt(total.egresos)}</p>
              </div>
              <div className={`border rounded-xl p-4 text-center ${total.saldo >= 0 ? 'bg-yellow-50 border-yellow-300' : 'bg-red-50 border-red-200'}`}>
                <p className="text-xs text-gray-500 mb-1">Saldo</p>
                <p className={`text-lg font-bold ${total.saldo >= 0 ? 'text-yellow-700' : 'text-red-600'}`}>{fmt(total.saldo)}</p>
              </div>
            </div>

            {/* Tabla por templo y caja */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 className="font-bold text-navy">Resumen por Templo y Caja — {labelPeriodo}</h2>
                <span className="text-xs text-gray-500">{resumen.length} templo{resumen.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-yellow-400 bg-gray-50">
                      <th className="text-left px-4 py-3 text-navy font-bold">Templo / Caja</th>
                      <th className="text-right px-4 py-3 text-navy font-bold">Ingresos</th>
                      <th className="text-right px-4 py-3 text-navy font-bold">Egresos</th>
                      <th className="text-right px-4 py-3 text-navy font-bold">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.map(g => (
                      <>
                        {/* Fila templo */}
                        <tr key={g.templo} className="bg-yellow-50 font-bold border-t border-yellow-200">
                          <td className="px-4 py-3 text-navy">{g.templo}</td>
                          <td className="px-4 py-3 text-right text-green-700">{fmt(g.ingresos)}</td>
                          <td className="px-4 py-3 text-right text-red-600">{fmt(g.egresos)}</td>
                          <td className={`px-4 py-3 text-right ${g.saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(g.saldo)}</td>
                        </tr>
                        {/* Filas caja */}
                        {g.cajasArr.map(cj => (
                          <tr key={cj.caja} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-2 pl-10 text-gray-600">↳ {cj.caja}</td>
                            <td className="px-4 py-2 text-right text-green-600">{fmt(cj.ingresos)}</td>
                            <td className="px-4 py-2 text-right text-red-500">{fmt(cj.egresos)}</td>
                            <td className={`px-4 py-2 text-right font-medium ${cj.saldo >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(cj.saldo)}</td>
                          </tr>
                        ))}
                      </>
                    ))}
                    {/* Total general */}
                    <tr className="bg-navy text-white font-bold">
                      <td className="px-4 py-3">TOTAL GENERAL</td>
                      <td className="px-4 py-3 text-right">{fmt(total.ingresos)}</td>
                      <td className="px-4 py-3 text-right">{fmt(total.egresos)}</td>
                      <td className="px-4 py-3 text-right text-yellow-400">{fmt(total.saldo)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pie de página */}
            <p className="text-center text-xs text-gray-400 pb-4">
              Informe generado el {new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })} · Solo lectura · No incluye movimientos internos
            </p>
          </>
        )}
      </div>
    </div>
  );
}
