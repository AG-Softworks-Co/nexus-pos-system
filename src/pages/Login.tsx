import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  Store,
  LineChart,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const { login, isAuthenticating } = useAuth();

  useEffect(() => {
    // Trigger mount animation
    const timer = setTimeout(() => setMounted(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageError(null);

    try {
      await login(email, password);
    } catch (err: unknown) {
      let errorMessage = 'Error de conexión. Verifica tu conexión a internet.';
      const error = err as { message?: string };

      if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'No se puede conectar al servidor. Verifica tu conexión a internet.';
      } else if (error.message?.includes('Invalid login credentials')) {
        errorMessage = 'Credenciales incorrectas. Verifica tu email y contraseña.';
      } else if (error.message?.includes('Email not confirmed')) {
        errorMessage = 'Debes confirmar tu email antes de iniciar sesión.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setPageError(errorMessage);
    }
  };

  const handleRequestAccountViaWhatsApp = (e: React.MouseEvent) => {
    e.preventDefault();
    const phoneNumber = '573226650405';
    const message = encodeURIComponent(
      'Hola equipo de Vendrix POS, me gustaría solicitar una demostración o membresía para mi negocio.'
    );
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
  };

  return (
    <div className={`min-h-screen w-full flex bg-white lg:bg-gray-50 transition-opacity duration-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`}>

      {/* ── SECCIÓN IZQUIERDA: Formulario ── */}
      <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col items-center justify-center p-6 sm:p-12 relative z-10 bg-white lg:shadow-[20px_0_40px_rgba(0,0,0,0.1)]">
        <div className="w-full max-w-sm sm:max-w-md flex flex-col h-full justify-center lg:justify-between py-10 lg:py-0">

          {/* Logo y Título */}
          <div className="flex items-center justify-center lg:justify-start space-x-3 mb-12 sm:mb-16">
            <div className="bg-white/10 p-1 rounded-xl shadow-[0_8px_16px_rgba(79,70,229,0.3)] h-12 w-12 flex items-center justify-center">
              <img src="/LOGO%20ICONO%20V.png" alt="Vendrix Icon" className="w-full h-full object-cover rounded-lg" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Vendrix POS</h1>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {/* Títulos Formulario */}
            <div className="mb-8 lg:mb-10 text-center lg:text-left">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
                Bienvenido de nuevo
              </h2>
              <p className="text-gray-500 font-medium text-sm sm:text-base px-4 lg:px-0">
                Ingresa tus credenciales para acceder a tu panel de control.
              </p>
            </div>

            {/* Alerta de Error */}
            {pageError && (
              <div className="mb-6 bg-red-50/80 border-l-4 border-red-500 p-4 rounded-r-xl flex items-start animate-fade-in-up shadow-sm">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="ml-3">
                  <h3 className="text-sm font-bold text-red-900">No autorizado</h3>
                  <p className="text-sm text-red-700 mt-1 font-medium">{pageError}</p>
                </div>
              </div>
            )}

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              <div className="space-y-5">
                {/* Campo Email */}
                <div className="group">
                  <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2">
                    Correo Electrónico Corporativo
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-primary-600 transition-colors" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      required
                      className="block w-full pl-12 pr-4 py-3.5 sm:py-4 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 hover:border-gray-300 transition-all font-medium sm:text-sm shadow-sm"
                      placeholder="usuario@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                {/* Campo Contraseña */}
                <div className="group">
                  <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-primary-600 transition-colors" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      className="block w-full pl-12 pr-12 py-3.5 sm:py-4 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 hover:border-gray-300 transition-all font-medium sm:text-sm shadow-sm"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-4 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors focus:outline-none"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-gray-600 cursor-pointer hover:text-gray-900 transition-colors">
                    Recordarme
                  </label>
                </div>

                <div className="text-sm">
                  <a href="#" className="font-bold text-primary-600 hover:text-primary-700 transition-colors">
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
              </div>

              <button
                type="submit"
                disabled={isAuthenticating}
                className="group relative w-full flex justify-center mt-2 py-4 sm:py-4 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-gray-900 hover:bg-gray-800 shadow-[0_4px_14px_0_rgba(0,0,0,0.25)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none overflow-hidden"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[100%] group-hover:animate-[shimmer_2s_infinite]"></div>
                {isAuthenticating ? (
                  <span className="flex items-center">
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 drop-shadow-md" />
                    Verificando credenciales...
                  </span>
                ) : (
                  <span className="flex items-center drop-shadow-md">
                    Ingresar al Sistema
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </button>
            </form>
          </div>

          {/* Footer Formulario */}
          <div className="mt-16 lg:mt-12 pt-8 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500 flex flex-col sm:flex-row items-center justify-center gap-2">
              <span>¿Tu empresa no tiene acceso?</span>
              <a
                href="#"
                onClick={handleRequestAccountViaWhatsApp}
                className="font-bold text-primary-700 bg-primary-50 px-3 py-1.5 rounded-lg hover:bg-primary-100 transition-colors flex items-center"
              >
                Solicitar una cuenta <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN DERECHA: Imagen/Branding Promocional (Oculto en móvil) ── */}
      <div className="hidden lg:flex w-[55%] xl:w-[60%] flex-col relative overflow-hidden bg-primary-950">

        {/* Background Image & Overlay */}
        <div className="absolute inset-0 z-0 bg-primary-950">
          <img
            src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=2000&auto=format&fit=crop"
            alt="Vendrix POS Modern Business"
            className="w-full h-full object-cover opacity-25 mix-blend-luminosity filter contrast-125"
          />
          {/* Gradient Overlays for perfect text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-primary-950 via-primary-900/40 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-primary-950/90 via-primary-900/60 to-transparent"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(167,139,250,0.1),transparent_50%)]"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 p-16 xl:p-24 flex flex-col h-full justify-between">

          {/* Branding */}
          <div className="flex items-center space-x-4 animate-fade-in-down">
            <div className="bg-white/10 backdrop-blur-md p-1 rounded-2xl border border-white/10 shadow-2xl overflow-hidden h-14 w-14 flex items-center justify-center">
              <img src="/LOGO%20ICONO%20V.png" alt="Vendrix Icon" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-lg">Vendrix POS</h1>
              <p className="text-primary-300 font-bold tracking-[0.2em] text-[10px] uppercase mt-0.5">Enterprise Edition</p>
            </div>
          </div>

          {/* Main Hero Text */}
          <div className="max-w-xl animate-fade-in-up delay-100 flex-1 flex flex-col justify-center">
            <div className="inline-flex items-center px-4 py-2 border border-primary-500/30 rounded-full bg-primary-900/50 backdrop-blur-md mb-8 shadow-inner shadow-primary-500/20">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 mr-2.5 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
              <span className="text-[11px] font-bold text-primary-100 uppercase tracking-widest">Sistema Operativo</span>
            </div>
            <h2 className="text-5xl xl:text-6xl font-black text-white leading-[1.1] mb-6 drop-shadow-2xl">
              Escala tu negocio <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-primary-300 to-purple-300 filter drop-shadow-lg">
                sin límites
              </span>
            </h2>
            <p className="text-lg xl:text-xl text-gray-300 font-medium leading-relaxed mb-12 max-w-[90%] drop-shadow-md">
              La plataforma integral más avanzada para potenciar las operaciones de tu restaurante o comercio minorista.
            </p>

            {/* Features Row */}
            <div className="grid grid-cols-2 gap-8">
              <div className="flex items-start bg-black/20 backdrop-blur-sm p-4 rounded-2xl border border-white/5">
                <div className="bg-cyan-500/20 p-2 rounded-lg mr-4 flex-shrink-0">
                  <Store className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-white font-bold mb-1.5 text-base">Puntos de Venta</h4>
                  <p className="text-sm text-gray-400 font-medium leading-snug">Sincronización en tiempo real multi-sucursal</p>
                </div>
              </div>
              <div className="flex items-start bg-black/20 backdrop-blur-sm p-4 rounded-2xl border border-white/5">
                <div className="bg-purple-500/20 p-2 rounded-lg mr-4 flex-shrink-0">
                  <LineChart className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-white font-bold mb-1.5 text-base">Análisis de Datos</h4>
                  <p className="text-sm text-gray-400 font-medium leading-snug">Métricas accionables para toma de decisiones</p>
                </div>
              </div>
            </div>
          </div>

          {/* Security Badge / Footer */}
          <div className="flex items-center bg-black/30 backdrop-blur-md w-fit px-5 py-3 rounded-xl border border-white/10 text-gray-300 text-sm font-medium animate-fade-in-up delay-200">
            <ShieldCheck className="w-5 h-5 mr-3 text-emerald-400" />
            Protegido con encriptación militar y auditoría exhaustiva de seguridad.
          </div>
        </div>

      </div>

    </div>
  );
};

export default Login;