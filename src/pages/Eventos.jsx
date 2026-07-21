import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import Papa from 'papaparse';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Calendar, ChevronLeft, Plus, Edit2, Save, X, TrendingUp, TrendingDown, DollarSign, FileText, Users } from 'lucide-react';

const COLORS = ['#FFD700','#001F3F','#4CAF50','#F44336','#9C27B0','#FF9800','#2196F3','#795548'];
const fmt = (n) => `$ ${Number(n||0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtC = (n) => { if(Math.abs(n)>=1000000) return `$${(n/1000000).toFixed(1)}M`; if(Math.abs(n)>=1000) return `$${(n/1000).toFixed(0)}k`; return `$${n}`; };
const fmtF = (s) => s ? new Date(s+'T00:00:00').toLocaleDateString('es-AR') : '—';

const Tarjeta = ({titulo,monto,icono:Icon,color}) => (
  <div className={`card bg-gradient-to-br ${color} text-white`}>
    <div className="flex items-center justify-between">
      <div><p className="text-sm opacity-80">{titulo}</p><p className="text-2xl font-bold mt-1">{fmt(monto)}</p></div>
      <Icon size={40} className="opacity-60" />
    </div>
  </div>
);

export default function Eventos({ usuario }) {
  const [eventos, setEventos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [templos, setTemplos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventoActivo, setEventoActivo] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ nombre:'', descripcion:'', fecha_inicio:'', fecha_fin:'' });

  const puedeEditar = ['admin','tesorero'].includes(usuario?.rol);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    const [evRes, movRes, tempRes] = await Promise.all([
      supabase.from('eventos').select('*').order('fecha_inicio', { ascending: false }),
      supabase.from('movimientos').select('*').not('evento_id','is',null),
      supabase.from('templos').select('*').order('nombre'),
    ]);
    setEventos(evRes.data || []);
    setMovimientos(movRes.data || []);
    setTemplos(tempRes.data || []);
    setLoading(false);
  };

  const msg = (txt) => { setMensaje(txt); setTimeout(()=>setMensaje(''),4000); };

  const abrirNuevo = () => { setEditandoId(null); setForm({nombre:'',descripcion:'',fecha_inicio:'',fecha_fin:''}); setFormAbierto(true); };
  const abrirEditar = (ev) => { setEditandoId(ev.id); setForm({nombre:ev.nombre,descripcion:ev.descripcion||'',fecha_inicio:ev.fecha_inicio||'',fecha_fin:ev.fecha_fin||''}); setFormAbierto(true); };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) return msg('❌ El nombre es obligatorio');
    const datos = { nombre:form.nombre.trim(), descripcion:form.descripcion.trim()||null, fecha_inicio:form.fecha_inicio||null, fecha_fin:form.fecha_fin||null, updated_at:new Date().toISOString() };
    const { error } = editandoId
      ? await supabase.from('eventos').update(datos).eq('id', editandoId)
      : await supabase.from('eventos').insert(datos);
    if (error) return msg('❌ ' + error.message);
    msg(editandoId ? '✅ Evento actualizado' : '✅ Evento creado');
    setFormAbierto(false); setEditandoId(null);
    cargar();
  };

  const movsEvento = useMemo(() => eventoActivo ? movimientos.filter(m => m.evento_id === eventoActivo.id) : [], [movimientos, eventoActivo]);
  const totalIng = useMemo(() => movsEvento.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0), [movsEvento]);
  const totalEgr = useMemo(() => movsEvento.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+m.monto,0), [movsEvento]);
  const saldo = totalIng - totalEgr;

  const porTemplo = useMemo(() => {
    const g = {};
    movsEvento.forEach(m => {
      const t = templos.find(x=>x.id===m.templo_id)?.nombre || 'Sin templo';
      if (!g[t]) g[t] = {templo:t,ingresos:0,egresos:0};
      if (m.tipo==='ingreso') g[t].ingresos+=m.monto; else g[t].egresos+=m.monto;
    });
    return Object.values(g).sort((a,b)=>(b.ingresos+b.egresos)-(a.ingresos+a.egresos));
  }, [movsEvento, templos]);

  const egresosConcepto = useMemo(() => {
    const g = {};
    movsEvento.filter(m=>m.tipo==='egreso').forEach(m => { g[m.concepto]=(g[m.concepto]||0)+m.monto; });
    return Object.entries(g).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  }, [movsEvento]);

  const ingresosConcepto = useMemo(() => {
    const g = {};
    movsEvento.filter(m=>m.tipo==='ingreso').forEach(m => { g[m.concepto]=(g[m.concepto]||0)+m.monto; });
    return Object.entries(g).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  }, [movsEvento]);

  const resumenEventos = useMemo(() => eventos.map(ev => {
    const movs = movimientos.filter(m=>m.evento_id===ev.id);
    const ing = movs.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0);
    const egr = movs.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+m.monto,0);
    return {...ev, totalIngresos:ing, totalEgresos:egr, saldo:ing-egr, cantMovs:movs.length};
  }), [eventos, movimientos]);

  const exportarCSV = () => {
    const data = movsEvento.map(m => ({
      Fecha: new Date(m.fecha+'T00:00:00').toLocaleDateString('es-AR'),
      Tipo: m.tipo, Concepto: m.concepto, Monto: m.monto, Moneda: m.moneda,
      Templo: templos.find(t=>t.id===m.templo_id)?.nombre||'—',
      Caja: m.ubicacion, Detalle: m.detalle||'—',
    }));
    const blob = new Blob(['\ufeff'+Papa.unparse(data)],{type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `evento-${eventoActivo.nombre.replace(/\s/g,'-')}.csv`;
    a.click();
  };

  if (loading) return <div className="flex items-center justify-center py-24"><div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin" /></div>;

  // ── DETALLE DEL EVENTO ────────────────────────────────────
  if (eventoActivo) return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={()=>setEventoActivo(null)} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft size={24} className="text-navy" /></button>
          <div>
            <h1 className="text-3xl font-bold text-navy">{eventoActivo.nombre}</h1>
            {eventoActivo.descripcion && <p className="text-sm text-gray-600">{eventoActivo.descripcion}</p>}
            {(eventoActivo.fecha_inicio||eventoActivo.fecha_fin) && (
              <p className="text-xs text-gray-500 mt-1"><Calendar size={12} className="inline mr-1" />{fmtF(eventoActivo.fecha_inicio)}{eventoActivo.fecha_fin&&` → ${fmtF(eventoActivo.fecha_fin)}`}</p>
            )}
          </div>
        </div>
        <button onClick={exportarCSV} className="btn-secondary flex items-center gap-2 text-sm"><FileText size={16}/>Exportar CSV</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Tarjeta titulo="Total Ingresos" monto={totalIng} icono={TrendingUp} color="from-green-600 to-green-700" />
        <Tarjeta titulo="Total Egresos" monto={totalEgr} icono={TrendingDown} color="from-red-600 to-red-700" />
        <Tarjeta titulo="Saldo del Evento" monto={saldo} icono={DollarSign} color={saldo>=0?"from-navy to-navy-dark":"from-orange-600 to-orange-700"} />
      </div>

      {movsEvento.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          <p>No hay movimientos asignados a este evento todavía.</p>
          <p className="text-sm mt-2">Al cargar un ingreso o egreso, seleccioná este evento en el campo correspondiente.</p>
        </div>
      ) : (<>
        <div className="card">
          <h2 className="text-xl font-bold text-navy mb-4">Ingresos y Egresos por Templo</h2>
          <ResponsiveContainer width="100%" height={Math.max(260,porTemplo.length*50)}>
            <BarChart data={porTemplo} layout="vertical" margin={{left:10,right:20}}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={fmtC} tick={{fontSize:11}} />
              <YAxis type="category" dataKey="templo" width={110} tick={{fontSize:11}} />
              <Tooltip formatter={v=>fmt(v)} />
              <Legend />
              <Bar dataKey="ingresos" name="Ingresos" fill="#4CAF50" radius={[0,4,4,0]} />
              <Bar dataKey="egresos" name="Egresos" fill="#F44336" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[{titulo:'Ingresos por Concepto',data:ingresosConcepto,color:'text-green-700'},{titulo:'Egresos por Concepto',data:egresosConcepto,color:'text-red-700'}].map(({titulo,data,color})=>(
            <div key={titulo} className="card">
              <h2 className="text-xl font-bold text-navy mb-4">{titulo}</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({percent})=>`${(percent*100).toFixed(0)}%`}>
                    {data.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v=>fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {data.map((d,i)=>(
                  <div key={d.name} className="flex justify-between text-sm">
                    <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{background:COLORS[i%COLORS.length],display:'inline-block'}} />{d.name}</span>
                    <span className={`font-bold ${color}`}>{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h2 className="text-xl font-bold text-navy mb-4">Movimientos del Evento <span className="text-sm font-normal text-gray-500">({movsEvento.length})</span></h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gold">
                  {['Fecha','Tipo','Concepto','Monto','Templo','Detalle'].map(h=><th key={h} className={`p-2 text-navy font-bold ${h==='Monto'?'text-right':'text-left'}`}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {[...movsEvento].sort((a,b)=>new Date(a.fecha)-new Date(b.fecha)).map(m=>(
                  <tr key={m.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 text-xs whitespace-nowrap">{fmtF(m.fecha)}</td>
                    <td className="p-2"><span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${m.tipo==='ingreso'?'bg-green-500':'bg-red-500'}`}>{m.tipo==='ingreso'?'ING':'EGR'}</span></td>
                    <td className="p-2 text-xs">{m.concepto}</td>
                    <td className={`p-2 text-right font-mono text-sm font-bold ${m.tipo==='ingreso'?'text-green-700':'text-red-700'}`}>{m.tipo==='egreso'?'-':''}{fmt(m.monto)}</td>
                    <td className="p-2 text-xs">{templos.find(t=>t.id===m.templo_id)?.nombre||'—'}</td>
                    <td className="p-2 text-xs text-gray-600 max-w-xs truncate">{m.detalle||'—'}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-navy bg-gray-50 font-bold">
                  <td colSpan={3} className="p-2 text-right text-navy text-sm">TOTALES</td>
                  <td className="p-2 text-right font-mono">
                    <div className="text-green-700 text-xs">↑ {fmt(totalIng)}</div>
                    <div className="text-red-700 text-xs">↓ {fmt(totalEgr)}</div>
                    <div className={`text-sm ${saldo>=0?'text-navy':'text-orange-700'}`}>{fmt(saldo)}</div>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </>)}
    </div>
  );

  // ── LISTA DE EVENTOS ──────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-navy">Eventos</h1>
          <p className="text-sm text-gray-600">Conferencias y congresos de la IEUP</p>
        </div>
        {puedeEditar && <button onClick={abrirNuevo} className="btn-primary flex items-center gap-2"><Plus size={20}/>Nuevo Evento</button>}
      </div>

      {mensaje && <div className={`card ${mensaje.startsWith('✅')?'bg-green-50 border-l-4 border-green-500 text-green-800':'bg-red-50 border-l-4 border-red-500 text-red-800'}`}>{mensaje}</div>}

      {formAbierto && puedeEditar && (
        <form onSubmit={guardar} className="card bg-blue-50 border-l-4 border-blue-500 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-navy">{editandoId?'Editar Evento':'Nuevo Evento'}</h2>
            <button type="button" onClick={()=>{setFormAbierto(false);setEditandoId(null);}} className="text-gray-500 hover:text-gray-700"><X size={22}/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="block text-xs font-bold text-navy mb-1">Nombre *</label><input type="text" value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="Conferencia IEUP 2027" className="input-field w-full" required /></div>
            <div><label className="block text-xs font-bold text-navy mb-1">Descripción</label><input type="text" value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} placeholder="Descripción opcional" className="input-field w-full" /></div>
            <div><label className="block text-xs font-bold text-navy mb-1">Fecha inicio</label><input type="date" value={form.fecha_inicio} onChange={e=>setForm(f=>({...f,fecha_inicio:e.target.value}))} className="input-field w-full" /></div>
            <div><label className="block text-xs font-bold text-navy mb-1">Fecha fin</label><input type="date" value={form.fecha_fin} onChange={e=>setForm(f=>({...f,fecha_fin:e.target.value}))} className="input-field w-full" /></div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex items-center gap-2"><Save size={18}/>{editandoId?'Actualizar':'Crear'}</button>
            <button type="button" onClick={()=>{setFormAbierto(false);setEditandoId(null);}} className="btn-secondary">Cancelar</button>
          </div>
        </form>
      )}

      {resumenEventos.length === 0 ? (
        <div className="card text-center py-12 text-gray-500"><Users size={48} className="mx-auto mb-3 opacity-30"/><p>No hay eventos cargados</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {resumenEventos.map(ev=>(
            <div key={ev.id} className="card cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-gold" onClick={()=>setEventoActivo(ev)}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-navy">{ev.nombre}</h3>
                  {ev.descripcion && <p className="text-xs text-gray-500 mt-0.5">{ev.descripcion}</p>}
                  {(ev.fecha_inicio||ev.fecha_fin) && <p className="text-xs text-gray-400 mt-1"><Calendar size={11} className="inline mr-1"/>{fmtF(ev.fecha_inicio)}{ev.fecha_fin&&` → ${fmtF(ev.fecha_fin)}`}</p>}
                </div>
                {puedeEditar && <button onClick={e=>{e.stopPropagation();abrirEditar(ev);}} className="p-1.5 text-gray-400 hover:text-navy hover:bg-gray-100 rounded ml-2"><Edit2 size={16}/></button>}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-green-50 rounded p-2"><p className="text-xs text-gray-500">Ingresos</p><p className="text-sm font-bold text-green-700">{fmt(ev.totalIngresos)}</p></div>
                <div className="bg-red-50 rounded p-2"><p className="text-xs text-gray-500">Egresos</p><p className="text-sm font-bold text-red-700">{fmt(ev.totalEgresos)}</p></div>
                <div className={`rounded p-2 ${ev.saldo>=0?'bg-blue-50':'bg-orange-50'}`}><p className="text-xs text-gray-500">Saldo</p><p className={`text-sm font-bold ${ev.saldo>=0?'text-navy':'text-orange-700'}`}>{fmt(ev.saldo)}</p></div>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-right">{ev.cantMovs} movimientos · Click para ver detalle →</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
