import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Upload,
  Trash2,
  AlertCircle,
  Edit3,
  Save,
  XCircle,
  CheckCircle,
  ImageOff,
  Loader2,
  Phone,
  Mail,
  MapPin,
  FileText,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface BusinessDisplayData {
  id: string;
  nombre: string;
  nit: string | null;
  direccion: string | null;
  telefono_principal: string | null;
  telefono_secundario: string | null;
  correo_empresarial: string | null;
  logo_url: string | null;
  logo_nombre: string | null;
  moneda: string;
  zona_horaria: string;
}

interface BusinessEditFormData {
  nombre: string;
  nit: string;
  direccion: string;
  telefono_principal: string;
  telefono_secundario: string;
  correo_empresarial: string;
  moneda: string;
  zona_horaria: string;
}

const Negocio: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [businessData, setBusinessData] = useState<BusinessDisplayData | null>(null);

  const [editFormData, setEditFormData] = useState<BusinessEditFormData>({
    nombre: '',
    nit: '',
    direccion: '',
    telefono_principal: '',
    telefono_secundario: '',
    correo_empresarial: '',
    moneda: '',
    zona_horaria: '',
  });

  const currencies = [
    { code: 'COP', name: 'Peso Colombiano' },
    { code: 'USD', name: 'Dólar Estadounidense' },
    { code: 'EUR', name: 'Euro' },
    { code: 'MXN', name: 'Peso Mexicano' },
  ];

  const timezones = [
    { code: 'America/Bogota', name: 'Bogotá (GMT-5)' },
    { code: 'America/Mexico_City', name: 'Ciudad de México (GMT-6)' },
    { code: 'America/Lima', name: 'Lima (GMT-5)' },
    { code: 'America/Santiago', name: 'Santiago (GMT-4)' },
  ];

  const fetchBusinessDetails = useCallback(async () => {
    if (!user?.negocioId) return;

    try {
      const { data, error } = await supabase
        .from('negocios')
        .select('*')
        .eq('id', user.negocioId)
        .single();

      if (error) throw error;
      setBusinessData(data);
      setLogoPreview(data.logo_url);
    } catch (err: unknown) {
      console.error('Error fetching business details:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBusinessDetails();
  }, [fetchBusinessDetails]);

  const handleEditToggle = () => {
    if (businessData) {
      setEditFormData({
        nombre: businessData.nombre,
        nit: businessData.nit || '',
        direccion: businessData.direccion || '',
        telefono_principal: businessData.telefono_principal || '',
        telefono_secundario: businessData.telefono_secundario || '',
        correo_empresarial: businessData.correo_empresarial || '',
        moneda: businessData.moneda,
        zona_horaria: businessData.zona_horaria,
      });
      setLogoPreview(businessData.logo_url);
      setLogoFile(null);
      setIsEditing(true);
      setError(null);
      setSuccessMessage(null);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditFormData({
      nombre: '',
      nit: '',
      direccion: '',
      telefono_principal: '',
      telefono_secundario: '',
      correo_empresarial: '',
      moneda: '',
      zona_horaria: '',
    });
    setLogoFile(null);
    if (businessData) setLogoPreview(businessData.logo_url);
    setError(null);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('El logo no puede exceder los 5MB');
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const uploadLogo = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.negocioId}/${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('logos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.negocioId) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      let logoUrl = businessData?.logo_url;

      if (logoFile) {
        logoUrl = await uploadLogo(logoFile);
      }

      const { error } = await supabase
        .from('negocios')
        .update({
          ...editFormData,
          logo_url: logoUrl,
          logo_nombre: logoFile?.name || businessData?.logo_nombre,
        })
        .eq('id', user.negocioId);

      if (error) throw error;

      await fetchBusinessDetails();
      setIsEditing(false);
      setSuccessMessage('¡Información actualizada con éxito!');
    } catch (err: unknown) {
      console.error('Error updating business:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!businessData) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Error al cargar datos</h2>
        <p className="text-gray-600">No se pudo cargar la información del negocio</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Building2 className="h-6 w-6 text-primary-600 mr-2" />
            Mi Negocio
          </h1>
          {!isEditing && (
            <button
              onClick={handleEditToggle}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Editar
            </button>
          )}
        </div>

        {/* Messages */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 bg-green-50 border-l-4 border-green-400 p-4">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <div className="ml-3">
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {!isEditing ? (
          <div className="px-6 py-4">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Logo Section */}
              <div className="flex-shrink-0">
                {businessData.logo_url ? (
                  <img
                    src={businessData.logo_url}
                    alt="Logo"
                    className="w-48 h-48 object-contain rounded-lg border p-2"
                  />
                ) : (
                  <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                    <ImageOff className="h-12 w-12 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Business Info */}
              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{businessData.nombre}</h3>
                  {businessData.nit && (
                    <p className="mt-1 text-sm text-gray-500 flex items-center">
                      <FileText className="h-4 w-4 mr-1" />
                      NIT: {businessData.nit}
                    </p>
                  )}
                </div>

                {businessData.direccion && (
                  <div className="flex items-start">
                    <MapPin className="h-5 w-5 text-gray-400 mr-2 mt-0.5" />
                    <p className="text-sm text-gray-600">{businessData.direccion}</p>
                  </div>
                )}

                <div className="space-y-2">
                  {businessData.telefono_principal && (
                    <div className="flex items-center">
                      <Phone className="h-5 w-5 text-gray-400 mr-2" />
                      <p className="text-sm text-gray-600">{businessData.telefono_principal}</p>
                    </div>
                  )}

                  {businessData.telefono_secundario && (
                    <div className="flex items-center">
                      <Phone className="h-5 w-5 text-gray-400 mr-2" />
                      <p className="text-sm text-gray-600">{businessData.telefono_secundario}</p>
                    </div>
                  )}

                  {businessData.correo_empresarial && (
                    <div className="flex items-center">
                      <Mail className="h-5 w-5 text-gray-400 mr-2" />
                      <p className="text-sm text-gray-600">{businessData.correo_empresarial}</p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-200 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Moneda</p>
                    <p className="mt-1 text-sm text-gray-900">
                      {currencies.find(c => c.code === businessData.moneda)?.name || businessData.moneda}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Zona Horaria</p>
                    <p className="mt-1 text-sm text-gray-900">
                      {timezones.find(tz => tz.code === businessData.zona_horaria)?.name || businessData.zona_horaria}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveChanges} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Logo Upload */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo del negocio
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    {logoPreview ? (
                      <div className="relative inline-block">
                        <img
                          src={logoPreview}
                          alt="Preview"
                          className="mx-auto h-32 w-32 object-contain rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="absolute top-0 right-0 -mr-2 -mt-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="flex text-sm text-gray-600">
                          <label
                            htmlFor="logo-upload"
                            className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500"
                          >
                            <span>Sube un archivo</span>
                            <input
                              id="logo-upload"
                              name="logo-upload"
                              type="file"
                              className="sr-only"
                              accept="image/*"
                              onChange={handleLogoChange}
                            />
                          </label>
                          <p className="pl-1">o arrastra y suelta</p>
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG hasta 5MB</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Business Name */}
              <div className="md:col-span-2">
                <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">
                  Nombre del negocio
                </label>
                <input
                  type="text"
                  id="nombre"
                  value={editFormData.nombre}
                  onChange={(e) => setEditFormData({ ...editFormData, nombre: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  required
                />
              </div>

              {/* NIT */}
              <div className="md:col-span-2">
                <label htmlFor="nit" className="block text-sm font-medium text-gray-700">
                  NIT
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileText className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="nit"
                    value={editFormData.nit}
                    onChange={(e) => setEditFormData({ ...editFormData, nit: e.target.value })}
                    className="block w-full pl-10 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="md:col-span-2">
                <label htmlFor="direccion" className="block text-sm font-medium text-gray-700">
                  Dirección
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="direccion"
                    value={editFormData.direccion}
                    onChange={(e) => setEditFormData({ ...editFormData, direccion: e.target.value })}
                    className="block w-full pl-10 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </div>
              </div>

              {/* Phone Numbers */}
              <div>
                <label htmlFor="telefono_principal" className="block text-sm font-medium text-gray-700">
                  Teléfono principal
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    id="telefono_principal"
                    value={editFormData.telefono_principal}
                    onChange={(e) => setEditFormData({ ...editFormData, telefono_principal: e.target.value })}
                    className="block w-full pl-10 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="telefono_secundario" className="block text-sm font-medium text-gray-700">
                  Teléfono secundario (opcional)
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    id="telefono_secundario"
                    value={editFormData.telefono_secundario}
                    onChange={(e) => setEditFormData({ ...editFormData, telefono_secundario: e.target.value })}
                    className="block w-full pl-10 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="md:col-span-2">
                <label htmlFor="correo_empresarial" className="block text-sm font-medium text-gray-700">
                  Correo empresarial
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    id="correo_empresarial"
                    value={editFormData.correo_empresarial}
                    onChange={(e) => setEditFormData({ ...editFormData, correo_empresarial: e.target.value })}
                    className="block w-full pl-10 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </div>
              </div>

              {/* Currency */}
              <div>
                <label htmlFor="moneda" className="block text-sm font-medium text-gray-700">
                  Moneda
                </label>
                <select
                  id="moneda"
                  value={editFormData.moneda}
                  onChange={(e) => setEditFormData({ ...editFormData, moneda: e.target.value })}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                  {currencies.map(currency => (
                    <option key={currency.code} value={currency.code}>
                      {currency.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Timezone */}
              <div>
                <label htmlFor="zona_horaria" className="block text-sm font-medium text-gray-700">
                  Zona horaria
                </label>
                <select
                  id="zona_horaria"
                  value={editFormData.zona_horaria}
                  onChange={(e) => setEditFormData({ ...editFormData, zona_horaria: e.target.value })}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                  {timezones.map(timezone => (
                    <option key={timezone.code} value={timezone.code}>
                      {timezone.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Form Actions */}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Negocio;