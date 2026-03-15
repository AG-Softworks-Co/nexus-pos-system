import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Edit, Trash2, AlertCircle, CheckCircle, Shield, Key, Mail, User as UserIcon, X, Lock, Save, Briefcase, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type User = {
  id: string;
  nombre_completo: string;
  correo: string;
  rol: 'propietario' | 'administrador' | 'cajero';
  creado_en: string;
  ultimo_acceso?: string;
};

type UserFormData = {
  nombre_completo: string;
  correo: string;
  rol: 'propietario' | 'administrador' | 'cajero';
  password?: string;
};

const Users: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [formData, setFormData] = useState<UserFormData>({
    nombre_completo: '',
    correo: '',
    rol: 'cajero',
    password: ''
  });

  useEffect(() => {
    if (user?.negocioId) {
      fetchUsers();
    }
  }, [user]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('negocio_id', user?.negocioId)
        .order('creado_en', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err: unknown) {
      console.error('Error fetching users:', err);
      setError('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (u: User) => {
    setEditingUser(u);
    setFormData({
      nombre_completo: u.nombre_completo,
      correo: u.correo,
      rol: u.rol,
      password: ''
    });
    setIsChangingPassword(false);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setEditingUser(null);
    setFormData({
      nombre_completo: '',
      correo: '',
      rol: 'cajero',
      password: ''
    });
    setIsChangingPassword(false);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (editingUser) {
        // Update existing user profile in public.usuarios
        const { error: updateError } = await supabase
          .from('usuarios')
          .update({
            nombre_completo: formData.nombre_completo,
            rol: formData.rol
          })
          .eq('id', editingUser.id);

        if (updateError) throw updateError;

        // Update password if changing using RPC function
        if (isChangingPassword && formData.password) {
          const { error: rpcError } = await supabase.rpc('update_user_credentials', {
            p_user_id: editingUser.id,
            p_new_password: formData.password
          });

          if (rpcError) {
            console.error("RPC Error:", rpcError);
            throw new Error("Perfil actualizado, pero la contraseña no se pudo cambiar. Requiere crear la función SQL de actualización en Supabase.");
          }
        }

        setSuccessMessage('Usuario actualizado exitosamente');
      } else {
        // Create new user with auth
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: formData.correo,
          password: formData.password!,
          options: {
            data: {
              nombre_completo: formData.nombre_completo
            }
          }
        });

        if (signUpError) {
          if (signUpError.message.includes('rate limit')) {
            throw new Error("Límite de correos en Supabase excedido. Por seguridad, deshabilita 'Confirm Email' en la configuración de Auth de Supabase.");
          }
          throw signUpError;
        }

        // Create user profile
        if (authData.user) {
          const { error: profileError } = await supabase
            .from('usuarios')
            .update({
              rol: formData.rol,
              negocio_id: user?.negocioId
            })
            .eq('id', authData.user.id);

          if (profileError) throw profileError;
        }
        setSuccessMessage('Usuario creado exitosamente');
      }

      await fetchUsers();
      setShowModal(false);
    } catch (err: unknown) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : "Ha ocurrido un error inesperado al procesar la solicitud.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) {
        if (error.message.includes('admin API')) {
          throw new Error("No es posible eliminar el usuario directamente desde esta interfaz por restricciones de seguridad. Por favor hazlo desde el panel de Supabase.");
        }
        throw error;
      }

      await fetchUsers();
      setDeleteConfirmId(null);
      setSuccessMessage('Usuario eliminado exitosamente');
    } catch (err: unknown) {
      console.error('Error deleting user:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar usuario');
      // Limpiar el estado de confirmación si falla para evitar trabar al usuario
      setDeleteConfirmId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = !searchQuery ||
      u.nombre_completo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.correo.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' || u.rol === roleFilter;

    return matchesSearch && matchesRole;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'propietario':
        return <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100/80 text-purple-800 border border-purple-200/60 shadow-sm backdrop-blur-sm"><Shield className="w-3 h-3 mr-1.5 self-center" /> Propietario</span>;
      case 'administrador':
        return <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100/80 text-blue-800 border border-blue-200/60 shadow-sm backdrop-blur-sm"><Key className="w-3 h-3 mr-1.5 self-center" /> Administrador</span>;
      default:
        return <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-200/60 shadow-sm backdrop-blur-sm"><UserIcon className="w-3 h-3 mr-1.5 self-center" /> Cajero</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
        <p className="text-gray-500 font-medium">Cargando organización...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center">
            <Building2 className="w-7 h-7 mr-3 text-primary-600" />
            Gestión de Usuarios
          </h1>
          <p className="text-sm text-gray-500 mt-1 ml-10">
            Administra los roles, accesos y credenciales de tu equipo
          </p>
        </div>

        <button
          className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white text-sm font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transform hover:-translate-y-0.5 active:translate-y-0"
          onClick={handleAddNew}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Añadir Miembro
        </button>
      </div>

      {/* Alertas Globales */}
      {(error || successMessage) && (
        <div className={`rounded-xl p-4 border animate-fade-in-up ${error ? 'bg-red-50/80 border-red-200 text-red-800' : 'bg-emerald-50/80 border-emerald-200 text-emerald-800'} backdrop-blur-sm shadow-sm`}>
          <div className="flex items-start">
            {error ? <AlertCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" /> : <CheckCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />}
            <div>
              <h3 className="text-sm font-semibold">{error ? 'Oops, hubo un problema' : '¡Acción Exitosa!'}</h3>
              <p className="mt-1 text-sm opacity-90">{error || successMessage}</p>
            </div>
            <button
              className="ml-auto flex-shrink-0 hover:opacity-70 transition-opacity"
              onClick={() => { setError(null); setSuccessMessage(null); }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="pl-11 block w-full shadow-sm sm:text-sm border-gray-200 rounded-xl focus:ring-primary-500 focus:border-primary-500 py-3 bg-white hover:border-gray-300 transition-colors"
            placeholder="Buscar por nombre o correo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="w-full sm:w-64 relative">
          <select
            className="block w-full py-3 pl-4 pr-10 border-gray-200 bg-white text-gray-700 sm:text-sm rounded-xl focus:ring-primary-500 focus:border-primary-500 shadow-sm appearance-none hover:border-gray-300 transition-colors"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">Todos los roles</option>
            <option value="propietario">Propietario</option>
            <option value="administrador">Administrador</option>
            <option value="cajero">Cajero</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
            <Briefcase className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Cards Grid para diseño responsivo y moderno */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((u) => (
          <div
            key={u.id}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group relative"
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="h-14 w-14 bg-gradient-to-br from-primary-100 to-primary-50 rounded-2xl flex items-center justify-center border border-primary-200/50 shadow-inner">
                      <span className="text-primary-700 font-bold text-lg tracking-wide">
                        {u.nombre_completo.split(' ').map(name => name[0]).join('').substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    {u.rol === 'propietario' && (
                      <div className="absolute -bottom-1 -right-1 bg-yellow-400 p-1 rounded-full border-2 border-white shadow-sm">
                        <Shield className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 leading-tight group-hover:text-primary-600 transition-colors">
                      {u.nombre_completo}
                    </h3>
                    <div className="flex items-center mt-1 text-sm text-gray-500">
                      <Mail className="w-3.5 h-3.5 mr-1" />
                      <span className="truncate max-w-[150px]">{u.correo}</span>
                    </div>
                  </div>
                </div>

                {/* Menu de acciones */}
                <div className="relative">
                  {deleteConfirmId === u.id ? (
                    <div className="absolute right-0 top-0 bg-white shadow-lg border border-red-100 rounded-xl p-3 z-10 w-48 animate-fade-in shadow-red-100/50">
                      <p className="text-xs font-medium text-gray-800 mb-2 text-center">¿Eliminar acceso?</p>
                      <div className="flex space-x-2">
                        <button
                          className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1.5 rounded-lg text-xs font-bold transition-colors border border-red-200"
                          onClick={() => handleDelete(u.id)}
                        >
                          Sí
                        </button>
                        <button
                          className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-600 px-2 py-1.5 rounded-lg text-xs font-bold transition-colors border border-gray-200"
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-50 p-1 rounded-xl border border-gray-100">
                      <button
                        className={`p-2 rounded-lg transition-colors ${u.rol === 'propietario' ? 'text-gray-300 cursor-not-allowed' : 'text-primary-600 hover:bg-primary-50'}`}
                        onClick={() => handleEditClick(u)}
                        disabled={u.rol === 'propietario'}
                        title={u.rol === 'propietario' ? "No puedes editar al propietario" : "Editar usuario"}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        className={`p-2 rounded-lg transition-colors ${u.rol === 'propietario' ? 'text-gray-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50'}`}
                        onClick={() => setDeleteConfirmId(u.id)}
                        disabled={u.rol === 'propietario'}
                        title={u.rol === 'propietario' ? "No puedes eliminar al propietario" : "Eliminar usuario"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-gray-50 pt-4">
                <div>{getRoleBadge(u.rol)}</div>
                <div className="text-xs text-gray-400 font-medium">
                  Registrado: {formatDate(u.creado_en)}
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredUsers.length === 0 && (
          <div className="col-span-full bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No hay usuarios</h3>
            <p className="mt-1 text-sm text-gray-500">
              No se encontraron usuarios que coincidan con tu búsqueda.
            </p>
          </div>
        )}
      </div>

      {/* Sliding Over/Modal elegante para Edición/Creación */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center">
          <div
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => !isSubmitting && setShowModal(false)}
          />

          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 z-10 overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                {editingUser ? <Edit className="w-5 h-5 mr-2 text-primary-600" /> : <UserPlus className="w-5 h-5 mr-2 text-primary-600" />}
                {editingUser ? 'Detalles de la Cuenta' : 'Nuevo Miembro del Equipo'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              <form id="user-form" onSubmit={handleSubmit} className="space-y-6">

                {/* Info Basica */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center">
                    <UserIcon className="w-4 h-4 mr-2" /> Información Personal
                  </h4>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5 shadow-sm">
                      Nombre completo
                    </label>
                    <input
                      type="text"
                      className="block w-full shadow-sm sm:text-sm border-gray-200 rounded-xl focus:ring-primary-500 focus:border-primary-500 py-3 px-4 bg-gray-50 hover:bg-white transition-colors"
                      value={formData.nombre_completo}
                      onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
                      required
                      placeholder="Ej. Juan Pérez"
                    />
                  </div>
                </div>

                {/* Acceso y Seguridad */}
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center">
                    <Shield className="w-4 h-4 mr-2" /> Acceso y Rol
                  </h4>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex justify-between items-center">
                      Correo de acceso
                      {editingUser && <span className="text-xs text-gray-400 font-normal">Solo lectura</span>}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        className={`block w-full pl-10 shadow-sm sm:text-sm border-gray-200 rounded-xl focus:ring-primary-500 focus:border-primary-500 py-3 pr-4 transition-colors ${editingUser ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50 hover:bg-white'}`}
                        value={formData.correo}
                        onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                        required
                        disabled={editingUser !== null}
                        placeholder="usuario@tuempresa.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Nivel de Permisos
                    </label>
                    <select
                      className="block w-full shadow-sm sm:text-sm border-gray-200 rounded-xl focus:ring-primary-500 focus:border-primary-500 py-3 px-4 bg-gray-50 hover:bg-white transition-colors appearance-none"
                      value={formData.rol}
                      onChange={(e) => setFormData({ ...formData, rol: e.target.value as any })}
                      required
                    >
                      <option value="administrador">Administrador - Acceso completo (excepto configuración global)</option>
                      <option value="cajero">Cajero - Acceso a ventas y caja únicamente</option>
                    </select>
                  </div>

                  {editingUser && (
                    <div className="mt-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                      <label className="flex items-center cursor-pointer">
                        <div className="relative">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={isChangingPassword}
                            onChange={(e) => {
                              setIsChangingPassword(e.target.checked);
                              if (!e.target.checked) setFormData({ ...formData, password: '' });
                            }}
                          />
                          <div className={`block w-10 h-6 rounded-full transition-colors ${isChangingPassword ? 'bg-primary-500' : 'bg-gray-300'}`}></div>
                          <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isChangingPassword ? 'transform translate-x-4' : ''}`}></div>
                        </div>
                        <div className="ml-3 text-sm font-medium text-gray-700">Cambiar contraseña de este usuario</div>
                      </label>
                    </div>
                  )}

                  {(!editingUser || isChangingPassword) && (
                    <div className="animate-fade-in">
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        {editingUser ? 'Nueva Contraseña' : 'Contraseña de Seguridad'}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          className="block w-full pl-10 shadow-sm sm:text-sm border-gray-200 rounded-xl focus:ring-primary-500 focus:border-primary-500 py-3 pr-4 bg-gray-50 hover:bg-white transition-colors"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required={!editingUser || isChangingPassword}
                          minLength={6}
                          placeholder="Mínimo 6 caracteres"
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-gray-500 flex items-center">
                        <Shield className="w-3 h-3 mr-1" />
                        Anota esta contraseña y compártela de forma segura.
                      </p>
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-col-reverse sm:flex-row justify-end space-y-3 space-y-reverse sm:space-y-0 sm:space-x-3">
              <button
                type="button"
                className="w-full sm:w-auto px-5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                onClick={() => setShowModal(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="user-form"
                disabled={isSubmitting}
                className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-2.5 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {editingUser ? 'Guardar Cambios' : 'Confirmar Creación'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;