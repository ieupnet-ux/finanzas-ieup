import { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Lock, ShieldCheck, LogOut } from 'lucide-react';

export default function CambiarPassword({ usuario, onSuccess, onLogout }) {
  const [password1, setPassword1] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password1.length < 8) {
      return setError('La contraseña debe tener al menos 8 caracteres');
    }
    if (password1 !== password2) {
      return setError('Las contraseñas no coinciden');
    }

    setLoading(true);
    try {
      // 1. Actualizar la contraseña en auth.users
      const { error: updateError } = await supabase.auth.updateUser({ password: password1 });
      if (updateError) throw updateError;

      // 2. Marcar el flag como false en la tabla usuarios
      const { error: flagError } = await supabase
        .from('usuarios')
        .update({ debe_cambiar_password: false, updated_at: new Date().toISOString() })
        .eq('id', usuario.id);
      if (flagError) throw flagError;

      // 3. Refrescar y entrar a la app
      if (onSuccess) await onSuccess();
    } catch (err) {
      setError(err.message || 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-navy-dark to-navy-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <ShieldCheck className="w-16 h-16 mx-auto text-gold mb-4" />
          <h1 className="text-3xl font-bold text-gold mb-2">Cambio de contraseña</h1>
          <p className="text-cream text-sm">
            Bienvenido/a{usuario?.nombre ? `, ${usuario.nombre}` : ''}. Por seguridad, elegí una nueva contraseña personal antes de continuar.
          </p>
        </div>

        <div className="card bg-white">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg text-sm bg-red-100 text-red-800">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">
                <Lock className="inline mr-2" size={18} />
                Nueva contraseña
              </label>
              <input
                type="password"
                value={password1}
                onChange={(e) => setPassword1(e.target.value)}
                className="input-field"
                placeholder="Mínimo 8 caracteres"
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">
                <Lock className="inline mr-2" size={18} />
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="input-field"
                placeholder="Repetí la contraseña"
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-800 p-3 text-xs rounded">
              💡 <strong>Sugerencia:</strong> usá al menos 8 caracteres, combinando letras, números y algún símbolo. No compartas tu contraseña con nadie.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar y continuar'}
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-navy mt-2"
            >
              <LogOut size={14} /> Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
