import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import Papa from 'papaparse';
import {
  Plus, X, Save, ChevronDown, ChevronUp, FileText,
  DollarSign, AlertCircle, CheckCircle, Clock, RefreshCw,
} from 'lucide-react';

// ─── Constantes ──────────────────────────────────────────────
const MONEDAS = ['ARS', 'USD', 'CLP'];
const SIMBOLOS = { ARS: '$', USD: 'U$S', CLP: 'CLP$' };

const fmt = (n, moneda = 'ARS') =>
  `${SIMBOLOS[moneda] || '$'} ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtF = (s) => s ? new Date(s + 'T00:00:00').toLocaleDateString('es-AR') : '—';

const ESTADOS = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  parcial:   { label: 'Parcial',   color: 'bg-blue-100 text-blue-800',    icon: RefreshCw },
  cancelado: { label: 'Cancelado', color: 'bg-green-100 text-green-800',  icon: CheckCircle },
};

// ─── Helpers ─────────────────────────────────────────────────
const totalDevuelto = (devoluciones, moneda) =>
  devoluciones
    .filter(d => d.moneda === moneda)
    .reduce((s, d) => s + Number(d.monto_capital || 0), 0);

const totalInteres = (devoluciones, moneda) =>
  devoluciones
    .filter(d => d.moneda === moneda)
    .reduce((s, d) => s + Number(d.monto_interes || 0), 0);

// ─── Componente principal ─────────────────────────────────────
export default function Prestamos({ usuario }) {
  const [prestamos, setPrestamos] = useState([]);
  const [devoluciones, setDevoluciones] = useState([]);
  const [templos, setTemplos] = useState([]);
  const [cajas, setCajas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState({ txt: '', ok: true });

  // UI
  const [filtroPrestamo, setFiltroPrestamo] = useState('todos'); // todos/pendiente/parcial/cancelado
  const [filaAbierta, setFilaAbierta] = useState(null);
  const [modalTipo, setModalTipo] = useState(null); // 'nuevo' | 'devolucion'
  const [prestamoActivo, setPrestamoActivo] = useState(null);

  const esAdmin = usuario?.rol === 'admin';
  const esTesorero = usuario?.rol === 'tesorero';
  const puedeGestionar = esAdmin || esTesorero;
  const miTemploId = usuario?.templo_id;

  // ── Formulario nuevo préstamo ────────────────────────────────
  const formVacio = {
    tipo: 'interno',
    acreedor_nombre: '',
    acreedor_caja: '',
    acreedor_templo_id: '',
    deudor_caja: '',
    deudor_templo_id: '',
    monto_original: '',
    moneda: 'ARS',
    fecha: new Date().toISOString().split('T')[0],
    descripcion: '',
  };
  const [form, setForm] = useState(formVacio);
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Formulario devolución ────────────────────────────────────
  const devVacio = {
    monto_capital: '',
    monto_interes: '',
    moneda: 'ARS',
    fecha: new Date().toISOString().split('T')[0],
    indice_inflacion: '',
    periodo_meses: '',
    notas: '',
  };
  const [devForm, setDevForm] = useState(devVacio);
  const setD = (k, v) => setDevForm(d => ({ ...d, [k]: v }));

  const [guardando, setGuardando] = useState(false);

  // ── Carga inicial ─────────────────────────────────────────────
  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    const [pRes, dRes, tRes, cRes] = await Promise.all([
      supabase.from('prestamos').select('*').order('fecha', { ascending: false }),
      supabase.from('prestamo_devoluciones').select('*').order('fecha'),
      supabase.from('templos').select('*').order('nombre'),
      supabase.from('cajas').select('*').eq('activo', true).order('grupo').order('orden'),
    ]);
    setPrestamos(pRes.data || []);
    setDevoluciones(dRes.data || []);
    setTemplos(tRes.data || []);
    setCajas(cRes.data || []);
    setLoading(false);
  };

  const msg = (txt, ok = true) => {
    setMensaje({ txt, ok });
    setTimeout(() => setMensaje({ txt: '', ok: true }), 5000);
  };

  // ── Helpers de lookup ─────────────────────────────────────────
  const nombreTemplo = (id) => templos.find(t => t.id === id)?.nombre || '—';
  const nombreCaja = (v) => cajas.find(c => c.valor === v)?.nombre || v || '—';

  const devsPrestamo = (id) => devoluciones.filter(d => d.prestamo_id === id);

  const saldoPendiente = (p) => {
    const devs = devsPrestamo(p.id).filter(d => d.moneda === p.moneda);
    const devuelto = devs.reduce((s, d) => s + Number(d.monto_capital || 0), 0);
    return Number(p.monto_original) - devuelto;
  };

  // ── Crear préstamo ─────────────────────────────────────────────
  const guardarPrestamo = async (e) => {
    e.preventDefault();
    if (!form.deudor_caja || !form.deudor_templo_id) return msg('❌ Completá la caja y templo deudor', false);
    if (!form.monto_original || Number(form.monto_original) <= 0) return msg('❌ El monto debe ser mayor a 0', false);
    if (form.tipo === 'interno' && (!form.acreedor_caja || !form.acreedor_templo_id)) return msg('❌ Completá la caja y templo acreedor', false);
    if (form.tipo === 'externo' && !form.acreedor_nombre.trim()) return msg('❌ Indicá el nombre del tercero que presta', false);

    setGuardando(true);
    try {
      const datos = {
        tipo: form.tipo,
        acreedor_nombre: form.tipo === 'externo' ? form.acreedor_nombre.trim() : null,
        acreedor_caja: form.tipo === 'interno' ? form.acreedor_caja : null,
        acreedor_templo_id: form.tipo === 'interno' ? form.acreedor_templo_id : null,
        deudor_caja: form.deudor_caja,
        deudor_templo_id: form.deudor_templo_id,
        monto_original: Number(form.monto_original),
        moneda: form.moneda,
        fecha: form.fecha,
        descripcion: form.descripcion.trim() || null,
        estado: 'pendiente',
      };

      const { data: prest, error: errP } = await supabase
        .from('prestamos').insert(datos).select().single();
      if (errP) throw errP;

      // Crear movimientos contables
      const baseMovimiento = {
        fecha: form.fecha,
        concepto: form.tipo === 'interno' ? 'Préstamo entre Cajas' : 'Préstamo Externo',
        monto: Number(form.monto_original),
        moneda: form.moneda,
        tipo_transaccion: 'efectivo',
        detalle: form.descripcion.trim() || `Préstamo #${prest.id.slice(0,8)}`,
      };

      let movEgresoId = null, movIngresoId = null;

      // Ingreso a la caja deudora (siempre)
      const { data: movIng } = await supabase.from('movimientos').insert({
        ...baseMovimiento,
        tipo: 'ingreso',
        ubicacion: form.deudor_caja,
        templo_id: form.deudor_templo_id,
      }).select('id').single();
      movIngresoId = movIng?.id;

      // Egreso de la caja acreedora (solo préstamo interno)
      if (form.tipo === 'interno') {
        const { data: movEgr } = await supabase.from('movimientos').insert({
          ...baseMovimiento,
          tipo: 'egreso',
          ubicacion: form.acreedor_caja,
          templo_id: form.acreedor_templo_id,
        }).select('id').single();
        movEgresoId = movEgr?.id;
      }

      // Vincular movimientos al préstamo
      await supabase.from('prestamos').update({
        movimiento_ingreso_id: movIngresoId,
        movimiento_egreso_id: movEgresoId,
        updated_at: new Date().toISOString(),
      }).eq('id', prest.id);

      msg(`✅ Préstamo registrado. Se crearon ${form.tipo === 'interno' ? '2' : '1'} movimiento(s) contable(s).`);
      setModalTipo(null);
      setForm(formVacio);
      cargar();
    } catch (e) {
      msg('❌ Error: ' + e.message, false);
    } finally {
      setGuardando(false);
    }
  };

  // ── Registrar devolución ──────────────────────────────────────
  const guardarDevolucion = async (e) => {
    e.preventDefault();
    if (!prestamoActivo) return;
    const capital = Number(devForm.monto_capital || 0);
    const interes = Number(devForm.monto_interes || 0);
    if (capital + interes <= 0) return msg('❌ El monto de la devolución debe ser mayor a 0', false);

    setGuardando(true);
    try {
      const p = prestamoActivo;
      const conceptoBase = p.tipo === 'interno' ? 'Devolución de Préstamo' : 'Devolución Préstamo Externo';
      const detalle = devForm.notas || `Devolución préstamo ${fmtF(p.fecha)} | ${devForm.periodo_meses ? devForm.periodo_meses + ' meses' : ''} ${devForm.indice_inflacion ? '| Inflación: ' + devForm.indice_inflacion + '%' : ''}`.trim();

      let movCapitalId = null, movInteresId = null;

      // Movimientos de capital
      if (capital > 0) {
        // Egreso de la caja deudora (devuelve)
        await supabase.from('movimientos').insert({
          fecha: devForm.fecha, tipo: 'egreso', concepto: conceptoBase,
          monto: capital, moneda: devForm.moneda, tipo_transaccion: 'efectivo',
          ubicacion: p.deudor_caja, templo_id: p.deudor_templo_id, detalle,
        });

        // Ingreso a la caja acreedora (solo préstamo interno)
        if (p.tipo === 'interno') {
          const { data: mI } = await supabase.from('movimientos').insert({
            fecha: devForm.fecha, tipo: 'ingreso', concepto: conceptoBase,
            monto: capital, moneda: devForm.moneda, tipo_transaccion: 'efectivo',
            ubicacion: p.acreedor_caja, templo_id: p.acreedor_templo_id, detalle,
          }).select('id').single();
          movCapitalId = mI?.id;
        }
      }

      // Movimiento de interés (si hay)
      if (interes > 0) {
        const { data: mInt } = await supabase.from('movimientos').insert({
          fecha: devForm.fecha, tipo: 'egreso', concepto: 'Interés por Inflación',
          monto: interes, moneda: devForm.moneda, tipo_transaccion: 'efectivo',
          ubicacion: p.deudor_caja, templo_id: p.deudor_templo_id,
          detalle: `Interés inflación préstamo ${fmtF(p.fecha)}${devForm.indice_inflacion ? ' | ' + devForm.indice_inflacion + '%' : ''}`,
        }).select('id').single();
        movInteresId = mInt?.id;

        // Si es interno, el interés es un ingreso para la caja acreedora
        if (p.tipo === 'interno') {
          await supabase.from('movimientos').insert({
            fecha: devForm.fecha, tipo: 'ingreso', concepto: 'Interés por Inflación',
            monto: interes, moneda: devForm.moneda, tipo_transaccion: 'efectivo',
            ubicacion: p.acreedor_caja, templo_id: p.acreedor_templo_id,
            detalle: `Interés inflación préstamo ${fmtF(p.fecha)}`,
          });
        }
      }

      // Registrar la devolución
      await supabase.from('prestamo_devoluciones').insert({
        prestamo_id: p.id,
        fecha: devForm.fecha,
        monto_capital: capital,
        monto_interes: interes,
        moneda: devForm.moneda,
        indice_inflacion: devForm.indice_inflacion ? Number(devForm.indice_inflacion) : null,
        periodo_meses: devForm.periodo_meses ? Number(devForm.periodo_meses) : null,
        mov_capital_id: movCapitalId,
        mov_interes_id: movInteresId,
        notas: devForm.notas || null,
      });

      // Actualizar estado del préstamo
      const devsActualizadas = [...devoluciones.filter(d => d.prestamo_id === p.id), { monto_capital: capital, moneda: devForm.moneda }];
      const totalDev = devsActualizadas.filter(d => d.moneda === p.moneda).reduce((s, d) => s + Number(d.monto_capital || 0), 0);
      const nuevoEstado = totalDev >= Number(p.monto_original) ? 'cancelado' : 'parcial';
      await supabase.from('prestamos').update({ estado: nuevoEstado, updated_at: new Date().toISOString() }).eq('id', p.id);

      msg('✅ Devolución registrada correctamente');
      setModalTipo(null);
      setPrestamoActivo(null);
      setDevForm(devVacio);
      cargar();
    } catch (e) {
      msg('❌ Error: ' + e.message, false);
    } finally {
      setGuardando(false);
    }
  };

  // ── Filtrar préstamos según rol ───────────────────────────────
  const prestamosFiltrados = useMemo(() => {
    let lista = prestamos;
    // Operador: solo ve los de su templo
    if (usuario?.rol === 'operador' && miTemploId) {
      lista = lista.filter(p => p.deudor_templo_id === miTemploId || p.acreedor_templo_id === miTemploId);
    }
    if (filtroPrestamo !== 'todos') {
      lista = lista.filter(p => p.estado === filtroPrestamo);
    }
    return lista;
  }, [prestamos, filtroPrestamo, usuario, miTemploId]);

  // ── Resumen global ─────────────────────────────────────────────
  const resumen = useMemo(() => {
    const pendientes = prestamos.filter(p => p.estado !== 'cancelado');
    const porMoneda = {};
    pendientes.forEach(p => {
      const saldo = saldoPendiente(p);
      if (!porMoneda[p.moneda]) porMoneda[p.moneda] = { cantidad: 0, saldo: 0 };
      porMoneda[p.moneda].cantidad++;
      porMoneda[p.moneda].saldo += saldo;
    });
    return { totalPrestamos: prestamos.length, pendientes: pendientes.length, porMoneda };
  }, [prestamos, devoluciones]);

  const cajasPorGrupo = useMemo(() => {
    const g = { cajas: [], bancos: [], billeteras: [] };
    cajas.forEach(c => { if (g[c.grupo]) g[c.grupo].push(c); });
    return g;
  }, [cajas]);

  const SelectCajas = ({ value, onChange, placeholder = 'Seleccionar caja...' }) => (
    <select value={value} onChange={e => onChange(e.target.value)} className="input-field w-full">
      <option value="">{placeholder}</option>
      <optgroup label="Cajas">{cajasPorGrupo.cajas.map(c => <option key={c.valor} value={c.valor}>{c.emoji} {c.nombre}</option>)}</optgroup>
      <optgroup label="Bancos">{cajasPorGrupo.bancos.map(c => <option key={c.valor} value={c.valor}>{c.emoji} {c.nombre}</option>)}</optgroup>
      <optgroup label="Billeteras">{cajasPorGrupo.billeteras.map(c => <option key={c.valor} value={c.valor}>{c.emoji} {c.nombre}</option>)}</optgroup>
    </select>
  );

  const exportarCSV = () => {
    const data = prestamosFiltrados.map(p => {
      const devs = devsPrestamo(p.id);
      return {
        Tipo: p.tipo === 'interno' ? 'Interno' : 'Externo',
        Acreedor: p.tipo === 'interno' ? `${nombreCaja(p.acreedor_caja)} / ${nombreTemplo(p.acreedor_templo_id)}` : p.acreedor_nombre,
        Deudor: `${nombreCaja(p.deudor_caja)} / ${nombreTemplo(p.deudor_templo_id)}`,
        Monto: p.monto_original,
        Moneda: p.moneda,
        Fecha: fmtF(p.fecha),
        Devuelto: totalDevuelto(devs, p.moneda),
        Interes: totalInteres(devs, p.moneda),
        Saldo: saldoPendiente(p),
        Estado: ESTADOS[p.estado]?.label || p.estado,
        Descripcion: p.descripcion || '—',
      };
    });
    const blob = new Blob(['\ufeff' + Papa.unparse(data)], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `prestamos-${new Date().toISOString().split('T')[0]}.csv`; a.click();
  };

  if (loading) return <div className="flex items-center justify-center py-24"><div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-navy">Préstamos</h1>
          <p className="text-sm text-gray-600">Aportes reintegrables entre cajas y de terceros externos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportarCSV} className="btn-secondary flex items-center gap-2 text-sm"><FileText size={16}/>CSV</button>
          {puedeGestionar && (
            <button onClick={() => { setForm(formVacio); setModalTipo('nuevo'); }} className="btn-primary flex items-center gap-2">
              <Plus size={20}/> Nuevo Préstamo
            </button>
          )}
        </div>
      </div>

      {/* Mensaje */}
      {mensaje.txt && (
        <div className={`card ${mensaje.ok ? 'bg-green-50 border-l-4 border-green-500 text-green-800' : 'bg-red-50 border-l-4 border-red-500 text-red-800'}`}>
          {mensaje.txt}
        </div>
      )}

      {/* Resumen por moneda */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-gradient-to-br from-navy to-navy-dark text-white">
          <div className="flex justify-between items-center">
            <div><p className="text-sm opacity-80">Total préstamos</p><p className="text-3xl font-bold">{resumen.totalPrestamos}</p></div>
            <DollarSign size={40} className="opacity-50" />
          </div>
          <p className="text-xs opacity-70 mt-2">{resumen.pendientes} pendientes o parciales</p>
        </div>
        {Object.entries(resumen.porMoneda).map(([mon, v]) => (
          <div key={mon} className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm opacity-80">Saldo adeudado {mon}</p>
                <p className="text-2xl font-bold">{fmt(v.saldo, mon)}</p>
              </div>
              <AlertCircle size={40} className="opacity-50" />
            </div>
            <p className="text-xs opacity-70 mt-2">{v.cantidad} préstamo(s) activo(s)</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {['todos', 'pendiente', 'parcial', 'cancelado'].map(f => (
          <button key={f} onClick={() => setFiltroPrestamo(f)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${filtroPrestamo === f ? 'bg-navy text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {f === 'todos' ? `Todos (${prestamos.length})` : `${ESTADOS[f]?.label} (${prestamos.filter(p=>p.estado===f).length})`}
          </button>
        ))}
      </div>

      {/* Lista de préstamos */}
      <div className="card">
        <h2 className="text-xl font-bold text-navy mb-4">Registro de Préstamos <span className="text-sm font-normal text-gray-500">({prestamosFiltrados.length})</span></h2>
        {prestamosFiltrados.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No hay préstamos con los filtros seleccionados</p>
        ) : (
          <div className="space-y-3">
            {prestamosFiltrados.map(p => {
              const devs = devsPrestamo(p.id);
              const saldo = saldoPendiente(p);
              const devuelto = totalDevuelto(devs, p.moneda);
              const interesTotal = totalInteres(devs, p.moneda);
              const estado = ESTADOS[p.estado] || ESTADOS.pendiente;
              const EIcon = estado.icon;
              const abierto = filaAbierta === p.id;
              const pct = Number(p.monto_original) > 0 ? Math.min(100, Math.round(devuelto / Number(p.monto_original) * 100)) : 0;

              return (
                <div key={p.id} className={`border rounded-lg overflow-hidden ${p.estado === 'cancelado' ? 'opacity-60' : ''}`}>
                  {/* Fila principal */}
                  <div className="p-4 cursor-pointer hover:bg-gray-50" onClick={() => setFilaAbierta(abierto ? null : p.id)}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Tipo y estado */}
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${p.tipo === 'interno' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                            {p.tipo === 'interno' ? '🔄 Interno' : '👤 Externo'}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 ${estado.color}`}>
                            <EIcon size={11} />{estado.label}
                          </span>
                          <span className="text-xs text-gray-500">{fmtF(p.fecha)}</span>
                          <span className="text-xs font-bold text-navy">{p.moneda}</span>
                        </div>

                        {/* Acreedor → Deudor */}
                        <p className="text-sm font-medium">
                          <span className="text-green-700">
                            {p.tipo === 'interno' ? `${nombreCaja(p.acreedor_caja)} / ${nombreTemplo(p.acreedor_templo_id)}` : p.acreedor_nombre}
                          </span>
                          <span className="text-gray-400 mx-2">prestó a</span>
                          <span className="text-red-700">{nombreCaja(p.deudor_caja)} / {nombreTemplo(p.deudor_templo_id)}</span>
                        </p>

                        {p.descripcion && <p className="text-xs text-gray-500 mt-0.5">{p.descripcion}</p>}

                        {/* Barra de progreso */}
                        {p.estado !== 'cancelado' && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>Devuelto {pct}%</span>
                              <span>Saldo: <strong>{fmt(saldo, p.moneda)}</strong></span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-navy">{fmt(p.monto_original, p.moneda)}</p>
                        <p className="text-xs text-gray-500">{devs.length} devolución(es)</p>
                        {abierto ? <ChevronUp size={18} className="ml-auto mt-1 text-gray-400" /> : <ChevronDown size={18} className="ml-auto mt-1 text-gray-400" />}
                      </div>
                    </div>
                  </div>

                  {/* Panel expandido */}
                  {abierto && (
                    <div className="border-t bg-gray-50 p-4 space-y-4">
                      {/* Resumen financiero */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                        <div className="bg-white rounded p-2"><p className="text-xs text-gray-500">Prestado</p><p className="font-bold text-navy">{fmt(p.monto_original, p.moneda)}</p></div>
                        <div className="bg-white rounded p-2"><p className="text-xs text-gray-500">Capital devuelto</p><p className="font-bold text-green-700">{fmt(devuelto, p.moneda)}</p></div>
                        <div className="bg-white rounded p-2"><p className="text-xs text-gray-500">Intereses pagados</p><p className="font-bold text-orange-700">{fmt(interesTotal, p.moneda)}</p></div>
                        <div className="bg-white rounded p-2"><p className="text-xs text-gray-500">Saldo capital</p><p className="font-bold text-red-700">{fmt(saldo, p.moneda)}</p></div>
                      </div>

                      {/* Historial de devoluciones */}
                      {devs.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-navy mb-2 uppercase">Historial de devoluciones</p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-gray-300">
                                  <th className="text-left p-1 text-navy">Fecha</th>
                                  <th className="text-right p-1 text-navy">Capital</th>
                                  <th className="text-right p-1 text-navy">Interés</th>
                                  <th className="text-right p-1 text-navy">Total</th>
                                  <th className="text-left p-1 text-navy">Moneda</th>
                                  <th className="text-left p-1 text-navy">Inflación %</th>
                                  <th className="text-left p-1 text-navy">Notas</th>
                                </tr>
                              </thead>
                              <tbody>
                                {devs.map(d => (
                                  <tr key={d.id} className="border-b border-gray-100 hover:bg-white">
                                    <td className="p-1">{fmtF(d.fecha)}</td>
                                    <td className="p-1 text-right text-green-700">{fmt(d.monto_capital, d.moneda)}</td>
                                    <td className="p-1 text-right text-orange-700">{fmt(d.monto_interes, d.moneda)}</td>
                                    <td className="p-1 text-right font-bold">{fmt(Number(d.monto_capital)+Number(d.monto_interes), d.moneda)}</td>
                                    <td className="p-1">{d.moneda}</td>
                                    <td className="p-1">{d.indice_inflacion ? `${d.indice_inflacion}% × ${d.periodo_meses || '?'}m` : '—'}</td>
                                    <td className="p-1 text-gray-600 max-w-xs truncate">{d.notas || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Acciones */}
                      {puedeGestionar && p.estado !== 'cancelado' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setPrestamoActivo(p); setDevForm({ ...devVacio, moneda: p.moneda }); setModalTipo('devolucion'); }}
                            className="btn-primary text-sm flex items-center gap-2"
                          >
                            <RefreshCw size={16}/> Registrar devolución
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL NUEVO PRÉSTAMO ─────────────────────────── */}
      {modalTipo === 'nuevo' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-navy text-white p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Nuevo Préstamo / Aporte Reintegrable</h2>
              <button onClick={() => setModalTipo(null)}><X size={22}/></button>
            </div>
            <form onSubmit={guardarPrestamo} className="p-5 space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-xs font-bold text-navy mb-1">Tipo de préstamo *</label>
                <div className="flex gap-3">
                  {['interno','externo'].map(t => (
                    <label key={t} className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer ${form.tipo === t ? 'border-navy bg-blue-50' : 'border-gray-200'}`}>
                      <input type="radio" value={t} checked={form.tipo === t} onChange={e => setF('tipo', e.target.value)} className="accent-navy" />
                      <div>
                        <p className="font-bold text-sm">{t === 'interno' ? '🔄 Interno' : '👤 Externo'}</p>
                        <p className="text-xs text-gray-500">{t === 'interno' ? 'Entre cajas del sistema' : 'De un tercero (miembro/externo)'}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Acreedor */}
              <div className={`rounded-lg p-3 space-y-3 ${form.tipo === 'interno' ? 'bg-green-50 border border-green-200' : 'bg-purple-50 border border-purple-200'}`}>
                <h3 className="text-xs font-bold uppercase text-gray-700">
                  {form.tipo === 'interno' ? '✅ Acreedor (quien presta)' : '👤 Tercero que presta'}
                </h3>
                {form.tipo === 'externo' ? (
                  <div>
                    <label className="block text-xs font-semibold text-navy mb-1">Nombre del tercero *</label>
                    <input type="text" value={form.acreedor_nombre} onChange={e => setF('acreedor_nombre', e.target.value)} placeholder="Juan Pérez" className="input-field w-full" required />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-navy mb-1">Templo acreedor *</label>
                      <select value={form.acreedor_templo_id} onChange={e => setF('acreedor_templo_id', e.target.value)} className="input-field w-full">
                        <option value="">Seleccionar...</option>
                        {templos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-navy mb-1">Caja acreedora *</label>
                      <SelectCajas value={form.acreedor_caja} onChange={v => setF('acreedor_caja', v)} />
                    </div>
                  </div>
                )}
              </div>

              {/* Deudor */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-3">
                <h3 className="text-xs font-bold uppercase text-gray-700">🏦 Deudor (quien recibe el préstamo)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-navy mb-1">Templo deudor *</label>
                    <select value={form.deudor_templo_id} onChange={e => setF('deudor_templo_id', e.target.value)} className="input-field w-full">
                      <option value="">Seleccionar...</option>
                      {templos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-navy mb-1">Caja deudora *</label>
                    <SelectCajas value={form.deudor_caja} onChange={v => setF('deudor_caja', v)} />
                  </div>
                </div>
              </div>

              {/* Monto, moneda y fecha */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-navy mb-1">Monto *</label>
                  <input type="number" value={form.monto_original} onChange={e => setF('monto_original', e.target.value)} placeholder="0,00" className="input-field w-full" min="0.01" step="0.01" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-navy mb-1">Moneda *</label>
                  <select value={form.moneda} onChange={e => setF('moneda', e.target.value)} className="input-field w-full">
                    {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-navy mb-1">Fecha *</label>
                  <input type="date" value={form.fecha} onChange={e => setF('fecha', e.target.value)} className="input-field w-full" required />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-navy mb-1">Descripción / Observaciones</label>
                <input type="text" value={form.descripcion} onChange={e => setF('descripcion', e.target.value)} placeholder="Motivo del préstamo" className="input-field w-full" />
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-400 text-blue-800 p-3 text-xs rounded">
                <strong>ℹ️ Movimientos que se crearán:</strong>
                {form.tipo === 'interno' ? (
                  <><br />• Egreso en {form.acreedor_caja ? nombreCaja(form.acreedor_caja) : '[caja acreedora]'} ({form.moneda})
                  <br />• Ingreso en {form.deudor_caja ? nombreCaja(form.deudor_caja) : '[caja deudora]'} ({form.moneda})</>
                ) : (
                  <><br />• Ingreso en {form.deudor_caja ? nombreCaja(form.deudor_caja) : '[caja deudora]'} ({form.moneda}) — el dinero entra al sistema desde el tercero</>
                )}
              </div>

              <div className="flex gap-2">
                <button type="submit" disabled={guardando} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
                  <Save size={18}/>{guardando ? 'Guardando...' : 'Registrar préstamo'}
                </button>
                <button type="button" onClick={() => setModalTipo(null)} className="btn-secondary">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL DEVOLUCIÓN ─────────────────────────────── */}
      {modalTipo === 'devolucion' && prestamoActivo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-navy text-white p-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Registrar Devolución</h2>
                <p className="text-xs opacity-75">Saldo pendiente: {fmt(saldoPendiente(prestamoActivo), prestamoActivo.moneda)}</p>
              </div>
              <button onClick={() => { setModalTipo(null); setPrestamoActivo(null); }}><X size={22}/></button>
            </div>
            <form onSubmit={guardarDevolucion} className="p-5 space-y-4">
              <div className="bg-gray-50 rounded p-3 text-sm space-y-1">
                <p><strong>Deudor:</strong> {nombreCaja(prestamoActivo.deudor_caja)} / {nombreTemplo(prestamoActivo.deudor_templo_id)}</p>
                <p><strong>Acreedor:</strong> {prestamoActivo.tipo === 'interno' ? `${nombreCaja(prestamoActivo.acreedor_caja)} / ${nombreTemplo(prestamoActivo.acreedor_templo_id)}` : prestamoActivo.acreedor_nombre}</p>
                <p><strong>Capital original:</strong> {fmt(prestamoActivo.monto_original, prestamoActivo.moneda)}</p>
                <p><strong>Saldo pendiente:</strong> <span className="text-red-700 font-bold">{fmt(saldoPendiente(prestamoActivo), prestamoActivo.moneda)}</span></p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-navy mb-1">Monto capital devuelto</label>
                  <input type="number" value={devForm.monto_capital} onChange={e => setD('monto_capital', e.target.value)} placeholder="0,00" className="input-field w-full" min="0" step="0.01" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-navy mb-1">Monto interés (ajuste inflación)</label>
                  <input type="number" value={devForm.monto_interes} onChange={e => setD('monto_interes', e.target.value)} placeholder="0,00" className="input-field w-full" min="0" step="0.01" />
                </div>
              </div>

              {/* Cálculo de interés por inflación */}
              <div className="bg-orange-50 border border-orange-200 rounded p-3 space-y-3">
                <p className="text-xs font-bold text-orange-800">📊 Referencia — Cálculo por inflación (opcional)</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Índice mensual %</label>
                    <input type="number" value={devForm.indice_inflacion} onChange={e => {
                      setD('indice_inflacion', e.target.value);
                      const inf = Number(e.target.value)/100;
                      const meses = Number(devForm.periodo_meses) || 0;
                      const capital = Number(devForm.monto_capital || saldoPendiente(prestamoActivo));
                      if (inf > 0 && meses > 0) setD('monto_interes', (capital * inf * meses).toFixed(2));
                    }} placeholder="3.7" className="input-field w-full text-sm" step="0.01" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Meses</label>
                    <input type="number" value={devForm.periodo_meses} onChange={e => {
                      setD('periodo_meses', e.target.value);
                      const inf = Number(devForm.indice_inflacion)/100;
                      const meses = Number(e.target.value);
                      const capital = Number(devForm.monto_capital || saldoPendiente(prestamoActivo));
                      if (inf > 0 && meses > 0) setD('monto_interes', (capital * inf * meses).toFixed(2));
                    }} placeholder="3" className="input-field w-full text-sm" min="1" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Interés calculado</label>
                    <p className="input-field bg-gray-100 text-orange-700 font-bold text-sm flex items-center">
                      {devForm.monto_interes ? fmt(devForm.monto_interes, devForm.moneda) : '—'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Al completar índice y meses, el interés se calcula automáticamente. Podés ajustarlo manualmente arriba.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-navy mb-1">Moneda de la devolución</label>
                  <select value={devForm.moneda} onChange={e => setD('moneda', e.target.value)} className="input-field w-full">
                    {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {devForm.moneda !== prestamoActivo.moneda && (
                    <p className="text-xs text-orange-600 mt-1">⚠️ Moneda distinta al préstamo original ({prestamoActivo.moneda})</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-navy mb-1">Fecha</label>
                  <input type="date" value={devForm.fecha} onChange={e => setD('fecha', e.target.value)} className="input-field w-full" required />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-navy mb-1">Notas</label>
                <input type="text" value={devForm.notas} onChange={e => setD('notas', e.target.value)} placeholder="Observaciones de la devolución" className="input-field w-full" />
              </div>

              {/* Total */}
              <div className="bg-gray-50 rounded p-3 text-sm font-bold text-navy flex justify-between">
                <span>Total a registrar:</span>
                <span>{fmt((Number(devForm.monto_capital)||0)+(Number(devForm.monto_interes)||0), devForm.moneda)}</span>
              </div>

              <div className="flex gap-2">
                <button type="submit" disabled={guardando} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
                  <Save size={18}/>{guardando ? 'Guardando...' : 'Registrar devolución'}
                </button>
                <button type="button" onClick={() => { setModalTipo(null); setPrestamoActivo(null); }} className="btn-secondary">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
