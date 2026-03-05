import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Edit, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
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

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('negocio_id', user?.negocioId)
        .order('creado_en', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setFormData({
      nombre_completo: user.nombre_completo,
      correo: user.correo,
      rol: user.rol
    });
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
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (editingUser) {
        // Update existing user
        const { error: updateError } = await supabase
          .from('usuarios')
          .update({
            nombre_completo: formData.nombre_completo,
            rol: formData.rol
          })
          .eq('id', editingUser.id);

        if (updateError) throw updateError;
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

        if (signUpError) throw signUpError;

        // Create user profile
        const { error: profileError } = await supabase
          .from('usuarios')
          .update({
            rol: formData.rol,
            negocio_id: user?.negocioId
          })
          .eq('id', authData.user!.id);

        if (profileError) throw profileError;
        setSuccessMessage('Usuario creado exitosamente');
      }

      await fetchUsers();
      setShowModal(false);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;
      
      await fetchUsers();
      setDeleteConfirmId(null);
      setSuccessMessage('Usuario eliminado exitosamente');
    } catch (err: any) {
      console.error('Error deleting user:', err);
      setError('Error al eliminar usuario');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchQuery || 
      user.nombre_completo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.correo.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.rol === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
        
        <button
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          onClick={handleAddNew}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Nuevo Usuario
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Éxito</h3>
              <div className="mt-2 text-sm text-green-700">
                <p>{successMessage}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="pl-10 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
            placeholder="Buscar usuarios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="w-full sm:w-auto">
          <select
            className="focus:ring-primary-500 focus:border-primary-500 h-full py-2 pl-3 pr-7 border-gray-300 bg-white text-gray-700 sm:text-sm rounded-md w-full"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">Todos los roles</option>
            <option value="propietario">Propietario</option>
            <option value="administrador">Administrador</option>
            <option value="cajero">Cajero</option>
          </select>
        </div>
      </div>
      
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rol
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha de creación
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-primary-700 font-medium">
                          {user.nombre_completo.split(' ').map(name => name[0]).join('')}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.nombre_completo}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.correo}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.rol === 'propietario' ? 'bg-purple-100 text-purple-800' :
                      user.rol === 'administrador' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {user.rol}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(user.creado_en)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {deleteConfirmId === user.id ? (
                      <div className="flex items-center justify-end space-x-2">
                        <span className="text-xs text-gray-500">¿Confirmar?</span>
                        <button 
                          className="text-red-600 hover:text-red-900"
                          onClick={() => handleDelete(user.id)}
                        >
                          Sí
                        </button>
                        <button 
                          className="text-gray-600 hover:text-gray-900"
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end space-x-3">
                        <button 
                          className="text-primary-600 hover:text-primary-900"
                          onClick={() => handleEditClick(user)}
                          disabled={user.rol === 'propietario'}
                          title={user.rol === 'propietario' ? "No se puede editar al propietario" : ""}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          className="text-red-600 hover:text-red-900"
                          onClick={() => setDeleteConfirmId(user.id)}
                          disabled={user.rol === 'propietario'}
                          title={user.rol === 'propietario' ? "No se puede eliminar al propietario" : ""}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                    No se encontraron usuarios
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={() => setShowModal(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                  </h3>
                  
                  <div className="mb-4">
                    <label htmlFor="nombre_completo" className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre completo
                    </label>
                    <input
                      type="text"
                      id="nombre_completo"
                      className="focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      value={formData.nombre_completo}
                      onChange={(e) => setFormData({...formData, nombre_completo: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="correo" className="block text-sm font-medium text-gray-700 mb-1">
                      Correo electrónico
                    </label>
                    <input
                      type="email"
                      id="correo"
                      className="focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      value={formData.correo}
                      onChange={(e) => setFormData({...formData, correo: e.target.value})}
                      required
                      disabled={editingUser !== null}
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="rol" className="block text-sm font-medium text-gray-700 mb-1">
                      Rol
                    </label>
                    <select
                      id="rol"
                      className="focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      value={formData.rol}
                      onChange={(e) => setFormData({...formData, rol: e.target.value as any})}
                      required
                    >
                      <option value="administrador">Administrador</option>
                      <option value="cajero">Cajero</option>
                    </select>
                  </div>
                  
                  {!editingUser && (
                    <div className="mb-4">
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        Contraseña
                      </label>
                      <input
                        type="password"
                        id="password"
                        className="focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        required={!editingUser}
                        minLength={6}
                      />
                    </div>
                  )}
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {isSubmitting ? 'Guardando...' : editingUser ? 'Guardar cambios' : 'Crear usuario'}
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => setShowModal(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;