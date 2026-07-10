import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Download, Plus, Settings, Edit2, Trash2, X } from 'lucide-react';
import Papa from 'papaparse';

export default function Egresos() {
  const [egresos, setEgresos] = useState([]);
  const [conceptos, setConceptos] = useState([]);
  const [templos, setTemplos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newConcept, setNewConcept] = useState('');
  const [formData, setFormData] = useState({
    monto: '',
    concepto: '',
    templo: '',
    moneda: 'ARS',
    tipo_transaccion: 'efectivo',
    ubicacion: 'general',
    detalle: '',
    fecha: new Date().toISOString().split('T')[0]
  });

  const monedas = [
    { code: 'ARS', label: '🇦🇷 Pesos Argentinos' },
    { code: 'USD', label: '🇺🇸 Dólares' },
    { code: 'CLP', label: '🇨🇱 Pesos Chilenos' }
  ];

  const tiposTransaccion = [
    { value: 'efectivo', label: '💵 Efectivo' },
    { value: 'deposito', label: '🏦 Depósito Bancario' },
    { value: 'extraccion', label: '💸 Extracción Bancaria' },
    { value: 'plazo-fijo', label: '📅 Plazo Fijo' },
    { value: 'billetera-virtual', label: '📱 Billetera Virtual' }
  ];

  const ubicaciones = [
    // CAJAS
    { value: 'adolescentes', label: '👦 Adolescentes' },
    { value: 'ciclistas', label: '🚴 Ciclistas' },
    { value: 'coro', label: '🎵 Coro' },
    { value: 'coro-juvenil', label: '🎤 Coro Juvenil' },
    { value: 'dorcas', label: '👵 Dorcas' },
    { value: 'general', label: '💼 General' },
    { value: 'jovenes', label: '👥 Jóvenes' },
    { value: 'ninos', label: '👶 Niños' },
    { value: 'porteras', label: '👩 Porteras' },
    { value: 'porteros', label: '👨 Porteros' },
    { value: 'emisora', label: '📻 Emisora' },
    { value: 'cajas', label: '📦 Cajas' },
    { value: 'reposteria', label: '🍰 Repostería' },
    { value: 'secretaria', label: '📋 Secretaría' },
    // BANCOS
    { value: 'banco-nacion', label: '🏦 Banco Nación' },
    { value: 'banco-macro', label: '🏦 Banco Macro' },
    // OTROS
    { value: 'plazo-fijo', label: '📅 Plazo Fijo' },
    { value: 'mercado-pago', label: '📱 Mercado Pago' },
    { value: 'billetera-virtual', label: '📱 Billetera Virtual' },
    { value: 'otro', label: '❓ Otro' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: egr } = await supabase.from('movimientos').select('*').eq('tipo', 'egreso');
    setEgresos(egr || []);

    const { data: conceptosData } = await supabase.from('conceptos').select('*').eq('tipo', 'egreso');
    setConceptos(conceptosData || []);

    const { data: temp } = await supabase.from('templos').select('*');
    setTemplos(temp || []);
  };

  const handleAddConcept = async () => {
    if (!newConcept) return;
    
    await supabase.from('conceptos').insert({
      nombre: newConcept,
      tipo: 'egreso'
    });
    
    setNewConcept('');
    loadData();
  };

  const handleAddEgreso = async (e) => {
    e.preventDefault();
    
    if (editingId) {
      await supabase.from('movimientos').update({
        monto: parseFloat(formData.monto),
        concepto: formData.concepto,
        templo_id: formData.templo,
        moneda: formData.moneda,
        tipo_transaccion: formData.tipo_transaccion,
        ubicacion: formData.ubicacion,
        detalle: formData.detalle,
        fecha: formData.fecha
      }).eq('id', editingId);
      
      setEditingId(null);
    } else {
      await supabase.from('movimientos').insert({
        monto: parseFloat(formData.monto),
        concepto: formData.concepto,
        templo_id: formData.templo,
        moneda: formData.moneda,
        tipo_transaccion: formData.tipo_transaccion,
        ubicacion: formData.ubicacion,
        detalle: formData.detalle,
        tipo: 'egreso',
        fecha: formData.fecha
      });
    }
    
    setFormData({ 
      monto: '', concepto: '', templo: '', moneda: 'ARS', 
      tipo_transaccion: 'efectivo', ubicacion: 'general', 
      detalle: '', fecha: new Date().toISOString().split('T')[0] 
    });
    setShowForm(false);
    loadData();
  };

  const handleEditEgreso = (egreso) => {
    setFormData({
      monto: egreso.monto,
      concepto: egreso.concepto,
      templo: egreso.templo_id || '',
      moneda: egreso.moneda || 'ARS',
      tipo_transaccion: egreso.tipo_transaccion || 'efectivo',
      ubicacion: egreso.ubicacion || 'general',
      detalle: egreso.detalle || '',
      fecha: egreso.fecha.split('T')[0]
    });
    setEditingId(egreso.id);
    setShowForm(true);
  };

  const handleDeleteEgreso = async (id) => {
    if (confirm('¿Eliminar este egreso? La acción quedará registrada en auditoría.')) {
      await supabase.from('movimientos').delete().eq('id', id);
      loadData();
    }
  };

  const handleExportCSV = () => {
    const data = egresos.map(e => ({
      Fecha: new Date(e.fecha).toLocaleDateString('es-ES'),
      Concepto: e.concepto,
      Monto: e.monto,
      Moneda: e.moneda || 'ARS',
      Tipo: tiposTransaccion.find(t => t.value === e.tipo_transaccion)?.label || '—',
      Ubicación: ubicaciones.find(u => u.value === e.ubicacion)?.label || '—',
      Templo: e.templo_id ? templos.find(t => t.id === e.templo_id)?.nombre || '—' : '—',
      Detalle: e.detalle || '—'
    }));

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `egresos-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getMonedaSymbol = (moneda) => {
    const symbols = { 'ARS': '$', 'USD': 'U$S', 'CLP': '$' };
    return symbols[moneda] || '$';
  };

  return (
    <div className="space-y-6">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-navy mb-2">Egresos</h1>
          <p className="text-gray-600">Registro y gestión de egresos en múltiples monedas y ubicaciones</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="btn-primary flex items-center gap-2"
          >
            <Download size={20} />
            Exportar CSV
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="btn-secondary flex items-center gap-2"
          >
            <Settings size={20} />
            Conceptos
          </button>
          <button
            onClick={() => {
              setShowForm(!showForm);
              if (!showForm) setEditingId(null);
              setFormData({ 
                monto: '', concepto: '', templo: '', moneda: 'ARS', 
                tipo_transaccion: 'efectivo', ubicacion: 'general', 
                detalle: '', fecha: new Date().toISOString().split('T')[0] 
              });
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Nuevo Egreso
          </button>
        </div>
      </div>

      {/* Panel de configuración de conceptos */}
      {showSettings && (
        <div className="card bg-red-50 border-l-4 border-red-500">
          <h2 className="text-xl font-bold text-navy mb-4">Administrar Conceptos de Egresos</h2>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nuevo concepto"
                value={newConcept}
                onChange={(e) => setNewConcept(e.target.value)}
                className="input-field flex-1"
              />
              <button onClick={handleAddConcept} className="btn-primary">
                Agregar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {conceptos.filter(c => c.tipo === 'egreso').map((c) => (
                <span key={c.id} className="bg-red-200 text-red-800 px-3 py-1 rounded">
                  {c.nombre}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Formulario para nuevo egreso */}
      {showForm && (
        <form onSubmit={handleAddEgreso} className="card bg-red-50 border-l-4 border-red-500">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-navy">{editingId ? 'Editar Egreso' : 'Registrar Nuevo Egreso'}</h2>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="number"
              placeholder="Monto"
              value={formData.monto}
              onChange={(e) => setFormData({...formData, monto: e.target.value})}
              className="input-field"
              required
            />
            <select
              value={formData.concepto}
              onChange={(e) => setFormData({...formData, concepto: e.target.value})}
              className="input-field"
              required
            >
              <option value="">Selecciona concepto</option>
              {conceptos.filter(c => c.tipo === 'egreso').map((c) => (
                <option key={c.id} value={c.nombre}>{c.nombre}</option>
              ))}
            </select>
            <select
              value={formData.moneda}
              onChange={(e) => setFormData({...formData, moneda: e.target.value})}
              className="input-field"
              required
            >
              {monedas.map((m) => (
                <option key={m.code} value={m.code}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <select
              value={formData.tipo_transaccion}
              onChange={(e) => setFormData({...formData, tipo_transaccion: e.target.value})}
              className="input-field"
              required
            >
              {tiposTransaccion.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={formData.ubicacion}
              onChange={(e) => setFormData({...formData, ubicacion: e.target.value})}
              className="input-field"
              required
            >
              {ubicaciones.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
            <select
              value={formData.templo}
              onChange={(e) => setFormData({...formData, templo: e.target.value})}
              className="input-field"
            >
              <option value="">Selecciona templo (opcional)</option>
              {templos.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <input
              type="text"
              placeholder="Detalle/Observación (opcional)"
              value={formData.detalle}
              onChange={(e) => setFormData({...formData, detalle: e.target.value})}
              className="input-field w-full"
            />
          </div>

          <div className="mt-4">
            <input
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData({...formData, fecha: e.target.value})}
              className="input-field w-full"
            />
          </div>

          <button type="submit" className="btn-primary mt-4 w-full">
            {editingId ? 'Actualizar Egreso' : 'Guardar Egreso'}
          </button>
        </form>
      )}

      {/* Tabla de egresos */}
      <div className="card">
        <h2 className="text-xl font-bold text-navy mb-4">Últimos Egresos</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gold">
                <th className="text-left p-3 text-navy font-bold">Fecha</th>
                <th className="text-left p-3 text-navy font-bold">Concepto</th>
                <th className="text-left p-3 text-navy font-bold">Monto</th>
                <th className="text-left p-3 text-navy font-bold">Moneda</th>
                <th className="text-left p-3 text-navy font-bold">Tipo</th>
                <th className="text-left p-3 text-navy font-bold">Ubicación</th>
                <th className="text-left p-3 text-navy font-bold">Templo</th>
                <th className="text-left p-3 text-navy font-bold">Detalle</th>
                <th className="text-left p-3 text-navy font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {egresos.length > 0 ? (
                egresos.slice(0, 50).map((egr, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="p-3">{new Date(egr.fecha).toLocaleDateString('es-ES')}</td>
                    <td className="p-3 font-medium">{egr.concepto}</td>
                    <td className="p-3 font-bold text-red-600">{getMonedaSymbol(egr.moneda)} {egr.monto?.toLocaleString()}</td>
                    <td className="p-3">
                      <span className="font-semibold">
                        {egr.moneda === 'ARS' && '🇦🇷 ARS'}
                        {egr.moneda === 'USD' && '🇺🇸 USD'}
                        {egr.moneda === 'CLP' && '🇨🇱 CLP'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-800">
                        {tiposTransaccion.find(t => t.value === egr.tipo_transaccion)?.label || '—'}
                      </span>
                    </td>
                    <td className="p-3 text-xs">{ubicaciones.find(u => u.value === egr.ubicacion)?.label || '—'}</td>
                    <td className="p-3 text-xs">{egr.templo_id ? templos.find(t => t.id === egr.templo_id)?.nombre || '—' : '—'}</td>
                    <td className="p-3 text-gray-600">{egr.detalle || '—'}</td>
                    <td className="p-3 flex gap-2">
                      <button
                        onClick={() => handleEditEgreso(egr)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteEgreso(egr.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="p-6 text-center text-gray-500">
                    No hay egresos registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
