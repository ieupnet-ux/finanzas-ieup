import { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Mail, Lock } from 'lucide-react';

export default function Login({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        // Mensaje más amigable
        if (signInError.message.includes('Invalid login credentials')) {
          throw new Error('Email o contraseña incorrectos');
        }
        throw signInError;
      }

      if (onSuccess) await onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-navy-dark to-navy-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mb-4">
            <img src="/logo-gold.png" alt="IEUP" className="w-24 h-24 mx-auto" />
          </div>
          <h1 className="text-4xl font-bold text-gold mb-2">Finanzas IEUP</h1>
          <p className="text-cream text-sm">Iglesia Evangélica Unión Pentecostal</p>
        </div>

        <div className="card bg-white">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg text-sm bg-red-100 text-red-800">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">
                <Mail className="inline mr-2" size={18} />
                Correo Electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="tu@correo.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">
                <Lock className="inline mr-2" size={18} />
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-4">
            ¿Olvidaste tu contraseña? Consultá con el administrador.
          </p>
        </div>

        <p className="text-center text-cream text-xs mt-6">
          Sistema restringido — solo usuarios autorizados
        </p>
      </div>
    </div>
  );
}
