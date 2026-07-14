import { useState, useEffect } from 'react';
import { supabase, offlineQueue } from './services/supabaseClient';
import Login from './pages/Login';
import CambiarPassword from './pages/CambiarPassword';
import Dashboard from './pages/Dashboard';
import Sidebar from './components/Sidebar';
import { Wifi, WifiOff } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState(null);
  const [usuarioApp, setUsuarioApp] = useState(null); // Datos de la tabla `usuarios` (rol, nombre, etc.)
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sesión inicial
    checkSession();

    // Escuchar cambios de sesión (login, logout, refresh en otra pestaña)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        cargarUsuarioApp(session.user.id);
      } else {
        setUsuarioApp(null);
      }
    });

    // Estado de conexión
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

  // Trae los datos de la tabla `usuarios` (rol, nombre, templo, flag de cambio de contraseña)
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
      // Si no encontró el registro, el usuario existe en auth pero no en usuarios (o el trigger falló)
      // Lo mejor es cerrar sesión para que reintente
      await supabase.auth.signOut();
      alert('No se encontró tu perfil en el sistema. Consultá con el administrador.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUsuarioApp(null);
  };

  // Después de cambiar la contraseña, refrescar el flag
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

  // Sin sesión → Login
  if (!session) {
    return <Login onSuccess={checkSession} />;
  }

  // Con sesión pero sin datos de la app cargados aún
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

  // Debe cambiar contraseña en primer ingreso
  if (usuarioApp.debe_cambiar_password) {
    return <CambiarPassword usuario={usuarioApp} onSuccess={handlePasswordChanged} onLogout={handleLogout} />;
  }

  // App normal
  return (
    <div className="flex h-screen bg-marfil">
      <Sidebar usuario={usuarioApp} onLogout={handleLogout} />

      <div className="flex-1 flex flex-col overflow-hidden ml-64">
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

        <main className="flex-1 overflow-auto">
          <Dashboard usuario={usuarioApp} isOnline={isOnline} />
        </main>
      </div>
    </div>
  );
}
