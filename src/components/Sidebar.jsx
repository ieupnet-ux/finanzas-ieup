import { LogOut, Home, TrendingDown, DollarSign, Wallet, BarChart3, Users, CheckSquare, Settings, AlertCircle } from 'lucide-react';

export default function Sidebar({ activePage, onNavigate, onLogout }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'ingresos', label: 'Ingresos', icon: TrendingDown },
    { id: 'egresos', label: 'Egresos', icon: DollarSign },
    { id: 'finanzas', label: 'Finanzas', icon: Wallet },
    { id: 'reportes', label: 'Reportes', icon: BarChart3 },
    { id: 'templos', label: 'Templos', icon: Home },
    { id: 'cajas', label: 'Cajas', icon: CheckSquare },
    { id: 'usuarios', label: 'Usuarios', icon: Users },
    { id: 'auditoria', label: 'Auditoría', icon: AlertCircle },
    { id: 'configuracion', label: 'Configuración', icon: Settings }
  ];

  return (
    <div className="w-64 bg-navy text-cream h-screen flex flex-col fixed left-0 top-0 shadow-xl">
      <div className="p-6 border-b border-gold border-opacity-20">
        <div className="flex items-center gap-3 mb-2">
          <img src="/logo-white.png" alt="IEUP" className="w-10 h-10" />
          <div>
            <h1 className="text-lg font-bold text-gold">Finanzas</h1>
            <p className="text-xs text-cream opacity-75">IEUP</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded transition-all ${
                isActive
                  ? 'bg-gold text-navy font-bold'
                  : 'text-cream hover:bg-navy-dark'
              }`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gold border-opacity-20">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded bg-red-600 hover:bg-red-700 text-white transition-all"
        >
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );
}
