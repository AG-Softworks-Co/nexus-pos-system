import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Palette, 
  FileText, 
  Printer, 
  Save, 
  Eye, 
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Monitor,
  Smartphone,
  Bell,
  CreditCard,
  Package,
  Users,
  MessageSquare,
  Download,
  Upload,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface BusinessConfig {
  id: string;
  mostrar_logo_ticket: boolean;
  mostrar_nit_ticket: boolean;
  mostrar_direccion_ticket: boolean;
  mostrar_telefono_ticket: boolean;
  mensaje_agradecimiento: string;
  mensaje_despedida: string;
  ancho_papel_mm: number;
  tamaño_fuente_titulo: number;
  tamaño_fuente_normal: number;
  tamaño_fuente_pequeño: number;
  tema_activo: string;
  color_primario: string;
  color_secundario: string;
  color_acento: string;
  notificaciones_whatsapp: boolean;
  notificaciones_email: boolean;
  permitir_ventas_sin_stock: boolean;
  solicitar_cliente_domicilio: boolean;
  tiempo_estimado_domicilio: number;
}

interface CustomTheme {
  id: string;
  nombre: string;
  descripcion: string;
  es_activo: boolean;
  color_primario: string;
  color_primario_hover: string;
  color_secundario: string;
  color_acento: string;
  color_exito: string;
  color_advertencia: string;
  color_error: string;
  color_info: string;
  color_fondo: string;
  color_fondo_tarjeta: string;
  color_fondo_sidebar: string;
  color_texto_primario: string;
  color_texto_secundario: string;
  color_texto_sidebar: string;
  radio_bordes: string;
  intensidad_sombras: string;
}

interface TicketTemplate {
  id: string;
  nombre: string;
  descripcion: string;
  es_activa: boolean;
  mostrar_encabezado: boolean;
  encabezado_personalizado: string;
  mostrar_fecha_hora: boolean;
  mostrar_vendedor: boolean;
  mostrar_cliente: boolean;
  mostrar_metodo_pago: boolean;
  mostrar_sku: boolean;
  mostrar_precio_unitario: boolean;
  mostrar_subtotales: boolean;
  mostrar_totales: boolean;
  mostrar_qr_codigo: boolean;
  texto_pie: string;
  alineacion_titulo: string;
  negrita_titulo: boolean;
  separadores: boolean;
}

const Configuration: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Estados para configuraciones
  const [businessConfig, setBusinessConfig] = useState<BusinessConfig | null>(null);
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [ticketTemplates, setTicketTemplates] = useState<TicketTemplate[]>([]);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTheme, setEditingTheme] = useState<CustomTheme | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<TicketTemplate | null>(null);

  // Estados adicionales
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);

  // Estados para formularios
  const [themeForm, setThemeForm] = useState<Partial<CustomTheme>>({});
  const [templateForm, setTemplateForm] = useState<Partial<TicketTemplate>>({});

  useEffect(() => {
    if (user?.negocioId) {
      fetchConfigurations();
    }
  }, [user]);

  const fetchConfigurations = async () => {
    setLoading(true);
    try {
      // Fetch business configuration
      const { data: configData, error: configError } = await supabase
        .from('configuracion_negocio')
        .select('*')
        .eq('negocio_id', user?.negocioId)
        .single();

      if (configError && configError.code !== 'PGRST116') throw configError;
      setBusinessConfig(configData);

      // Fetch custom themes
      const { data: themesData, error: themesError } = await supabase
        .from('temas_personalizados')
        .select('*')
        .eq('negocio_id', user?.negocioId)
        .order('creado_en', { ascending: false });

      if (themesError) throw themesError;
      setCustomThemes(themesData || []);

      // Fetch ticket templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('plantillas_ticket')
        .select('*')
        .eq('negocio_id', user?.negocioId)
        .order('creado_en', { ascending: false });

      if (templatesError) throw templatesError;
      setTicketTemplates(templatesData || []);

    } catch (err: any) {
      console.error('Error fetching configurations:', err);
      setError('Error al cargar configuraciones');
    } finally {
      setLoading(false);
    }
  };

  const saveBusinessConfig = async () => {
    if (!businessConfig || !user?.negocioId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase
        .from('configuracion_negocio')
        .upsert({
          ...businessConfig,
          negocio_id: user.negocioId
        });

      if (error) throw error;
      setSuccess('Configuración guardada exitosamente');
    } catch (err: any) {
      setError('Error al guardar configuración: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveTheme = async () => {
    if (!user?.negocioId) return;

    setSaving(true);
    try {
      if (editingTheme) {
        const { error } = await supabase
          .from('temas_personalizados')
          .update(themeForm)
          .eq('id', editingTheme.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('temas_personalizados')
          .insert({
            ...themeForm,
            negocio_id: user.negocioId
          });
        if (error) throw error;
      }

      await fetchConfigurations();
      setShowThemeModal(false);
      setEditingTheme(null);
      setThemeForm({});
      setSuccess('Tema guardado exitosamente');
    } catch (err: any) {
      setError('Error al guardar tema: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const activateTheme = async (themeId: string) => {
    try {
      const { error } = await supabase
        .from('temas_personalizados')
        .update({ es_activo: true })
        .eq('id', themeId);

      if (error) throw error;
      await fetchConfigurations();
      setSuccess('Tema activado exitosamente');
    } catch (err: any) {
      setError('Error al activar tema: ' + err.message);
    }
  };

  const deleteTheme = async (themeId: string) => {
    try {
      const { error } = await supabase
        .from('temas_personalizados')
        .delete()
        .eq('id', themeId);

      if (error) throw error;
      await fetchConfigurations();
      setSuccess('Tema eliminado exitosamente');
    } catch (err: any) {
      setError('Error al eliminar tema: ' + err.message);
    }
  };

  const activateTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('plantillas_ticket')
        .update({ es_activa: true })
        .eq('id', templateId);

      if (error) throw error;
      await fetchConfigurations();
      setSuccess('Plantilla activada exitosamente');
    } catch (err: any) {
      setError('Error al activar plantilla: ' + err.message);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('plantillas_ticket')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      await fetchConfigurations();
      setSuccess('Plantilla eliminada exitosamente');
    } catch (err: any) {
      setError('Error al eliminar plantilla: ' + err.message);
    }
  };

  const generateTemplatePreview = (template: TicketTemplate) => {
    setShowTemplatePreview(true);
  };

  const tabs = [
    { id: 'general', name: 'General', icon: Settings },
    { id: 'tickets', name: 'Tickets', icon: FileText },
    { id: 'themes', name: 'Temas', icon: Palette },
    { id: 'printers', name: 'Impresoras', icon: Printer },
  ];

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Cargando configuraciones...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <button
          onClick={fetchConfigurations}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <X className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Check className="h-5 w-5 text-green-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'general' && businessConfig && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Configuración General</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Notificaciones */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-800 flex items-center">
                    <Bell className="h-5 w-5 mr-2" />
                    Notificaciones
                  </h4>
                  
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={businessConfig.notificaciones_whatsapp}
                        onChange={(e) => setBusinessConfig({
                          ...businessConfig,
                          notificaciones_whatsapp: e.target.checked
                        })}
                        className="form-checkbox h-4 w-4 text-primary-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">Notificaciones WhatsApp</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={businessConfig.notificaciones_email}
                        onChange={(e) => setBusinessConfig({
                          ...businessConfig,
                          notificaciones_email: e.target.checked
                        })}
                        className="form-checkbox h-4 w-4 text-primary-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">Notificaciones Email</span>
                    </label>
                  </div>
                </div>

                {/* Ventas */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-800 flex items-center">
                    <CreditCard className="h-5 w-5 mr-2" />
                    Configuración de Ventas
                  </h4>
                  
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={businessConfig.permitir_ventas_sin_stock}
                        onChange={(e) => setBusinessConfig({
                          ...businessConfig,
                          permitir_ventas_sin_stock: e.target.checked
                        })}
                        className="form-checkbox h-4 w-4 text-primary-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">Permitir ventas sin stock</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={businessConfig.solicitar_cliente_domicilio}
                        onChange={(e) => setBusinessConfig({
                          ...businessConfig,
                          solicitar_cliente_domicilio: e.target.checked
                        })}
                        className="form-checkbox h-4 w-4 text-primary-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">Solicitar cliente en domicilios</span>
                    </label>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tiempo estimado domicilio (minutos)
                      </label>
                      <input
                        type="number"
                        min="15"
                        max="120"
                        value={businessConfig.tiempo_estimado_domicilio}
                        onChange={(e) => setBusinessConfig({
                          ...businessConfig,
                          tiempo_estimado_domicilio: parseInt(e.target.value)
                        })}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={saveBusinessConfig}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tickets' && businessConfig && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Configuración de Tickets</h3>
                <button
                  onClick={() => {
                    setEditingTemplate(null);
                    setTemplateForm({
                      nombre: '',
                      descripcion: '',
                      mostrar_encabezado: true,
                      mostrar_fecha_hora: true,
                      mostrar_vendedor: true,
                      mostrar_cliente: true,
                      mostrar_metodo_pago: true,
                      mostrar_sku: false,
                      mostrar_precio_unitario: true,
                      mostrar_subtotales: true,
                      mostrar_totales: true,
                      mostrar_qr_codigo: false,
                      alineacion_titulo: 'center',
                      negrita_titulo: true,
                      separadores: true
                    });
                    setShowTemplateModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Plantilla
                </button>
              </div>

              {/* Configuración básica de tickets */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-800">Información en Ticket</h4>
                  
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={businessConfig.mostrar_logo_ticket}
                        onChange={(e) => setBusinessConfig({
                          ...businessConfig,
                          mostrar_logo_ticket: e.target.checked
                        })}
                        className="form-checkbox h-4 w-4 text-primary-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">Mostrar logo</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={businessConfig.mostrar_nit_ticket}
                        onChange={(e) => setBusinessConfig({
                          ...businessConfig,
                          mostrar_nit_ticket: e.target.checked
                        })}
                        className="form-checkbox h-4 w-4 text-primary-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">Mostrar NIT</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={businessConfig.mostrar_direccion_ticket}
                        onChange={(e) => setBusinessConfig({
                          ...businessConfig,
                          mostrar_direccion_ticket: e.target.checked
                        })}
                        className="form-checkbox h-4 w-4 text-primary-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">Mostrar dirección</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={businessConfig.mostrar_telefono_ticket}
                        onChange={(e) => setBusinessConfig({
                          ...businessConfig,
                          mostrar_telefono_ticket: e.target.checked
                        })}
                        className="form-checkbox h-4 w-4 text-primary-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">Mostrar teléfono</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-800">Formato de Impresión</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ancho del papel (mm)
                    </label>
                    <select
                      value={businessConfig.ancho_papel_mm}
                      onChange={(e) => setBusinessConfig({
                        ...businessConfig,
                        ancho_papel_mm: parseInt(e.target.value)
                      })}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value={58}>58mm</option>
                      <option value={80}>80mm</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Título
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="20"
                        value={businessConfig.tamaño_fuente_titulo}
                        onChange={(e) => setBusinessConfig({
                          ...businessConfig,
                          tamaño_fuente_titulo: parseInt(e.target.value)
                        })}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Normal
                      </label>
                      <input
                        type="number"
                        min="8"
                        max="14"
                        value={businessConfig.tamaño_fuente_normal}
                        onChange={(e) => setBusinessConfig({
                          ...businessConfig,
                          tamaño_fuente_normal: parseInt(e.target.value)
                        })}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pequeño
                      </label>
                      <input
                        type="number"
                        min="6"
                        max="12"
                        value={businessConfig.tamaño_fuente_pequeño}
                        onChange={(e) => setBusinessConfig({
                          ...businessConfig,
                          tamaño_fuente_pequeño: parseInt(e.target.value)
                        })}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Mensajes personalizados */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-800">Mensajes Personalizados</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mensaje de agradecimiento
                    </label>
                    <input
                      type="text"
                      value={businessConfig.mensaje_agradecimiento}
                      onChange={(e) => setBusinessConfig({
                        ...businessConfig,
                        mensaje_agradecimiento: e.target.value
                      })}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mensaje de despedida
                    </label>
                    <input
                      type="text"
                      value={businessConfig.mensaje_despedida}
                      onChange={(e) => setBusinessConfig({
                        ...businessConfig,
                        mensaje_despedida: e.target.value
                      })}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={saveBusinessConfig}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>
            </div>

            {/* Lista de plantillas */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Plantillas de Ticket</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ticketTemplates.map((template) => (
                  <div key={template.id} className={`border rounded-lg p-4 ${
                    template.es_activa ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900">{template.nombre}</h4>
                      {template.es_activa && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                          Activa
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-500 mb-3">{template.descripcion}</p>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setTemplateForm(template);
                            setShowTemplateModal(true);
                          }}
                          className="text-primary-600 hover:text-primary-900"
                          title="Editar plantilla"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => generateTemplatePreview(template)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Vista previa"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => deleteTemplate(template.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Eliminar plantilla"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      
                      {!template.es_activa && (
                        <button 
                          onClick={() => activateTemplate(template.id)}
                          className="text-sm text-primary-600 hover:text-primary-900"
                        >
                          Activar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'themes' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Temas Personalizados</h3>
                <button
                  onClick={() => {
                    setEditingTheme(null);
                    setThemeForm({
                      nombre: '',
                      descripcion: '',
                      color_primario: '#6366f1',
                      color_primario_hover: '#4f46e5',
                      color_secundario: '#8b5cf6',
                      color_acento: '#06b6d4',
                      color_exito: '#10b981',
                      color_advertencia: '#f59e0b',
                      color_error: '#ef4444',
                      color_info: '#3b82f6',
                      color_fondo: '#f8fafc',
                      color_fondo_tarjeta: '#ffffff',
                      color_fondo_sidebar: '#1e293b',
                      color_texto_primario: '#1f2937',
                      color_texto_secundario: '#6b7280',
                      color_texto_sidebar: '#f1f5f9',
                      radio_bordes: 'md',
                      intensidad_sombras: 'md'
                    });
                    setShowThemeModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Tema
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {customThemes.map((theme) => (
                  <div key={theme.id} className={`border rounded-lg p-4 ${
                    theme.es_activo ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                  }`}>
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium text-gray-900">{theme.nombre}</h4>
                      {theme.es_activo && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                          Activo
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-500 mb-3">{theme.descripcion}</p>
                    
                    {/* Preview de colores */}
                    <div className="flex space-x-2 mb-3">
                      <div 
                        className="w-6 h-6 rounded-full border border-gray-300"
                        style={{ backgroundColor: theme.color_primario }}
                        title="Color primario"
                      />
                      <div 
                        className="w-6 h-6 rounded-full border border-gray-300"
                        style={{ backgroundColor: theme.color_secundario }}
                        title="Color secundario"
                      />
                      <div 
                        className="w-6 h-6 rounded-full border border-gray-300"
                        style={{ backgroundColor: theme.color_acento }}
                        title="Color acento"
                      />
                      <div 
                        className="w-6 h-6 rounded-full border border-gray-300"
                        style={{ backgroundColor: theme.color_exito }}
                        title="Color éxito"
                      />
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingTheme(theme);
                            setThemeForm(theme);
                            setShowThemeModal(true);
                          }}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => deleteTheme(theme.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      
                      {!theme.es_activo && (
                        <button 
                          onClick={() => activateTheme(theme.id)}
                          className="text-sm text-primary-600 hover:text-primary-900"
                        >
                          Activar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'printers' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Configuración de Impresoras</h3>
                <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Impresora
                </button>
              </div>

              <div className="text-center py-8">
                <Printer className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Configuración de impresoras próximamente</p>
                <p className="text-sm text-gray-400 mt-2">
                  Podrás configurar impresoras térmicas, matriciales y más
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Template Preview Modal */}
      {showTemplatePreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={() => setShowTemplatePreview(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Vista Previa del Ticket</h3>
                  <button
                    onClick={() => setShowTemplatePreview(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                
                {/* Ticket Preview */}
                <div className="bg-white border border-gray-300 p-4 font-mono text-xs leading-tight max-w-xs mx-auto">
                  {/* Header */}
                  <div className="text-center mb-2">
                    {businessConfig?.mostrar_logo_ticket && (
                      <div className="w-16 h-8 bg-gray-200 mx-auto mb-2 flex items-center justify-center text-gray-500 text-xs">
                        LOGO
                      </div>
                    )}
                    <div className="font-bold text-sm">MI NEGOCIO</div>
                    {businessConfig?.mostrar_nit_ticket && <div>NIT: 123456789-0</div>}
                    {businessConfig?.mostrar_direccion_ticket && <div>Calle Principal #123</div>}
                    {businessConfig?.mostrar_telefono_ticket && <div>Tel: 123-456-7890</div>}
                  </div>
                  
                  <div className="border-t border-gray-300 my-2"></div>
                  
                  {/* Sale info */}
                  <div className="text-center mb-2">
                    <div className="font-bold">RECIBO DE VENTA</div>
                    <div>No. 12345678</div>
                  </div>
                  
                  <div className="mb-2">
                    <div>Fecha: 31/01/2025 14:30</div>
                    <div>Vendedor: Juan Pérez</div>
                    <div>Cliente: María García</div>
                  </div>
                  
                  <div className="border-t border-gray-300 my-2"></div>
                  
                  {/* Products */}
                  <div className="mb-2">
                    <div className="flex justify-between font-bold border-b">
                      <span>Producto</span>
                      <span>Cant</span>
                      <span>Total</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Café Americano</span>
                      <span>2</span>
                      <span>$8,000</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Croissant</span>
                      <span>1</span>
                      <span>$3,500</span>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-300 my-2"></div>
                  
                  {/* Totals */}
                  <div className="mb-2">
                    <div className="flex justify-between font-bold">
                      <span>TOTAL:</span>
                      <span>$11,500</span>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div>Método de pago: EFECTIVO</div>
                  </div>
                  
                  <div className="border-t border-gray-300 my-2"></div>
                  
                  {/* Footer */}
                  <div className="text-center">
                    <div>{businessConfig?.mensaje_agradecimiento || '¡Gracias por su compra!'}</div>
                    <div>{businessConfig?.mensaje_despedida || 'Vuelva pronto'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Theme Modal */}
      {showThemeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={() => setShowThemeModal(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {editingTheme ? 'Editar Tema' : 'Nuevo Tema'}
                </h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre del tema
                      </label>
                      <input
                        type="text"
                        value={themeForm.nombre || ''}
                        onChange={(e) => setThemeForm({...themeForm, nombre: e.target.value})}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descripción
                      </label>
                      <input
                        type="text"
                        value={themeForm.descripcion || ''}
                        onChange={(e) => setThemeForm({...themeForm, descripcion: e.target.value})}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Color Primario
                      </label>
                      <input
                        type="color"
                        value={themeForm.color_primario || '#6366f1'}
                        onChange={(e) => setThemeForm({...themeForm, color_primario: e.target.value})}
                        className="block w-full h-10 border-gray-300 rounded-md"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Color Secundario
                      </label>
                      <input
                        type="color"
                        value={themeForm.color_secundario || '#8b5cf6'}
                        onChange={(e) => setThemeForm({...themeForm, color_secundario: e.target.value})}
                        className="block w-full h-10 border-gray-300 rounded-md"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Color Acento
                      </label>
                      <input
                        type="color"
                        value={themeForm.color_acento || '#06b6d4'}
                        onChange={(e) => setThemeForm({...themeForm, color_acento: e.target.value})}
                        className="block w-full h-10 border-gray-300 rounded-md"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Color Éxito
                      </label>
                      <input
                        type="color"
                        value={themeForm.color_exito || '#10b981'}
                        onChange={(e) => setThemeForm({...themeForm, color_exito: e.target.value})}
                        className="block w-full h-10 border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={saveTheme}
                  disabled={saving}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar Tema'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowThemeModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Configuration;