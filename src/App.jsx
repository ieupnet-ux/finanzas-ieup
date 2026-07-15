import { useState, useEffect } from 'react';
import { supabase, offlineQueue } from './services/supabaseClient';
import Login from './pages/Login';
import CambiarPassword from './pages/CambiarPassword';
import Dashboard from './pages/Dashboard';
import { Wifi, WifiOff } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState(null);
  const [usuarioApp, setUsuarioApp] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        cargarUsuarioApp(session.user.id);
      } else {
        setUsuarioApp(null);
      }
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      subscription?.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline) offlineQueue.syncQueue();
  }, [isOnline]);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session?.user) {
        await cargarUsuarioApp(session.user.id);
      }
    } catch (error) {
      console.error('Error al leer la sesión:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarUsuarioApp = async (authId) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, email, nombre, rol, templo_id, activo, debe_cambiar_password')
        .eq('auth_id', authId)
        .single();

      if (error) throw error;

      if (!data.activo) {
        alert('Tu usuario está desactivado. Consultá con el administrador.');
        await supabase.auth.signOut();
        return;
      }

      setUsuarioApp(data);
    } catch (error) {
      console.error('Error cargando datos del usuario:', error);
      await supabase.auth.signOut();
      alert('No se encontró tu perfil en el sistema. Consultá con el administrador.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUsuarioApp(null);
  };

  const handlePasswordChanged = async () => {
    if (session?.user) await cargarUsuarioApp(session.user.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gold text-lg">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login onSuccess={checkSession} />;
  }

  if (!usuarioApp) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gold text-lg">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (usuarioApp.debe_cambiar_password) {
    return (
      <CambiarPassword
        usuario={usuarioApp}
        onSuccess={handlePasswordChanged}
        onLogout={handleLogout}
      />
    );
  }

  // El Dashboard maneja el Sidebar internamente — solo agregamos la barra online
  return (
    <div className="flex flex-col h-screen">
      <div className={`px-4 py-2 text-sm font-semibold flex items-center gap-2 ${
        isOnline ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
      }`}>
        {isOnline ? (
          <>
            <Wifi size={16} />
            En línea - Todos los cambios se sincronizan automáticamente
          </>
        ) : (
          <>
            <WifiOff size={16} />
            Sin conexión - Los cambios se guardarán localmente
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <Dashboard usuario={usuarioApp} isOnline={isOnline} onLogout={handleLogout} />
      </div>
    </div>
  );
}
