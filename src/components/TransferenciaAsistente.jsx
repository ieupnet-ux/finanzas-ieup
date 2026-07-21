import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { ArrowRight, RefreshCw, Check, X, AlertCircle } from 'lucide-react';

const detectarConcepto = (cajaOrigenGrupo, cajaDestinoGrupo, cajaOrigenValor, cajaDestinoValor) => {
  const esPF = (v) => v && v.endsWith('-pf');
  if (cajaOrigenGrupo === 'cajas' && cajaDestinoGrupo === 'cajas') return 'Transferencia entre Cajas';
  if (cajaOrigenGrupo === 'cajas' && cajaDestinoGrupo === 'bancos') return esPF(cajaDestinoValor) ? 'Constitución de Plazo Fijo' : 'Depósito Bancario';
  if (cajaOrigenGrupo === 'bancos' && cajaDestinoGrupo === 'cajas') return esPF(cajaOrigenValor) ? 'Cierre de Plazo Fijo' : 'Extracción Bancaria';
  if (cajaOrigenGrupo === 'bancos' && cajaDestinoGrupo === 'bancos') {
    if (esPF(cajaDestinoValor)) return 'Constitución de Plazo Fijo';
    if (esPF(cajaOrigenValor)) return 'Cierre de Plazo Fijo';
    return 'Movimiento entre Cuentas';
  }
  if (cajaOrigenGrupo === 'billeteras' && cajaDestinoGrupo === 'bancos') return 'Depósito Bancario';
  if (cajaOrigenGrupo === 'bancos' && cajaDestinoGrupo === 'billeteras') return 'Movimiento entre Cuentas';
  if (cajaOrigenGrupo === 'billeteras' && cajaDestinoGrupo === 'billeteras') return 'Movimiento entre Cuentas';
  if (cajaOrigenGrupo === 'billeteras' && cajaDestinoGrupo === 'cajas') return 'Extracción Bancaria';
  if (cajaOrigenGrupo === 'cajas' && cajaDestinoGrupo === 'billeteras') return 'Depósito Bancario';
  return 'Movimiento entre Cuentas';
};

const COLORES_CONCEPTO = {
  'Transferencia entre Cajas': 'bg-blue-100 text-blue-800',
  'Depósito Bancario': 'bg-green-100 text-green-800',
  'Extracción Bancaria': 'bg-orange-100 text-orange-800',
  'Movimiento entre Cuentas': 'bg-purple-100 text-purple-800',
  'Constitución de Plazo Fijo': 'bg-yellow-100 text-yellow-800',
  'Cierre de Plazo Fijo': 'bg-red-100 text-red-800',
};

const fmtMonto = (n) => `$ ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function TransferenciaAsistente({ abierto, onCerrar, onCreado, usuarioTemplo }) {
  const [cajas, setCajas] = useState([]);
  const [templos, setTemplos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const hoy = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ fecha: hoy, monto: '', detalle: '', templo_origen: '', caja_origen: '', templo_destino: '', caja_destino: '' });

  useEffect(() => {
    if (abierto) {
      cargar();
      setForm({ fecha: hoy, monto: '', detalle: '', templo_origen: usuarioTemplo || '', caja_origen: '', templo_destino: '', caja_destino: '' });
      setError(''); setExito('');
    }
  }, [abierto]);

  const cargar = async () => {
    setLoading(true);
    const [cajasRes, templosRes] = await Promise.all([
      supabase.from('cajas').select('*').eq('activo', true).order('grupo').order('orden'),
      supabase.from('templos').select('*').order('nombre'),
    ]);
    setCajas(cajasRes.data || []);
    setTemplos(templosRes.data || []);
    setLoading(false);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const cajasPorGrupo = useMemo(() => {
    const g = { cajas: [], bancos: [], billeteras: [] };
    cajas.forEach(c => { if (g[c.grupo]) g[c.grupo].push(c); });
    return g;
  }, [cajas]);

  const cajaOrigen = useMemo(() => cajas.find(c => c.valor === form.caja_origen), [cajas, form.caja_origen]);
  const cajaDestino = useMemo(() => cajas.find(c => c.valor === form.caja_destino), [cajas, form.caja_destino]);
  const temploOrigenId = templos.find(t => t.nombre === form.templo_origen)?.id;
  const temploDestinoId = templos.find(t => t.nombre === form.templo_destino)?.id;

  const concepto = useMemo(() => {
    if (!cajaOrigen || !cajaDestino) return null;
    return detectarConcepto(cajaOrigen.grupo, cajaDestino.grupo, cajaOrigen.valor, cajaDestino.valor);
  }, [cajaOrigen, cajaDestino]);

  const monto = parseFloat(form.monto) || 0;
  const valido = form.fecha && monto > 0 && form.caja_origen && form.caja_destino &&
    form.templo_origen && form.templo_destino && form.caja_origen !== form.caja_destino && concepto !== null;

  const guardar = async () => {
    if (!valido) return;
    setGuardando(true); setError('');
    try {
      const tipoTrans = () => {
        if (cajaOrigen?.grupo === 'bancos') return 'extraccion';
        if (cajaDestino?.grupo === 'bancos') return 'deposito';
        if (cajaOrigen?.grupo === 'billeteras' || cajaDestino?.grupo === 'billeteras') return 'billetera-virtual';
        return 'efectivo';
      };
      const base = { fecha: form.fecha, monto, moneda: 'ARS', concepto, detalle: form.detalle.trim() || `${cajaOrigen?.nombre} a ${cajaDestino?.nombre}`, tipo_transaccion: tipoTrans() };
      const { error: err } = await supabase.from('movimientos').insert([
        { ...base, tipo: 'egreso', ubicacion: form.caja_origen, templo_id: temploOrigenId },
        { ...base, tipo: 'ingreso', ubicacion: form.caja_destino, templo_id: temploDestinoId },
      ]);
      if (err) throw err;
      setExito(`✅ ${fmtMonto(monto)} transferido: ${cajaOrigen?.nombre} → ${cajaDestino?.nombre}`);
      if (onCreado) onCreado();
      setTimeout(() => { onCerrar(); setExito(''); }, 3000);
    } catch (e) { setError('❌ Error: ' + e.message); }
    finally { setGuardando(false); }
  };

  const SelectCajas = ({ value, onChange, disabled }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field w-full" disabled={disabled}>
      <option value="">Seleccionar...</option>
      <optgroup label="Cajas">{cajasPorGrupo.cajas.map(c => <option key={c.valor} value={c.valor}>{c.emoji} {c.nombre}</option>)}</optgroup>
      <optgroup label="Bancos">{cajasPorGrupo.bancos.map(c => <option key={c.valor} value={c.valor}>{c.emoji} {c.nombre}</option>)}</optgroup>
      <optgroup label="Billeteras y Otros">{cajasPorGrupo.billeteras.map(c => <option key={c.valor} value={c.valor}>{c.emoji} {c.nombre}</option>)}</optgroup>
    </select>
  );

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-navy text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><RefreshCw size={22} /><h2 className="text-lg font-bold">Nueva Transferencia</h2></div>
          <button onClick={onCerrar} className="p-1 hover:bg-navy-dark rounded"><X size={22} /></button>
        </div>

        {loading ? <div className="p-8 text-center text-gray-500">Cargando...</div> : (
          <div className="p-5 space-y-5">
            <p className="text-xs text-gray-600">Elegí el origen, destino y monto. El sistema crea los 2 movimientos con el concepto correcto automáticamente.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-navy mb-1">Fecha *</label>
                <input type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} className="input-field w-full" />
              </div>
              <div>
                <label className="block text-xs font-bold text-navy mb-1">Monto *</label>
                <input type="number" value={form.monto} onChange={(e) => set('monto', e.target.value)} placeholder="0,00" className="input-field w-full" min="0.01" step="0.01" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ORIGEN */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                <h3 className="text-xs font-bold text-red-700 uppercase">📤 Origen — sale de</h3>
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Templo *</label>
                  <select value={form.templo_origen} onChange={(e) => { set('templo_origen', e.target.value); set('caja_origen', ''); }} className="input-field w-full">
                    <option value="">Seleccionar...</option>
                    {templos.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Caja *</label>
                  <SelectCajas value={form.caja_origen} onChange={(v) => set('caja_origen', v)} disabled={!form.templo_origen} />
                </div>
                {cajaOrigen && <p className="text-xs text-red-700 font-medium">{cajaOrigen.emoji} {cajaOrigen.nombre}</p>}
              </div>

              {/* DESTINO */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                <h3 className="text-xs font-bold text-green-700 uppercase">📥 Destino — llega a</h3>
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Templo *</label>
                  <select value={form.templo_destino} onChange={(e) => { set('templo_destino', e.target.value); set('caja_destino', ''); }} className="input-field w-full">
                    <option value="">Seleccionar...</option>
                    {templos.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Caja *</label>
                  <SelectCajas value={form.caja_destino} onChange={(v) => set('caja_destino', v)} disabled={!form.templo_destino} />
                </div>
                {cajaDestino && <p className="text-xs text-green-700 font-medium">{cajaDestino.emoji} {cajaDestino.nombre}</p>}
              </div>
            </div>

            {concepto && (
              <div className={`flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold ${COLORES_CONCEPTO[concepto] || 'bg-gray-100 text-gray-800'}`}>
                <Check size={16} />
                <span>Concepto: {concepto}</span>
                {cajaOrigen && cajaDestino && (
                  <span className="font-normal opacity-80">({cajaOrigen.nombre} <ArrowRight size={12} className="inline" /> {cajaDestino.nombre})</span>
                )}
              </div>
            )}

            {form.caja_origen && form.caja_destino && form.caja_origen === form.caja_destino && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">
                <AlertCircle size={16} /> La caja de origen y destino no pueden ser la misma.
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-navy mb-1">Detalle (opcional)</label>
              <input type="text" value={form.detalle} onChange={(e) => set('detalle', e.target.value)}
                placeholder={cajaOrigen && cajaDestino ? `${cajaOrigen.nombre} a ${cajaDestino.nombre}` : 'Descripción del movimiento'}
                className="input-field w-full" />
            </div>

            {valido && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1">
                <p className="font-bold text-navy text-xs uppercase mb-2">Vista previa — se crearán 2 movimientos:</p>
                <div className="flex items-center gap-2 text-red-700"><span className="font-bold w-16">EGRESO</span><span>{fmtMonto(monto)}</span><span className="text-gray-400">—</span><span>{form.templo_origen} / {cajaOrigen?.nombre}</span></div>
                <div className="flex items-center gap-2 text-green-700"><span className="font-bold w-16">INGRESO</span><span>{fmtMonto(monto)}</span><span className="text-gray-400">—</span><span>{form.templo_destino} / {cajaDestino?.nombre}</span></div>
                <p className="text-gray-500 text-xs pt-1">Concepto: <strong>{concepto}</strong> · Fecha: {form.fecha} · ARS</p>
              </div>
            )}

            {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-3 text-sm rounded">{error}</div>}
            {exito && <div className="bg-green-50 border-l-4 border-green-500 text-green-800 p-3 text-sm rounded">{exito}</div>}

            <div className="flex gap-2 pt-2">
              <button onClick={guardar} disabled={!valido || guardando} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
                <RefreshCw size={18} className={guardando ? 'animate-spin' : ''} />
                {guardando ? 'Creando...' : 'Crear transferencia'}
              </button>
              <button onClick={onCerrar} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
