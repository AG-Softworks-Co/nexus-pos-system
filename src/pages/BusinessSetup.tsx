import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Upload, Trash2, Phone, Mail, MapPin, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const BusinessSetup: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  
  const [formData, setFormData] = useState({
    nombre: '',
    nit: '',
    direccion: '',
    telefono_principal: '',
    telefono_secundario: '',
    correo_empresarial: '',
    moneda: 'COP',
    zona_horaria: 'America/Bogota',
    logo_url: '',
    logo_nombre: ''
  });

  const currencies = [
    { code: 'COP', name: 'Peso Colombiano' },
    { code: 'USD', name: 'Dólar Estadounidense' },
    { code: 'EUR', name: 'Euro' },
    { code: 'MXN', name: 'Peso Mexicano' }
  ];

  const timezones = [
    { code: 'America/Bogota', name: 'Bogotá (GMT-5)' },
    { code: 'America/Mexico_City', name: 'Ciudad de México (GMT-6)' },
    { code: 'America/Lima', name: 'Lima (GMT-5)' },
    { code: 'America/Santiago', name: 'Santiago (GMT-4)' }
  ];

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setFormData(prev => ({ ...prev, logo_nombre: file.name }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    setFormData(prev => ({ ...prev, logo_url: '', logo_nombre: '' }));
  };

  const uploadLogo = async () => {
    if (!logoFile) return null;

    const fileExt = logoFile.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `business-logos/${fileName}`;

    const { error: uploadError, data } = await supabase.storage
      .from('logos')
      .upload(filePath, logoFile);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('logos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let logoUrl = formData.logo_url;
      
      if (logoFile) {
        logoUrl = await uploadLogo();
      }

      const businessData = {
        ...formData,
        logo_url: logoUrl
      };

      if (user?.negocioId) {
        // Update existing business
        const { error: updateError } = await supabase
          .from('negocios')
          .update(businessData)
          .eq('id', user.negocioId);

        if (updateError) throw updateError;
      } else {
        // Create new business
        const { data: newBusiness, error: insertError } = await supabase
          .from('negocios')
          .insert(businessData)
          .select()
          .single();

        if (insertError) throw insertError;

        // Update user's negocioId
        const { error: userUpdateError } = await supabase
          .from('usuarios')
          .update({ negocio_id: newBusiness.id })
          .eq('id', user?.id);

        if (userUpdateError) throw userUpdateError;
      }

      await refreshUser();
      navigate('/');
    } catch (err) {
      console.error('Error updating business:', err);
      setError('Error al actualizar la información del negocio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <Building2 className="mx-auto h-12 w-12 text-primary-600" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Configura tu negocio
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Necesitamos algunos datos para configurar tu punto de venta
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Logo del negocio
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  {logoPreview ? (
                    <div className="relative">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="mx-auto h-32 w-32 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={removeLogo}
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
                      <p className="text-xs text-gray-500">
                        PNG, JPG, GIF hasta 10MB
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">
                  Nombre del negocio
                </label>
                <div className="mt-1">
                  <input
                    id="nombre"
                    name="nombre"
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="Mi Cafetería"
                  />
                </div>
              </div>

              <div>
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
                    value={formData.nit}
                    onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                    className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                    placeholder="123456789-0"
                  />
                </div>
              </div>

              <div>
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
                    value={formData.direccion}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                    placeholder="Calle Principal #123"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      value={formData.telefono_principal}
                      onChange={(e) => setFormData({ ...formData, telefono_principal: e.target.value })}
                      className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                      placeholder="(123) 456-7890"
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
                      value={formData.telefono_secundario}
                      onChange={(e) => setFormData({ ...formData, telefono_secundario: e.target.value })}
                      className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                      placeholder="(123) 456-7890"
                    />
                  </div>
                </div>
              </div>

              <div>
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
                    value={formData.correo_empresarial}
                    onChange={(e) => setFormData({ ...formData, correo_empresarial: e.target.value })}
                    className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                    placeholder="contacto@minegocio.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="moneda" className="block text-sm font-medium text-gray-700">
                  Moneda
                </label>
                <div className="mt-1">
                  <select
                    id="moneda"
                    name="moneda"
                    value={formData.moneda}
                    onChange={(e) => setFormData({ ...formData, moneda: e.target.value })}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                  >
                    {currencies.map(currency => (
                      <option key={currency.code} value={currency.code}>
                        {currency.name} ({currency.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="zona_horaria" className="block text-sm font-medium text-gray-700">
                  Zona horaria
                </label>
                <div className="mt-1">
                  <select
                    id="zona_horaria"
                    name="zona_horaria"
                    value={formData.zona_horaria}
                    onChange={(e) => setFormData({ ...formData, zona_horaria: e.target.value })}
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
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Guardando...
                  </span>
                ) : (
                  'Guardar y continuar'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BusinessSetup;