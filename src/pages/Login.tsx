// src/pages/Login.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Lock,
  Mail,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Loader2,
  Zap,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/* ───────────── Particle generator (memoized) ───────────── */
interface Particle {
  id: number;
  size: number;
  x: number;
  y: number;
  duration: number;
  delay: number;
  opacity: number;
}

const generateParticles = (count: number): Particle[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i,
    size: Math.random() * 4 + 1,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * -20,
    opacity: Math.random() * 0.6 + 0.1,
  }));

/* ───────────── Floating Orb ───────────── */
interface OrbProps {
  className: string;
  style?: React.CSSProperties;
}
const Orb: React.FC<OrbProps> = ({ className, style }) => (
  <div
    className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
    style={style}
  />
);

/* ═══════════════════════════════════════════════════════════
   LOGIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const { login, isAuthenticating } = useAuth();

  // Memoize particles so they don't regenerate on every render
  const particles = useMemo(() => generateParticles(80), []);

  useEffect(() => {
    // Trigger mount animation
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  /* ── Submit handler ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageError(null);
    setSuccessMessage(null);

    try {
      await login(email, password);
      setSuccessMessage('¡Inicio de sesión exitoso! Redirigiendo...');
    } catch (err: any) {
      let errorMessage = 'Error de conexión. Verifica tu conexión a internet.';

      if (err.message?.includes('Failed to fetch')) {
        errorMessage =
          'No se puede conectar al servidor. Verifica tu conexión a internet.';
      } else if (err.message?.includes('Invalid login credentials')) {
        errorMessage =
          'Credenciales incorrectas. Verifica tu email y contraseña.';
      } else if (err.message?.includes('Email not confirmed')) {
        errorMessage = 'Debes confirmar tu email antes de iniciar sesión.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setPageError(errorMessage);
    }
  };

  /* ── WhatsApp ── */
  const handleRequestAccountViaWhatsApp = () => {
    const phoneNumber = '573226650405';
    const message = encodeURIComponent(
      'Hola, quiero mi membresía para Nexus POS.'
    );
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
  };

  /* ═══════ RENDER ═══════ */
  return (
    <div className="nexus-login-root">
      {/* ── Animated background ── */}
      <div className="nexus-bg-layer">
        {/* Floating orbs */}
        <Orb
          className="nexus-orb nexus-orb-1"
          style={{ animationDelay: '0s' }}
        />
        <Orb
          className="nexus-orb nexus-orb-2"
          style={{ animationDelay: '-5s' }}
        />
        <Orb
          className="nexus-orb nexus-orb-3"
          style={{ animationDelay: '-10s' }}
        />
        <Orb
          className="nexus-orb nexus-orb-4"
          style={{ animationDelay: '-7s' }}
        />

        {/* Star particles */}
        {particles.map((p) => (
          <div
            key={p.id}
            className="nexus-particle"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              left: `${p.x}%`,
              top: `${p.y}%`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              opacity: p.opacity,
            }}
          />
        ))}

        {/* Grid overlay */}
        <div className="nexus-grid-overlay" />
      </div>

      {/* ── Main content ── */}
      <div
        className={`nexus-login-container ${mounted ? 'nexus-fade-in' : 'opacity-0'}`}
      >
        {/* ── Glow behind card ── */}
        <div className="nexus-card-glow" />

        {/* ── Header / Logo ── */}
        <header className="nexus-header">
          <div className="nexus-logo-wrapper">
            <div className="nexus-logo-ring" />
            <div className="nexus-logo-icon">
              <Zap className="h-7 w-7 sm:h-8 sm:w-8 text-white drop-shadow-lg" strokeWidth={2} />
            </div>
          </div>
          <h1 className="nexus-title">Nexus POS</h1>
          <p className="nexus-subtitle">La conexión inteligente para tu negocio</p>
        </header>

        {/* ── Card ── */}
        <main className="nexus-card">
          {/* Shimmer border */}
          <div className="nexus-card-border" />

          <div className="nexus-card-inner">
            {/* ── Error message ── */}
            {pageError && (
              <div className="nexus-alert nexus-alert-error">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-xs">Acceso Denegado</p>
                  <p className="text-xs mt-0.5 opacity-90">{pageError}</p>
                </div>
              </div>
            )}

            {/* ── Success message ── */}
            {successMessage && !pageError && (
              <div className="nexus-alert nexus-alert-success">
                <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-xs">Conectado</p>
                  <p className="text-xs mt-0.5 opacity-90">{successMessage}</p>
                </div>
              </div>
            )}

            {/* ── Form ── */}
            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* Email */}
              <div className="nexus-input-group">
                <label htmlFor="login-email" className="nexus-label">
                  Correo electrónico
                </label>
                <div className="nexus-input-wrapper">
                  <Mail className="nexus-input-icon" />
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="nexus-input"
                    placeholder="tu@email.com"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="nexus-input-group">
                <label htmlFor="login-password" className="nexus-label">
                  Contraseña
                </label>
                <div className="nexus-input-wrapper">
                  <Lock className="nexus-input-icon" />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="nexus-input nexus-input-password"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((s) => !s)}
                    className="nexus-eye-btn"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me / Forgot */}
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="nexus-checkbox"
                    name="remember-me"
                  />
                  <span className="text-gray-400 group-hover:text-gray-200 transition-colors">
                    Recordarme
                  </span>
                </label>
                <a href="#" className="nexus-link">
                  ¿Problemas para entrar?
                </a>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isAuthenticating}
                className="nexus-submit-btn"
              >
                {isAuthenticating ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5" />
                    <span>Conectando...</span>
                  </>
                ) : (
                  <>
                    <span>Acceder a Nexus</span>
                    <ArrowRight className="h-4 w-4 nexus-arrow" />
                  </>
                )}
                {/* Shimmer sweep */}
                <div className="nexus-btn-shimmer" />
              </button>
            </form>

            {/* ── Divider ── */}
            <div className="nexus-divider">
              <div className="nexus-divider-line" />
              <span className="nexus-divider-text">¿No tienes cuenta?</span>
              <div className="nexus-divider-line" />
            </div>

            {/* ── WhatsApp CTA ── */}
            <button
              type="button"
              onClick={handleRequestAccountViaWhatsApp}
              className="nexus-whatsapp-btn"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Solicitar una cuenta</span>
            </button>
          </div>
        </main>

        {/* ── Footer ── */}
        <footer className="nexus-footer">
          <p>
            © {new Date().getFullYear()} Nexus POS Systems · Interconectados
            para tu éxito
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Login;