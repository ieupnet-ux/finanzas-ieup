import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { UserPlus, Edit2, Eye, EyeOff, Save, X, Shield, DollarSign, Users as UsersIcon, Search } from 'lucide-react';

const ROLES = [
  {
    value: 'admin',
    label: 'Administrador',
    descripcion: 'Control total del sistema, gestiona usuarios y configuración',
    color: 'bg-gold text-navy',
    icon: Shield,
  },
  {
    value: 'tesorero',
    label: 'Tesorero',
    descripcion: 'Carga y edita ingresos, egresos y reportes en todos los templos',
    color: 'bg-green-500 text-white',
    icon: DollarSign,
  },
  {
    value: 'operador',
    label: 'Operador',
    descripcion: 'Carga y edita movimientos solo de su templo asignado',
    color: 'bg-blue-500 text-white',
    icon: UsersIcon,
  },
  {
    value: 'auditor',
    label: 'Auditor',
    descripcion: 'Acceso de solo lectura para revisar y auditar (rol externo)',
    color: 'bg-purple-500 text-white',
    icon: Search,
  },
];

const rolMeta = (value) => ROLES.find(r => r.value === value) || ROLES[2];

export default function Usuarios({ usuario: usuarioActual }) {
  const [usuarios, setUsuarios] = useState([]);
  const [templos, setTemplos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState('');

  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({
    email: '',
    nombre: '',
    rol: 'operador',
    templo_id: '',
    activo: true,
  });

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    const [usuariosRes, templosRes] = await Promise.all([
      supabase.from('usuarios').select('*').order('created_at', { ascending: false }),
      supabase.from('templos').select('*').order('nombre'),
    ]);
    setUsuarios(usuariosRes.data || []);
    setTemplos(templosRes.data || []);
    setLoading(false);
  };

  const mostrarMensaje = (texto, tipoOk = true) => {
    setMensaje({ texto, ok: tipoOk });
    setTimeout(() => setMensaje(''), 6000);
  };

  const abrirNuevo = () => {
    setEditandoId(null);
    setForm({ email: '', nombre: '', rol: 'operador', templo_id: '', activo: true });
    setFormAbierto(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
  };

  const abrirEditar = (u) => {
    setEditandoId(u.id);
    setForm({
      email: u.email,
      nombre: u.nombre || '',
      rol: u.rol,
      templo_id: u.templo_id || '',
      activo: u.activo,
    });
    setFormAbierto(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
  };

  const guardar = async (e) => {
    e.preventDefault();

    if (!form.email.trim() || !form.email.includes('@')) {
      return mostrarMensaje('❌ Email inválido', false);
    }
    if (form.rol === 'operador' && !form.templo_id) {
      return mostrarMensaje('❌ Un operador debe tener un templo asignado', false);
    }

    const datos = {
      email: form.email.trim().toLowerCase(),
      nombre: form.nombre.trim() || null,
      rol: form.rol,
      templo_id: form.templo_id || null,
      activo: form.activo,
      updated_at: new Date().toISOString(),
    };

    if (editandoId) {
      const { error } = await supabase.from('usuarios').update(datos).eq('id', editandoId);
      if (error) return mostrarMensaje(`❌ Error: ${error.message}`, false);
      mostrarMensaje('✅ Usuario actualizado', true);
    } else {
      // Al crear, marcamos que debe cambiar contraseña en primer ingreso
      const { error } = await supabase.from('usuarios').insert({
        ...datos,
        debe_cambiar_password: true,
      });
      if (error) {
        if (error.code === '23505') {
          return mostrarMensaje('❌ Ya existe un usuario con ese email', false);
        }
        return mostrarMensaje(`❌ Error: ${error.message}`, false);
      }
      mostrarMensaje(`✅ Usuario "${datos.email}" creado. Ahora crealo en Supabase Authentication (ver instrucciones abajo).`, true);
    }

    setFormAbierto(false);
    setEditandoId(null);
    cargar();
  };

  const toggleActivo = async (u) => {
    if (u.id === usuarioActual?.id) {
      return mostrarMensaje('❌ No podés desactivarte a vos mismo', false);
    }
    const nuevo = !u.activo;
    if (!confirm(`¿${nuevo ? 'Reactivar' : 'Desactivar'} el usuario "${u.email}"? ${nuevo ? 'Podrá volver a ingresar.' : 'No podrá ingresar hasta que lo reactives.'}`)) return;

    const { error } = await supabase.from('usuarios').update({ activo: nuevo, updated_at: new Date().toISOString() }).eq('id', u.id);
    if (error) return mostrarMensaje(`❌ Error: ${error.message}`, false);
    mostrarMensaje(nuevo ? '✅ Usuario reactivado' : '✅ Usuario desactivado', true);
    cargar();
  };

  const contadoresPorRol = ROLES.map(r => ({
    ...r,
    cantidad: usuarios.filter(u => u.rol === r.value && u.activo).length,
  }));

  const usuariosOrdenados = [...usuarios].sort((a, b) => {
    if (a.activo !== b.activo) return a.activo ? -1 : 1;
    return (a.nombre || a.email).localeCompare(b.nombre || b.email);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-navy">Gestionar Usuarios</h1>
          <p className="text-gray-600 text-sm">Alta, edición y baja de usuarios del sistema</p>
        </div>
        <button onClick={abrirNuevo} className="btn-primary flex items-center gap-2">
          <UserPlus size={20} /> Nuevo Usuario
        </button>
      </div>

      {mensaje && (
        <div className={`card ${mensaje.ok ? 'bg-green-50 border-l-4 border-green-500 text-green-800' : 'bg-red-50 border-l-4 border-red-500 text-red-800'}`}>
          {mensaje.texto}
        </div>
      )}

      {/* Tarjetas de roles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {contadoresPorRol.map(r => {
          const Icon = r.icon;
          return (
            <div key={r.value} className="card">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded ${r.color}`}>
                  <Icon size={20} />
                </div>
                <span className="text-3xl font-bold text-navy">{r.cantidad}</span>
              </div>
              <h3 className="font-bold text-navy">{r.label}</h3>
              <p className="text-xs text-gray-600 mt-1">{r.descripcion}</p>
            </div>
          );
        })}
      </div>

      {/* Formulario */}
      {formAbierto && (
        <form onSubmit={guardar} className="card bg-blue-50 border-l-4 border-blue-500 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-navy">{editandoId ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
            <button type="button" onClick={() => { setFormAbierto(false); setEditandoId(null); }} className="text-gray-500 hover:text-gray-700">
              <X size={22} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-navy mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="usuario@ejemplo.com"
                className="input-field w-full"
                required
                disabled={!!editandoId}
              />
              {editandoId && (
                <p className="text-xs text-gray-500 mt-1">El email no se puede cambiar después de la creación</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-navy mb-1">Nombre completo</label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ana García"
                className="input-field w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-navy mb-1">Rol *</label>
              <select
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value, templo_id: e.target.value !== 'operador' ? '' : form.templo_id })}
                className="input-field w-full"
                required
              >
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">{rolMeta(form.rol).descripcion}</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-navy mb-1">
                Templo {form.rol === 'operador' ? '*' : '(opcional)'}
              </label>
              <select
                value={form.templo_id}
                onChange={(e) => setForm({ ...form, templo_id: e.target.value })}
                className="input-field w-full"
                required={form.rol === 'operador'}
                disabled={form.rol !== 'operador'}
              >
                <option value="">
                  {form.rol === 'operador' ? 'Seleccionar templo' : 'Sin templo (acceso global)'}
                </option>
                {templos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Los operadores solo verán movimientos de su templo. Los demás roles ven todos.
              </p>
            </div>
          </div>

          {!editandoId && (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 text-yellow-900 p-3 text-sm rounded space-y-2">
              <p className="font-bold">📌 Después de guardar, hacé este paso final:</p>
              <ol className="list-decimal ml-6 space-y-1 text-xs">
                <li>Andá a <strong>Supabase Dashboard → Authentication → Users</strong></li>
                <li>Click en <strong>"Add user" → "Create new user"</strong></li>
                <li>Poné el mismo email: <code className="bg-yellow-100 px-1">{form.email || 'usuario@ejemplo.com'}</code></li>
                <li>Elegí una contraseña temporal (ej: <code className="bg-yellow-100 px-1">IEUP2026!</code>) y compartila con el usuario</li>
                <li>Marcá <strong>"Auto Confirm User"</strong> ✅</li>
                <li>Guardá. El usuario tendrá que cambiarla en su primer ingreso.</li>
              </ol>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex items-center gap-2">
              <Save size={18} /> {editandoId ? 'Actualizar' : 'Crear usuario'}
            </button>
            <button type="button" onClick={() => { setFormAbierto(false); setEditandoId(null); }} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista de usuarios */}
      <div className="card">
        <h2 className="text-xl font-bold text-navy mb-4">
          Usuarios del Sistema <span className="text-sm font-normal text-gray-500">({usuarios.length})</span>
        </h2>

        {loading ? (
          <p className="text-center text-gray-500 py-8">Cargando...</p>
        ) : usuarios.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No hay usuarios cargados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gold">
                  <th className="text-left p-3 text-navy font-bold">Usuario</th>
                  <th className="text-left p-3 text-navy font-bold">Rol</th>
                  <th className="text-left p-3 text-navy font-bold">Templo</th>
                  <th className="text-left p-3 text-navy font-bold">Estado</th>
                  <th className="text-left p-3 text-navy font-bold">Vinculado</th>
                  <th className="text-center p-3 text-navy font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosOrdenados.map(u => {
                  const meta = rolMeta(u.rol);
                  const templo = templos.find(t => t.id === u.templo_id);
                  const esYo = u.id === usuarioActual?.id;
                  const tieneAuth = !!u.auth_id;

                  return (
                    <tr key={u.id} className={`border-b hover:bg-gray-50 ${!u.activo ? 'opacity-50' : ''}`}>
                      <td className="p-3">
                        <div className="font-medium">{u.nombre || '—'}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                        {esYo && <span className="text-xs text-blue-600 font-bold">(vos)</span>}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${meta.color}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="p-3 text-xs">{templo?.nombre || (u.rol === 'operador' ? '⚠️ Sin templo' : '—')}</td>
                      <td className="p-3">
                        {u.activo ? (
                          <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-800">Activo</span>
                        ) : (
                          <span className="px-2 py-1 rounded text-xs font-bold bg-gray-200 text-gray-700">Desactivado</span>
                        )}
                      </td>
                      <td className="p-3 text-xs">
                        {tieneAuth ? (
                          <span className="text-green-700">✓ Puede ingresar</span>
                        ) : (
                          <span className="text-orange-600">⚠️ Pendiente en Supabase Auth</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => abrirEditar(u)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => toggleActivo(u)}
                            disabled={esYo}
                            className={`p-2 rounded ${esYo ? 'text-gray-300 cursor-not-allowed' : u.activo ? 'text-orange-600 hover:bg-orange-100' : 'text-green-600 hover:bg-green-100'}`}
                            title={esYo ? 'No podés cambiar tu propio estado' : u.activo ? 'Desactivar' : 'Reactivar'}
                          >
                            {u.activo ? <EyeOff size={16} /> : <Eye size={16} />}
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

      {/* Guía */}
      <div className="card bg-blue-50 border-l-4 border-blue-500">
        <h3 className="font-bold text-navy mb-2">¿Cómo funciona el alta de usuarios?</h3>
        <ol className="list-decimal ml-6 space-y-1 text-sm text-gray-700">
          <li>Creás el usuario acá desde <strong>"+ Nuevo Usuario"</strong> con email, nombre, rol y templo</li>
          <li>En la lista aparecerá como <span className="text-orange-600 font-bold">⚠️ Pendiente en Supabase Auth</span></li>
          <li>Andás a Supabase Dashboard → Authentication → Users → creás la cuenta con contraseña temporal</li>
          <li>Al vincularse por email, el indicador cambia a <span className="text-green-700 font-bold">✓ Puede ingresar</span></li>
          <li>En su primer ingreso, la app le pedirá cambiar la contraseña por una personal</li>
        </ol>
      </div>
    </div>
  );
}
