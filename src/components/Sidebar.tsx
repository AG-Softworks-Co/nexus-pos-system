// src/components/Sidebar.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingCart,
  PlusCircle,
  Users,
  Building2,
  Settings,
  LogOut,
  X,
  TrendingUp,
  Calculator,
  User,
  CreditCard,
  Navigation,
} from 'lucide-react';
import { useAuth, UserRole } from '../contexts/AuthContext';

interface MenuItem {
  name: string;
  icon: React.ElementType;
  path: string;
  roles: UserRole[];
  section: 'main' | 'settings';
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, logout, isAuthenticating, isAuthorized } = useAuth();

  const handleLogout = async () => {
    onClose();
    try {
      await logout();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const allMenuItems: MenuItem[] = [
    {
      name: 'Dashboard',
      icon: LayoutDashboard,
      path: '/',
      roles: ['propietario', 'administrador', 'cajero'],
      section: 'main',
    },
    {
      name: 'Nueva Venta',
      icon: PlusCircle,
      path: '/new-sale',
      roles: ['propietario', 'administrador', 'cajero'],
      section: 'main',
    },
    {
      name: 'Ventas',
      icon: ShoppingCart,
      path: '/sales',
      roles: ['propietario', 'administrador', 'cajero'],
      section: 'main',
    },
    {
      name: 'Seguimiento',
      icon: Navigation,
      path: '/delivery-tracking',
      roles: ['propietario', 'administrador', 'cajero'],
      section: 'main',
    },
    {
      name: 'Mis Créditos',
      icon: CreditCard,
      path: '/credits',
      roles: ['propietario', 'administrador', 'cajero'],
      section: 'main',
    },
    {
      name: 'Mis Clientes',
      icon: User,
      path: '/clients',
      roles: ['propietario', 'administrador', 'cajero'],
      section: 'main',
    },
    {
      name: 'Cierre de Caja',
      icon: Calculator,
      path: '/cash-closing',
      roles: ['propietario', 'administrador', 'cajero'],
      section: 'main',
    },
    {
      name: 'Utilidades',
      icon: TrendingUp,
      path: '/utilities',
      roles: ['propietario', 'administrador'],
      section: 'main',
    },
    {
      name: 'Productos',
      icon: Package,
      path: '/products',
      roles: ['propietario', 'administrador'],
      section: 'main',
    },
    {
      name: 'Categorías',
      icon: Tags,
      path: '/categories',
      roles: ['propietario', 'administrador'],
      section: 'main',
    },
    {
      name: 'Usuarios',
      icon: Users,
      path: '/users',
      roles: ['propietario', 'administrador'],
      section: 'main',
    },
    {
      name: 'Configuración',
      icon: Settings,
      path: '/configuration',
      roles: ['propietario', 'administrador'],
      section: 'settings',
    },
    {
      name: 'Mi Negocio', 
      icon: Building2,
      path: '/Negocio',
      roles: ['propietario', 'administrador'],
      section: 'settings',
    }
  ];

  const accessibleMenuItems = allMenuItems.filter((item) =>
    isAuthorized(item.roles)
  );
  const mainItems = accessibleMenuItems.filter(
    (item) => item.section === 'main'
  );
  const settingsItems = accessibleMenuItems.filter(
    (item) => item.section === 'settings'
  );

  const baseClasses =
    'bg-gradient-to-b from-slate-900 to-slate-800 text-slate-200 flex flex-col h-full shadow-xl';
  const responsiveClasses = `fixed inset-y-0 left-0 w-64 z-40 transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 md:inset-auto md:z-auto md:w-64 md:flex-shrink-0 ${
    isOpen ? 'translate-x-0' : '-translate-x-full'
  }`;
  const linkBaseClasses =
    'flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors duration-150 ease-in-out text-sm font-medium group';
  const linkInactiveClasses =
    'text-slate-300 hover:bg-slate-700 hover:text-white';
  const linkActiveClasses = 'bg-primary-600 text-white shadow-inner';
  const iconBaseClasses = 'h-5 w-5 flex-shrink-0 transition-colors';
  const iconInactiveClasses = 'text-slate-400 group-hover:text-slate-200';
  const iconActiveClasses = 'text-white';

  return (
    <aside className={`${baseClasses} ${responsiveClasses}`}>
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-700 flex-shrink-0 bg-slate-900">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-white tracking-tight">
            Nexus POS
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white md:hidden p-1 -mr-1"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        {user && (
          <div className="p-4 border-b border-slate-700 text-center flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 mx-auto mb-2 flex items-center justify-center text-white text-xl font-semibold shadow-md">
              {user.nombreCompleto?.substring(0, 2).toUpperCase() || '?'}
            </div>
            <p
              className="font-semibold text-base text-white truncate"
              title={user.nombreCompleto}
            >
              {user.nombreCompleto}
            </p>
            <p className="text-xs text-slate-400 truncate" title={user.correo}>
              {user.correo}
            </p>
            <p className="mt-2">
              <span className="text-xs bg-slate-600 text-primary-300 px-2.5 py-1 rounded-full inline-block font-medium capitalize">
                {user.rol}
              </span>
            </p>
          </div>
        )}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {mainItems.length > 0 ? (
            mainItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                end={item.path === '/'}
                className="block"
              >
                {({ isActive }) => (
                  <div
                    className={`${linkBaseClasses} ${
                      isActive ? linkActiveClasses : linkInactiveClasses
                    }`}
                  >
                    <item.icon
                      aria-hidden="true"
                      className={`${iconBaseClasses} ${
                        isActive ? iconActiveClasses : iconInactiveClasses
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>
                )}
              </NavLink>
            ))
          ) : (
            <div className="px-3 py-4 text-slate-400 text-sm">
              No hay opciones disponibles.
            </div>
          )}
        </nav>
        {settingsItems.length > 0 && user?.negocioId && (
          <div className="flex-shrink-0">
            <div className="px-3 my-2">
              <hr className="border-slate-700/50" />
            </div>
            <nav className="px-3 pb-2 space-y-1.5">
              <p className="px-3 pt-1 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Configuración
              </p>
              {settingsItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className="block"
                >
                  {({ isActive }) => (
                    <div
                      className={`${linkBaseClasses} ${
                        isActive ? linkActiveClasses : linkInactiveClasses
                      }`}
                    >
                      <item.icon
                        aria-hidden="true"
                        className={`${iconBaseClasses} ${
                          isActive ? iconActiveClasses : iconInactiveClasses
                        }`}
                      />
                      <span>{item.name}</span>
                    </div>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
        <div className="p-3 border-t border-slate-700 flex-shrink-0">
          <button
            onClick={handleLogout}
            disabled={isAuthenticating}
            className="w-full flex items-center justify-center space-x-2.5 px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-sm font-medium"
          >
            <LogOut className="h-5 w-5" />
            <span>{isAuthenticating ? 'Cerrando...' : 'Cerrar Sesión'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;