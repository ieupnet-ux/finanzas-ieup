import { LogOut, Home, TrendingDown, DollarSign, Wallet, BarChart3, Users, AlertCircle, Settings, UserCircle, X } from 'lucide-react';

// Definición de permisos por rol para el menú
const PERMISOS_MENU = {
  admin:    ['dashboard', 'ingresos', 'egresos', 'finanzas', 'reportes', 'usuarios', 'auditoria', 'configuracion'],
  tesorero: ['dashboard', 'ingresos', 'egresos', 'finanzas', 'reportes'],
  auditor:  ['dashboard', 'finanzas', 'reportes', 'auditoria'],
  operador: ['dashboard', 'ingresos', 'egresos', 'reportes'],
};

const ROLES_LABEL = {
  admin: 'Administrador',
  tesorero: 'Tesorero',
  auditor: 'Auditor',
  operador: 'Operador',
};

const ROLES_COLOR = {
  admin: 'bg-gold text-navy',
  tesorero: 'bg-green-500 text-white',
  auditor: 'bg-purple-500 text-white',
  operador: 'bg-blue-500 text-white',
};

export default function Sidebar({ usuario, activePage, onNavigate, onLogout, abierto = false, onCerrar }) {
  const rol = usuario?.rol || 'operador';
  const menuPermitido = PERMISOS_MENU[rol] || PERMISOS_MENU.operador;

  const menuItemsAll = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'ingresos', label: 'Ingresos', icon: TrendingDown },
    { id: 'egresos', label: 'Egresos', icon: DollarSign },
    { id: 'finanzas', label: 'Finanzas', icon: Wallet },
    { id: 'reportes', label: 'Reportes', icon: BarChart3 },
    { id: 'usuarios', label: 'Usuarios', icon: Users },
    { id: 'auditoria', label: 'Auditoría', icon: AlertCircle },
    { id: 'configuracion', label: 'Configuración', icon: Settings },
  ];

  const menuItems = menuItemsAll.filter(item => menuPermitido.includes(item.id));

  return (
    <>
      {/* Overlay oscuro cuando el menú está abierto en móvil/tablet */}
      {abierto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={onCerrar}
        />
      )}

      {/* Sidebar: drawer deslizante en móvil/tablet, fijo visible en desktop (lg+) */}
      <div
        className={`w-64 bg-navy text-cream h-full flex flex-col fixed left-0 top-0 bottom-0 shadow-xl z-40
          transform transition-transform duration-300 ease-in-out
          ${abierto ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0`}
      >
        <div className="p-6 border-b border-gold border-opacity-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo-white.png" alt="IEUP" className="w-10 h-10" />
              <div>
                <h1 className="text-lg font-bold text-gold">Finanzas</h1>
                <p className="text-xs text-cream opacity-75">IEUP</p>
              </div>
            </div>
            {/* Botón cerrar solo visible en móvil/tablet */}
            <button
              onClick={onCerrar}
              className="lg:hidden p-2 text-cream hover:bg-navy-dark rounded"
              aria-label="Cerrar menú"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Datos del usuario logueado */}
        <div className="px-4 py-3 border-b border-gold border-opacity-20">
          <div className="flex items-center gap-2 mb-1">
            <UserCircle size={20} className="text-gold" />
            <p className="text-sm font-bold truncate">{usuario?.nombre || usuario?.email}</p>
          </div>
          {usuario?.nombre && (
            <p className="text-xs text-cream opacity-70 truncate ml-7">{usuario.email}</p>
          )}
          <span className={`inline-block mt-2 px-2 py-1 text-xs font-bold rounded ${ROLES_COLOR[rol] || 'bg-gray-500'}`}>
            {ROLES_LABEL[rol] || rol}
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate && onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded transition-all ${
                  isActive ? 'bg-gold text-navy font-bold' : 'text-cream hover:bg-navy-dark'
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
    </>
  );
}
