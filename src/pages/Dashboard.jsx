import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import DashboardHome from './DashboardHome';
import Ingresos from './Ingresos';
import Egresos from './Egresos';
import Finanzas from './Finanzas';
import Reportes from './Reportes';
import Usuarios from './Usuarios';
import Auditoria from './Auditoria';
import Configuracion from './Configuracion';
import Eventos from './Eventos';
import { Menu } from 'lucide-react';

export default function Dashboard({ usuario, isOnline, onLogout }) {
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  // Al navegar en móvil, cerramos el drawer automáticamente
  const handleNavigate = (page) => {
    setActivePage(page);
    setSidebarAbierto(false);
  };

  const TITULOS = {
    dashboard: 'Dashboard',
    ingresos: 'Ingresos',
    egresos: 'Egresos',
    finanzas: 'Finanzas',
    reportes: 'Reportes',
    eventos: 'Eventos',
    usuarios: 'Usuarios',
    auditoria: 'Auditoría',
    configuracion: 'Configuración',
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':     return <DashboardHome usuario={usuario} />;
      case 'ingresos':      return <Ingresos usuario={usuario} />;
      case 'egresos':       return <Egresos usuario={usuario} />;
      case 'finanzas':      return <Finanzas usuario={usuario} />;
      case 'reportes':      return <Reportes usuario={usuario} />;
      case 'usuarios':      return <Usuarios usuario={usuario} />;
      case 'auditoria':     return <Auditoria usuario={usuario} />;
      case 'eventos':       return <Eventos usuario={usuario} />;
      case 'configuracion': return <Configuracion usuario={usuario} />;
      default:              return <DashboardHome usuario={usuario} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        usuario={usuario}
        activePage={activePage}
        onNavigate={handleNavigate}
        onLogout={onLogout}
        abierto={sidebarAbierto}
        onCerrar={() => setSidebarAbierto(false)}
      />

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        {/* Header móvil/tablet con botón hamburguesa (oculto en desktop) */}
        <header className="lg:hidden sticky top-0 z-20 bg-navy text-cream flex items-center gap-3 px-4 py-3 shadow-md">
          <button
            onClick={() => setSidebarAbierto(true)}
            className="p-2 hover:bg-navy-dark rounded"
            aria-label="Abrir menú"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo-white.png" alt="IEUP" className="w-7 h-7" />
            <span className="font-bold text-gold">{TITULOS[activePage] || 'Finanzas IEUP'}</span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden">
          <div className="max-w-7xl mx-auto">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}
