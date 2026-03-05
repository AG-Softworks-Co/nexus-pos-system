// src/components/Header.tsx
import React from 'react';
import { Bell, Menu, User, LogOut, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  onToggleSidebar: () => void; // Recibe la función para ABRIR/CERRAR sidebar
  openNotifications: () => void; // Recibe la función para ABRIR notificaciones
}

const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  openNotifications,
}) => {
  const { user, logout, isAuthenticating } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  // Efecto para cerrar menú de usuario al hacer clic fuera
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        userMenuOpen &&
        !target.closest('#user-menu-button') &&
        !target.closest('#user-menu-dropdown')
      ) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const handleLogoutClick = async () => {
    // Cierra el menú desplegable primero
    setUserMenuOpen(false);
    // Espera un instante muy breve para que la UI se actualice antes de iniciar el logout
    await new Promise((resolve) => setTimeout(resolve, 50));
    await logout();
  };

  return (
    // Header fijo en la parte superior, con sombra y z-index
    <header className="sticky top-0 bg-white border-b border-slate-200 z-20 shadow-sm">
      {/* Contenedor con padding responsivo */}
      <div className="px-4 sm:px-6 lg:px-8">
        {/* Contenedor flex principal */}
        <div className="flex items-center justify-between h-16">
          {/* Sección Izquierda: Botón Menú y Logo */}
          <div className="flex items-center">
            {/* Botón Menú (Solo móvil) */}
            <button
              type="button"
              className="text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 md:hidden mr-2 -ml-1 p-1 rounded" // Oculto en md y mayores
              onClick={onToggleSidebar} // Llama a la función del Layout
              aria-label="Abrir menú lateral"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Logo/Nombre App */}
            <div className="flex-shrink-0">
              {/* Podrías tener un logo diferente o más pequeño en móvil si quieres */}
              {/* <img className="h-8 w-auto lg:hidden" src="/logo-mobile.png" alt="Majos POS"/> */}
              {/* <img className="hidden h-8 w-auto lg:block" src="/logo-desktop.png" alt="Majos POS"/> */}
              <span className="text-lg sm:text-xl font-bold text-primary-600">
                Nexus POS
              </span>
            </div>
          </div>
          {/* Sección Derecha: Iconos y Menú Usuario */}
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            {/* Botón Notificaciones */}
            <button
              type="button"
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 relative"
              onClick={openNotifications} // Llama a la función del Layout
              aria-label="Notificaciones"
            >
              <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
              {/* Indicador (Ejemplo) */}
              <span className="absolute top-1 right-1 block h-1.5 w-1.5 rounded-full bg-red-500 ring-1 ring-white"></span>
            </button>
            {/* Separador Vertical (Opcional, solo desktop) */}
            <div
              className="hidden md:block h-6 w-px bg-slate-200"
              aria-hidden="true"
            ></div>
            {/* Menú de Usuario */}
            <div className="relative">
              {/* Botón para abrir/cerrar menú */}
              <button
                id="user-menu-button"
                className="flex items-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 rounded-full p-0.5 md:p-1 md:pr-2 md:bg-slate-50 md:hover:bg-slate-100 transition-colors"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-haspopup="true"
                aria-expanded={userMenuOpen}
              >
                {/* Avatar/Icono */}
                <span className="inline-block h-8 w-8 overflow-hidden rounded-full bg-primary-100 flex items-center justify-center">
                  {/* Aquí podrías poner una imagen de perfil si la tuvieras user.avatarUrl ? <img src={user.avatarUrl} .../> : ... */}
                  <User className="h-5 w-5 text-primary-700" />
                </span>
                {/* Nombre (Solo desktop) */}
                <span className="hidden md:block font-medium text-slate-700 text-sm">
                  {/* Mostrar solo el primer nombre para brevedad */}
                  {user?.nombreCompleto?.split(' ')[0] ?? 'Usuario'}
                </span>
                {/* Icono Dropdown (Opcional) */}
                {/* <ChevronDown className="hidden md:block h-4 w-4 text-gray-400" /> */}
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <div
                  id="user-menu-dropdown"
                  className="absolute right-0 mt-2 w-60 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50" // Ancho ajustado
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="user-menu-button"
                  tabIndex={-1}
                >
                  <div className="py-1" role="none">
                    {/* Info Usuario */}
                    <div className="px-4 py-3 border-b border-slate-100 mb-1">
                      <p
                        className="text-sm font-semibold text-slate-800 truncate"
                        title={user?.nombreCompleto}
                      >
                        {user?.nombreCompleto}
                      </p>
                      <p
                        className="text-xs text-slate-500 truncate"
                        title={user?.correo}
                      >
                        {user?.correo}
                      </p>
                      <p className="mt-2">
                        <span className="capitalize text-xs font-medium text-primary-700 bg-primary-100 px-2.5 py-1 rounded-full inline-block">
                          {user?.rol ?? 'Rol desconocido'}
                        </span>
                      </p>
                    </div>
                    {/* Otros Enlaces (Ejemplo) */}
                    {/* <a href="#" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100" role="menuitem">Configuración</a> */}
                    {/* Logout */}
                    <button
                      disabled={isAuthenticating}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50"
                      onClick={handleLogoutClick} // Usar la nueva función
                      role="menuitem"
                      tabIndex={-1}
                    >
                      <LogOut className="h-4 w-4" />
                      <span>
                        {isAuthenticating ? 'Cerrando...' : 'Cerrar sesión'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>{' '}
            {/* Fin Relative (User Menu) */}
          </div>{' '}
          {/* Fin Sección Derecha */}
        </div>{' '}
        {/* Fin Flex Principal */}
      </div>{' '}
      {/* Fin Contenedor Padding */}
    </header>
  );
};

export default Header;
