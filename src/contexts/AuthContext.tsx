// src/contexts/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // Añadido useLocation
import { supabase } from '../lib/supabase';

export type UserRole = 'propietario' | 'administrador' | 'cajero';

export type User = {
  id: string;
  nombreCompleto: string;
  correo: string;
  rol: UserRole;
  negocioId: string | null;
};

export type AuthContextType = {
  user: User | null;
  loading: boolean; // Carga inicial de sesión/perfil
  isAuthenticating: boolean; // Carga para login/signup
  login: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    nombreCompleto: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  isAuthorized: (roles: UserRole[]) => boolean;
  refreshUser: () => Promise<User | null>; // Modificado para devolver User | null
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // ESTO ES PARA EL LOADER GLOBAL INICIAL
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchUserProfile = useCallback(
    async (
      authUserId: string,
      authUserEmail?: string
    ): Promise<User | null> => {
      console.log('AuthProvider: Fetching user profile for ID:', authUserId);
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('usuarios')
          .select('id, nombre_completo, correo, rol, negocio_id')
          .eq('id', authUserId)
          .single();

        if (profileError) {
          if (profileError.code === 'PGRST116') {
            console.warn(
              `AuthProvider: Perfil no encontrado para ${authUserId}. Asumiendo nuevo usuario.`
            );
            return {
              id: authUserId,
              correo: authUserEmail || 'No disponible',
              nombreCompleto: 'Usuario (Perfil Pendiente)',
              rol: 'propietario',
              negocioId: null, // Clave: negocioId es null
            };
          }
          console.error('AuthProvider: Error fetching profile:', profileError);
          throw profileError;
        }

        if (profileData) {
          console.log('AuthProvider: Perfil encontrado:', profileData);
          return {
            id: profileData.id,
            nombreCompleto: profileData.nombre_completo,
            correo: profileData.correo,
            rol: profileData.rol as UserRole,
            negocioId: profileData.negocio_id,
          };
        }
        console.warn(
          'AuthProvider: No profile data and no error, returning null.'
        );
        return null;
      } catch (error) {
        console.error(
          'AuthProvider: Catch error fetching user profile:',
          error
        );
        return null;
      }
    },
    [] // No hay dependencias que cambien
  );

  const handleUserSession = useCallback(
    async (sessionUser: any | null, fromInitialLoad: boolean) => {
      if (sessionUser) {
        console.log('AuthProvider: Session user found:', sessionUser.id);
        const userProfile = await fetchUserProfile(
          sessionUser.id,
          sessionUser.email
        );
        setUser(userProfile);

        if (userProfile) {
          if (!userProfile.negocioId) {
            console.log(
              'AuthProvider: User has NO negocioId. Current path:',
              location.pathname
            );
            if (location.pathname !== '/business-setup') {
              console.log('AuthProvider: Navigating to /business-setup');
              navigate('/business-setup', { replace: true });
            }
          } else {
            console.log(
              'AuthProvider: User HAS negocioId. Current path:',
              location.pathname
            );
            if (
              location.pathname === '/login' ||
              location.pathname === '/business-setup'
            ) {
              console.log('AuthProvider: Navigating to /');
              navigate('/', { replace: true });
            }
          }
        } else {
          console.warn(
            'AuthProvider: User session exists, but profile is null. User might need to logout/login or profile creation failed.'
          );
        }
      } else {
        console.log('AuthProvider: No session user.');
        setUser(null);
        if (
          location.pathname !== '/login' &&
          !location.pathname.startsWith('/public')
        ) {
          // Ejemplo de ruta pública
          console.log(
            'AuthProvider: No session, navigating to /login. Current path:',
            location.pathname
          );
          navigate('/login', { replace: true });
        }
      }
      // Solo setea loading a false DESPUÉS de que la lógica de redirección (si es necesaria) se haya disparado
      // o si no hay sesión. Esto es para la carga inicial de la app.
      if (fromInitialLoad) {
        setLoading(false);
      }
    },
    [fetchUserProfile, navigate, location.pathname]
  );

  useEffect(() => {
    console.log('AuthProvider: useEffect for session/auth change mounted.');
    // setLoading(true); // Ya está true por defecto, no es necesario aquí de nuevo
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.log('AuthProvider: Initial getSession result:', session);
      await handleUserSession(session?.user || null, true); // fromInitialLoad = true
    };
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(
        'AuthProvider: onAuthStateChange event:',
        event,
        'session:',
        session
      );
      handleUserSession(session?.user || null, false); // fromInitialLoad = false
    });

    return () => {
      console.log('AuthProvider: Unsubscribing from onAuthStateChange.');
      subscription.unsubscribe();
    };
  }, [handleUserSession]); // Dependencia de `handleUserSession`

  const login = async (email: string, password: string) => {
    setIsAuthenticating(true);
    console.log('AuthProvider: Attempting login...');
    try {
      console.log('🔐 Login attempt for:', email);
      console.log('🌐 Supabase URL:', import.meta.env.VITE_SUPABASE_URL);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('🔐 Login response:', { data: !!data, error: error?.message });

      if (error) {
        console.error('🚨 AuthProvider: Login error:', error);
        console.error('🚨 Error details:', {
          message: error.message,
          status: error.status,
          statusText: error.statusText
        });
        throw error;
      }
      console.log(
        'AuthProvider: Login successful (Supabase auth). User:',
        data.user?.id
      );
      // onAuthStateChange (y por ende handleUserSession) se encargará del resto
    } catch (err: any) {
      console.error('🚨 AuthProvider: Catch block error:', err);
      console.error('🚨 Error type:', typeof err);
      console.error('🚨 Error constructor:', err.constructor.name);
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    nombreCompleto: string
  ) => {
    setIsAuthenticating(true);
    console.log('AuthProvider: Attempting signup...');
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nombre_completo: nombreCompleto } },
      });
      if (error) {
        console.error('AuthProvider: SignUp error:', error);
        throw error;
      }
      console.log(
        'AuthProvider: SignUp successful (Supabase auth). User:',
        data.user?.id
      );
      // onAuthStateChange se encargará
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logout = async () => {
    console.log('AuthProvider: Attempting logout...');
    await supabase.auth.signOut();
    // onAuthStateChange se encargará de limpiar el estado y redirigir.
  };

  const refreshUser = useCallback(async (): Promise<User | null> => {
    console.log('AuthProvider: refreshUser called.');
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      const userProfile = await fetchUserProfile(
        session.user.id,
        session.user.email
      );
      setUser(userProfile);
      return userProfile;
    }
    setUser(null);
    return null;
  }, [fetchUserProfile]);

  const isAuthorized = (roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.rol);
  };

  if (loading) {
    // ESTE ES EL LOADER GLOBAL MIENTRAS SE RESUELVE LA SESIÓN INICIAL
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <svg
          className="animate-spin h-10 w-10 text-primary-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p className="mt-4 text-gray-700">Cargando sesión...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: loading, // Este loading es el global
        isAuthenticating, // Este es para acciones de login/signup
        login,
        signUp,
        logout,
        isAuthorized,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
