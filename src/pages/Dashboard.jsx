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

export default function Dashboard({ usuario, isOnline, onLogout }) {
  const [activePage, setActivePage] = useState('dashboard');

  const handleNavigate = (page) => setActivePage(page);

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':     return <DashboardHome usuario={usuario} />;
      case 'ingresos':      return <Ingresos usuario={usuario} />;
      case 'egresos':       return <Egresos usuario={usuario} />;
      case 'finanzas':      return <Finanzas usuario={usuario} />;
      case 'reportes':      return <Reportes usuario={usuario} />;
      case 'usuarios':      return <Usuarios usuario={usuario} />;
      case 'auditoria':     return <Auditoria usuario={usuario} />;
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
      />

      <main className="ml-64 flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}
