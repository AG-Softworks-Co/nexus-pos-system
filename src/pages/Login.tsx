// src/pages/Login.tsx
import React, { useState } from 'react';
import {
  Lock,
  Mail,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Loader2,
  Sparkles, // Usaremos este para un toque más mágico y "nexus"
  ArrowRight, // Para el botón de login
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pageError, setPageError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // const [isSignUp, setIsSignUp] = useState(false); // Ya no cambiaremos a modo registro
  // const [nombreCompleto, setNombreCompleto] = useState(''); // Ya no es necesario

  const { login, isAuthenticating } = useAuth(); // Solo necesitamos login

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageError(null);
    setSuccessMessage(null);

    console.log('Login Page: handleSubmit triggered for login.');

    try {
      console.log('Login Page: Calling login function from AuthContext.');
      await login(email, password);
      console.log(
        'Login Page: login call completed (no error thrown by login).'
      );
      setSuccessMessage('¡Inicio de sesión exitoso! Redirigiendo...');
      // AuthProvider (onAuthStateChange) se encargará de la redirección.
    } catch (err: any) {
      console.error('🚨 Login Page: Error during login', err);

      let errorMessage = 'Error de conexión. Verifica tu conexión a internet.';

      if (err.message?.includes('Failed to fetch')) {
        errorMessage = 'No se puede conectar al servidor. Verifica tu conexión a internet y que el servidor esté disponible.';
      } else if (err.message?.includes('Invalid login credentials')) {
        errorMessage = 'Credenciales incorrectas. Verifica tu email y contraseña.';
      } else if (err.message?.includes('Email not confirmed')) {
        errorMessage = 'Debes confirmar tu email antes de iniciar sesión.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setPageError(
        errorMessage
      );
    }
  };

  // Ya no necesitamos toggleFormType porque no hay formulario de registro
  // const toggleFormType = () => {
  //   setIsSignUp(!isSignUp);
  //   setPageError(null);
  //   setSuccessMessage(null);
  // };

  const handleRequestAccountViaWhatsApp = () => {
    const phoneNumber = '573226650405'; // Tu número de WhatsApp con código de país (57 para Colombia)
    const message = encodeURIComponent('Hola, quiero mi membresía para Nexus POS.');
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-gray-100 flex items-center justify-center p-4 relative overflow-hidden selection:bg-purple-600 selection:text-white">
      {/* Efecto de fondo sutil: Gradiente animado o estrellas */}
      {/* Opción 1: Gradiente animado (requiere definir 'gradient-bg' y keyframes en CSS global o tailwind.config.js) */}
      {/* <div className="absolute inset-0 z-0 gradient-bg opacity-30"></div> */}

      {/* Opción 2: Puntos/Estrellas sutiles (Simulación con CSS, más complejo para animar bien) */}
      <div className="absolute inset-0 z-0 opacity-20">
        {/* Generar múltiples puntos pequeños con posiciones aleatorias y opacidades */}
        {/* Esto es más un concepto, la implementación real puede variar */}
        {[...Array(100)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-purple-400"
            style={{
              width: `${Math.random() * 2 + 1}px`,
              height: `${Math.random() * 2 + 1}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.5 + 0.1,
              animation: `twinkle 5s infinite alternate ${Math.random() * 5}s`, // 'twinkle' animation
            }}
          />
        ))}
      </div>


      <div className="relative z-10 w-full max-w-sm sm:max-w-md space-y-10">
        {/* Encabezado */}
        <header className="text-center space-y-3">
          <div className="inline-block p-2 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl shadow-2xl shadow-purple-500/30 animate-float">
            <Sparkles className="h-10 w-10 sm:h-12 sm:w-12 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tighter bg-gradient-to-r from-gray-100 via-gray-300 to-gray-500 text-transparent bg-clip-text">
            Nexus POS
          </h1>
          <p className="text-base sm:text-lg text-neutral-400 font-light">
            La conexión inteligente para tu negocio.
          </p>
        </header>

        {/* Formulario y Mensajes */}
        <main className="bg-neutral-900/70 backdrop-blur-lg p-6 sm:p-8 shadow-2xl shadow-black/50 rounded-2xl border border-neutral-800/70">
          {/* Ya no necesitamos el toggle de botones, solo un título */}
          {/*
            <h3 className="text-center text-xl font-semibold text-gray-200 mb-6">
              Iniciar Sesión
            </h3>
          */}

          {pageError && (
            <div className="mb-5 rounded-lg bg-red-800/30 p-3.5 ring-1 ring-red-700/50">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <AlertCircle
                    className="h-5 w-5 text-red-400"
                    aria-hidden="true"
                  />
                </div>
                <div className="ml-2.5">
                  <h3 className="text-sm font-semibold text-red-300">
                    Acceso Denegado
                  </h3>
                  <div className="mt-0.5 text-xs text-red-400">
                    <p>{pageError}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {successMessage && !pageError && (
            <div className="mb-5 rounded-lg bg-green-800/30 p-3.5 ring-1 ring-green-700/50">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <CheckCircle
                    className="h-5 w-5 text-green-400"
                    aria-hidden="true"
                  />
                </div>
                <div className="ml-2.5">
                  <h3 className="text-sm font-semibold text-green-300">Conectado</h3>
                  <div className="mt-0.5 text-xs text-green-400">
                    <p>{successMessage}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* COMENTADO: Campo Nombre Completo, ya no es parte del formulario de esta página
            {isSignUp && (
              // ... (código comentado original)
            )}
            */}

            <div>
              {/* <label htmlFor="email" className="block text-xs font-medium text-neutral-400 mb-1">Correo electrónico</label> */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors duration-300 group-focus-within:text-purple-400">
                  <Mail className="h-4 w-4 text-neutral-500 group-focus-within:text-purple-400 transition-colors duration-300" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-3 bg-neutral-800/60 border border-neutral-700/80 rounded-lg placeholder-neutral-500 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 focus:bg-neutral-800 transition-all duration-300 shadow-sm hover:border-neutral-600"
                  placeholder="tu@email.com"
                />
              </div>
            </div>

            <div>
              {/* <label htmlFor="password" className="block text-xs font-medium text-neutral-400 mb-1">Contraseña</label> */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors duration-300 group-focus-within:text-purple-400">
                  <Lock className="h-4 w-4 text-neutral-500 group-focus-within:text-purple-400 transition-colors duration-300" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-3 bg-neutral-800/60 border border-neutral-700/80 rounded-lg placeholder-neutral-500 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 focus:bg-neutral-800 transition-all duration-300 shadow-sm hover:border-neutral-600"
                  placeholder="Contraseña"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-3.5 w-3.5 text-purple-500 focus:ring-purple-600 focus:ring-offset-neutral-900 border-neutral-600 rounded bg-neutral-800 cursor-pointer"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  Recordarme
                </label>
              </div>
              <div>
                <a
                  href="#" // Deberías implementar la recuperación de contraseña si lo necesitas
                  className="font-medium text-purple-400 hover:text-purple-300 transition-colors"
                >
                  ¿Problemas para entrar?
                </a>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-100 transition-all duration-200 group"
              >
                {isAuthenticating ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-5 w-5" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <span>Acceder a Nexus</span>
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={handleRequestAccountViaWhatsApp}
              className="inline-flex items-center justify-center py-2 px-5 border border-green-600/70 rounded-lg text-xs font-medium text-green-300 bg-transparent hover:bg-green-500/10 hover:text-green-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-neutral-900 focus:ring-green-500 transition-all duration-200"
            >
              <MessageSquare className="h-4 w-4 text-green-400 mr-1.5" />
              Solicitar una cuenta
            </button>
          </div>
          {/* O si prefieres un texto con enlace: */}
          {/*
          <div className="mt-6 text-center text-sm">
            // ... (código comentado original)
          </div>
          */}

        </main>
        <footer className="text-center">
          <p className="text-xs text-neutral-600">
            © {new Date().getFullYear()} Nexus POS Systems. Interconectados para tu éxito.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Login;

// === ESTILOS ADICIONALES PARA TAILWIND.CONFIG.JS o CSS Global ===
/*
Si quieres las animaciones, añade esto a tu tailwind.config.js o a un archivo CSS global:

// En tailwind.config.js (dentro de theme.extend.animation y theme.extend.keyframes):
animation: {
  'float': 'float 6s ease-in-out infinite',
  'twinkle': 'twinkle 5s infinite alternate', // O la duración que prefieras
  // Si usas la Opción 1 de fondo:
  // 'gradient-bg-animation': 'gradient-bg-animation 15s ease infinite',
},
keyframes: {
  float: {
    '0%, 100%': { transform: 'translateY(-3%)' },
    '50%': { transform: 'translateY(3%)' },
  },
  twinkle: { // Animación sutil para las "estrellas"
    '0%': { opacity: '0.1' },
    '100%': { opacity: '0.5' }, // O el rango de opacidad que desees
  },
  // Si usas la Opción 1 de fondo (ejemplo de gradiente animado):
  // 'gradient-bg-animation': {
  //   '0%, 100%': { 'background-position': '0% 50%' },
  //   '50%': { 'background-position': '100% 50%' },
  // },
}

// Para la Opción 1 de fondo (gradiente animado) en un CSS global o <style> en el componente:
// .gradient-bg {
//   background: linear-gradient(-45deg, #23074d, #cc5333, #2c3e50, #bdc3c7); // Colores de ejemplo
//   background-size: 400% 400%;
//   animation: gradient-bg-animation 15s ease infinite;
// }
*/