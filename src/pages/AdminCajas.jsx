// Componente reutilizable para administrar cajas desde Configuración.
// Se puede pegar completo en la página Configuración o usar como componente independiente.

import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Plus, Edit2, Save, X, Eye, EyeOff, Trash2 } from 'lucide-react';

const GRUPOS = [
  { value: 'cajas', label: 'Cajas', descripcion: 'Ministerios y áreas internas (efectivo)' },
  { value: 'bancos', label: 'Bancos', descripcion: 'Cuentas bancarias' },
  { value: 'billeteras', label: 'Billeteras y Otros', descripcion: 'MP, plazo fijo, billeteras virtuales' },
];

const EMOJIS_SUGERIDOS = ['💼', '📦', '🏦', '📱', '📅', '🏪', '🍽️', '📚', '🎵', '🎤', '👦', '👥', '👶', '👩', '👨', '👵', '🚴', '📻', '🍰', '📋', '❓'];

export default function AdminCajas() {
  const [cajas, setCajas] = useState([]);
  const [templos, setTemplos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState('');

  // Formulario para agregar/editar
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({
    valor: '', nombre: '', emoji: '📦', grupo: 'cajas', templo_id: '', orden: 500,
  });

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    const [cajasRes, templosRes] = await Promise.all([
      supabase.from('cajas').select('*').order('grupo').order('orden'),
      supabase.from('templos').select('*').order('nombre'),
    ]);
    setCajas(cajasRes.data || []);
    setTemplos(templosRes.data || []);
    setLoading(false);
  };

  const mostrarMensaje = (texto) => {
    setMensaje(texto);
    setTimeout(() => setMensaje(''), 4000);
  };

  // Generar automáticamente un "valor" a partir del nombre (slug)
  const generarValor = (nombre) =>
    nombre.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quitar acentos
      .replace(/[^a-z0-9\s-]/g, '')                        // solo letras, números, espacios y guiones
      .trim().replace(/\s+/g, '-');                        // espacios → guiones

  const abrirNuevo = () => {
    setEditandoId(null);
    setForm({ valor: '', nombre: '', emoji: '📦', grupo: 'cajas', templo_id: '', orden: 500 });
    setFormAbierto(true);
  };

  const abrirEditar = (caja) => {
    setEditandoId(caja.id);
    setForm({
      valor: caja.valor,
      nombre: caja.nombre,
      emoji: caja.emoji || '📦',
      grupo: caja.grupo,
      templo_id: caja.templo_id || '',
      orden: caja.orden || 500,
    });
    setFormAbierto(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) return mostrarMensaje('❌ El nombre es obligatorio');

    const datos = {
      nombre: form.nombre.trim(),
      emoji: form.emoji || '📦',
      grupo: form.grupo,
      templo_id: form.templo_id || null,
      orden: parseInt(form.orden) || 500,
      updated_at: new Date().toISOString(),
    };

    if (editandoId) {
      // Al editar NO tocamos 'valor' (romperia la vinculación con movimientos existentes)
      const { error } = await supabase.from('cajas').update(datos).eq('id', editandoId);
      if (error) return mostrarMensaje(`❌ Error: ${error.message}`);
      mostrarMensaje('✅ Caja actualizada');
    } else {
      // Al crear generamos el valor automáticamente
      let valor = generarValor(form.nombre);
      if (!valor) return mostrarMensaje('❌ El nombre no es válido');
      // Verificar duplicado
      const yaExiste = cajas.some(c => c.valor === valor);
      if (yaExiste) {
        valor = valor + '-' + Date.now().toString().slice(-4);
      }
      const { error } = await supabase.from('cajas').insert({ ...datos, valor, activo: true });
      if (error) return mostrarMensaje(`❌ Error: ${error.message}`);
      mostrarMensaje('✅ Caja creada correctamente');
    }

    setFormAbierto(false);
    setEditandoId(null);
    cargar();
  };

  const toggleActivo = async (caja) => {
    const nuevoEstado = !caja.activo;
    const accion = nuevoEstado ? 'reactivar' : 'dar de baja';
    if (!confirm(`¿Confirmás ${accion} la caja "${caja.nombre}"? Los movimientos históricos no se pierden, pero la caja ${nuevoEstado ? 'volverá a aparecer' : 'dejará de aparecer'} en los formularios y filtros.`)) return;
    const { error } = await supabase.from('cajas').update({ activo: nuevoEstado, updated_at: new Date().toISOString() }).eq('id', caja.id);
    if (error) return mostrarMensaje(`❌ Error: ${error.message}`);
    mostrarMensaje(nuevoEstado ? '✅ Caja reactivada' : '✅ Caja dada de baja');
    cargar();
  };

  const eliminar = async (caja) => {
    // Solo se permite eliminar cajas sin movimientos
    const { count } = await supabase
      .from('movimientos')
      .select('*', { count: 'exact', head: true })
      .eq('ubicacion', caja.valor);
    if (count && count > 0) {
      return mostrarMensaje(`❌ No se puede eliminar: la caja tiene ${count} movimientos asociados. Podés darla de baja para ocultarla.`);
    }
    if (!confirm(`¿Eliminar definitivamente la caja "${caja.nombre}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('cajas').delete().eq('id', caja.id);
    if (error) return mostrarMensaje(`❌ Error: ${error.message}`);
    mostrarMensaje('✅ Caja eliminada');
    cargar();
  };

  // Agrupar por grupo para mostrar
  const cajasPorGrupo = GRUPOS.map(g => ({
    ...g,
    items: cajas.filter(c => c.grupo === g.value),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Cajas y Billeteras</h2>
          <p className="text-sm text-gray-600">Administrá las cajas que aparecen en los formularios, filtros y gráficos.</p>
        </div>
        <button onClick={abrirNuevo} className="btn-primary flex items-center gap-2">
          <Plus size={20} /> Nueva Caja
        </button>
      </div>

      {mensaje && (
        <div className={`card ${mensaje.includes('✅') ? 'bg-green-50 border-l-4 border-green-500 text-green-800' : 'bg-red-50 border-l-4 border-red-500 text-red-800'}`}>
          {mensaje}
        </div>
      )}

      {/* FORMULARIO */}
      {formAbierto && (
        <form onSubmit={guardar} className="card bg-blue-50 border-l-4 border-blue-500 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-navy">{editandoId ? 'Editar Caja' : 'Nueva Caja'}</h3>
            <button type="button" onClick={() => { setFormAbierto(false); setEditandoId(null); }} className="text-gray-500 hover:text-gray-700">
              <X size={22} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-navy mb-1">Nombre *</label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Billetera Virtual Ferri"
                className="input-field w-full"
                required
              />
              {editandoId && (
                <p className="text-xs text-gray-500 mt-1">Identificador interno: <code>{form.valor}</code> (no editable — mantiene el vínculo con los movimientos existentes)</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-navy mb-1">Emoji</label>
              <input
                type="text"
                value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                maxLength={4}
                className="input-field w-full text-center text-2xl"
              />
              <div className="flex flex-wrap gap-1 mt-1">
                {EMOJIS_SUGERIDOS.map(em => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setForm({ ...form, emoji: em })}
                    className="hover:bg-gold hover:bg-opacity-30 rounded p-1 text-lg"
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-navy mb-1">Grupo *</label>
              <select
                value={form.grupo}
                onChange={(e) => setForm({ ...form, grupo: e.target.value })}
                className="input-field w-full"
                required
              >
                {GRUPOS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {GRUPOS.find(g => g.value === form.grupo)?.descripcion}
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-navy mb-1">Templo vinculado (opcional)</label>
              <select
                value={form.templo_id}
                onChange={(e) => setForm({ ...form, templo_id: e.target.value })}
                className="input-field w-full"
              >
                <option value="">Ninguno (compartida)</option>
                {templos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">Solo para billeteras o bancos específicos de un templo</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-navy mb-1">Orden</label>
              <input
                type="number"
                value={form.orden}
                onChange={(e) => setForm({ ...form, orden: e.target.value })}
                className="input-field w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Menor = aparece primero</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex items-center gap-2">
              <Save size={18} /> {editandoId ? 'Actualizar' : 'Crear caja'}
            </button>
            <button type="button" onClick={() => { setFormAbierto(false); setEditandoId(null); }} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* LISTAS POR GRUPO */}
      {loading ? (
        <div className="card text-center text-gray-500 py-8">Cargando...</div>
      ) : (
        cajasPorGrupo.map(grupo => (
          <div key={grupo.value} className="card">
            <h3 className="text-lg font-bold text-navy mb-3">
              {grupo.label} <span className="text-sm font-normal text-gray-500">({grupo.items.length})</span>
            </h3>
            {grupo.items.length === 0 ? (
              <p className="text-sm text-gray-500">No hay cajas en este grupo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gold">
                      <th className="text-left p-2 text-navy font-bold w-16">Icono</th>
                      <th className="text-left p-2 text-navy font-bold">Nombre</th>
                      <th className="text-left p-2 text-navy font-bold">Identificador</th>
                      <th className="text-left p-2 text-navy font-bold">Templo</th>
                      <th className="text-center p-2 text-navy font-bold">Orden</th>
                      <th className="text-center p-2 text-navy font-bold">Estado</th>
                      <th className="text-center p-2 text-navy font-bold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.items.map(caja => {
                      const templo = templos.find(t => t.id === caja.templo_id);
                      return (
                        <tr key={caja.id} className={`border-b hover:bg-gray-50 ${!caja.activo ? 'opacity-50' : ''}`}>
                          <td className="p-2 text-2xl">{caja.emoji || '📦'}</td>
                          <td className="p-2 font-medium">{caja.nombre}</td>
                          <td className="p-2 text-xs text-gray-500"><code>{caja.valor}</code></td>
                          <td className="p-2 text-xs">{templo?.nombre || '—'}</td>
                          <td className="p-2 text-center text-xs">{caja.orden}</td>
                          <td className="p-2 text-center">
                            {caja.activo ? (
                              <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-800">Activa</span>
                            ) : (
                              <span className="px-2 py-1 rounded text-xs font-bold bg-gray-200 text-gray-700">De baja</span>
                            )}
                          </td>
                          <td className="p-2">
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() => abrirEditar(caja)}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                                title="Editar"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => toggleActivo(caja)}
                                className={`p-2 rounded ${caja.activo ? 'text-orange-600 hover:bg-orange-100' : 'text-green-600 hover:bg-green-100'}`}
                                title={caja.activo ? 'Dar de baja' : 'Reactivar'}
                              >
                                {caja.activo ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                              <button
                                onClick={() => eliminar(caja)}
                                className="p-2 text-red-600 hover:bg-red-100 rounded"
                                title="Eliminar (solo si no tiene movimientos)"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
