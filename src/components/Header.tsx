// src/components/Header.tsx
import React from 'react';
import { Bell, Menu, User, LogOut, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  onToggleSidebar: () => void;
  openNotifications: () => void;
}

const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  openNotifications,
}) => {
  const { user, logout, isAuthenticating } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

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
    setUserMenuOpen(false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await logout();
  };

  return (
    <header className="nexus-header">
      <div className="nexus-header-inner">
        {/* Left: menu + logo */}
        <div className="nexus-header-left">
          <button
            type="button"
            className="nexus-header-menu-btn"
            onClick={onToggleSidebar}
            aria-label="Abrir menú lateral"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="nexus-header-brand">
            <div className="nexus-header-logo-mark">
              <Zap className="h-4 w-4" />
            </div>
            <span className="nexus-header-logo-text">Nexus POS</span>
          </div>
        </div>

        {/* Right: notifications + user */}
        <div className="nexus-header-right">
          {/* Notifications */}
          <button
            type="button"
            className="nexus-header-icon-btn"
            onClick={openNotifications}
            aria-label="Notificaciones"
          >
            <Bell className="h-5 w-5" />
            <span className="nexus-header-notif-dot"></span>
          </button>

          {/* User menu */}
          <div className="relative">
            <button
              id="user-menu-button"
              className="nexus-header-user-btn"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-haspopup="true"
              aria-expanded={userMenuOpen}
            >
              <span className="nexus-header-avatar">
                <User className="h-4 w-4" />
              </span>
              <span className="nexus-header-username">
                {user?.nombreCompleto?.split(' ')[0] ?? 'Usuario'}
              </span>
            </button>

            {/* Dropdown */}
            {userMenuOpen && (
              <div
                id="user-menu-dropdown"
                className="nexus-header-dropdown"
                role="menu"
              >
                <div className="nexus-header-dropdown-info">
                  <p className="nexus-header-dropdown-name">{user?.nombreCompleto}</p>
                  <p className="nexus-header-dropdown-email">{user?.correo}</p>
                  <span className="nexus-header-dropdown-role">
                    {user?.rol ?? 'Rol desconocido'}
                  </span>
                </div>
                <button
                  disabled={isAuthenticating}
                  className="nexus-header-dropdown-logout"
                  onClick={handleLogoutClick}
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{isAuthenticating ? 'Cerrando...' : 'Cerrar sesión'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
