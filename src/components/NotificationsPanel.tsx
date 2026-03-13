import React from 'react';
import { X, Bell } from 'lucide-react';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface NotificationsPanelProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  notifications: NotificationItem[];
  markAllAsRead: () => void;
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ open, setOpen, notifications, markAllAsRead }) => {
  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75"
          onClick={() => setOpen(false)}
        ></div>
      )}

      {/* Notifications panel */}
      <div className={`fixed inset-y-0 right-0 z-50 w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center">
              <Bell className="h-5 w-5 text-primary-600 mr-2" />
              <h2 className="text-lg font-medium">Notificaciones</h2>
            </div>
            <button
              className="text-gray-500 hover:text-gray-700"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 transition duration-150 ease-in-out hover:bg-gray-50 ${notification.read ? '' : 'bg-blue-50'}`}
                  >
                    <div className="flex justify-between">
                      <h3 className={`text-sm font-medium ${notification.read ? 'text-gray-900' : 'text-primary-600'}`}>
                        {notification.title}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {notification.message}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Bell className="h-12 w-12 mb-2 text-gray-300" />
                <p>No tienes notificaciones</p>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-200">
            <button
              onClick={markAllAsRead}
              className="w-full py-2 px-4 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              Marcar todas como leídas
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotificationsPanel;