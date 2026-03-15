import React, { useState, useEffect } from 'react';
import { Search, Plus, Settings, Filter, Edit, Trash2, Upload, X, AlertCircle, Package, AlertTriangle, Barcode } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Database } from '../types/database';

type Product = Database['public']['Tables']['productos']['Row'];
type Category = Database['public']['Tables']['categorias']['Row'];

type StockAlert = {
  id: string;
  producto_id: string;
  tipo: 'bajo_stock' | 'sin_stock';
  mensaje: string;
  leido: boolean;
  creado_en: string;
};

const Products: React.FC = () => {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [showStockAlerts, setShowStockAlerts] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    precio_costo: '',
    precio_venta: '',
    categoria_id: '',
    sku: '',
    stock_actual: '0',
    stock_minimo: '5',
    requiere_stock: true
  });

  const fetchProducts = React.useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('productos')
        .select('*')
        .eq('negocio_id', user?.negocioId);

      if (fetchError) throw fetchError;
      setProducts(data || []);
    } catch (err: unknown) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.negocioId]);

  const fetchStockAlerts = React.useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('stock_alertas')
        .select('*')
        .eq('negocio_id', user?.negocioId)
        .eq('leido', false)
        .order('creado_en', { ascending: false });

      if (fetchError) throw fetchError;
      setStockAlerts(data || []);
    } catch (err: unknown) {
      console.error('Error fetching stock alerts:', err);
    }
  }, [user?.negocioId]);

  const fetchCategories = React.useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('categorias')
        .select('*')
        .eq('negocio_id', user?.negocioId);

      if (fetchError) throw fetchError;
      setCategories(data || []);
    } catch (err: unknown) {
      console.error('Error fetching categories:', err);
    }
  }, [user?.negocioId]);

  useEffect(() => {
    if (user?.negocioId) {
      fetchProducts();
      fetchCategories();
      fetchStockAlerts();
    }
  }, [user?.negocioId, fetchProducts, fetchCategories, fetchStockAlerts]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('La imagen no puede exceder los 5MB');
        return;
      }

      // Create object URL for preview
      const objectUrl = URL.createObjectURL(file);
      setImageFile(file);
      setImagePreview(objectUrl);

      // Clean up the object URL when component unmounts or preview changes
      return () => URL.revokeObjectURL(objectUrl);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.negocioId}/${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('productos')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('productos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      let imageUrl = editingProduct?.url_imagen || null;

      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const productData = {
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        precio_costo: parseFloat(formData.precio_costo),
        precio_venta: parseFloat(formData.precio_venta),
        url_imagen: imageUrl,
        categoria_id: formData.categoria_id || null,
        negocio_id: user?.negocioId,
        sku: formData.sku || null,
        stock_actual: parseInt(formData.stock_actual),
        stock_minimo: parseInt(formData.stock_minimo),
        requiere_stock: formData.requiere_stock
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('productos')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('productos')
          .insert([productData]);

        if (error) throw error;
      }

      await fetchProducts();
      setShowModal(false);
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const product = products.find(p => p.id === id);
      if (product?.url_imagen) {
        const imagePath = product.url_imagen.split('/').pop();
        if (imagePath) {
          await supabase.storage
            .from('productos')
            .remove([`${user?.negocioId}/${imagePath}`]);
        }
      }

      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchProducts();
      setDeleteConfirmId(null);
    } catch (err: unknown) {
      console.error('Error deleting product:', err);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      nombre: product.nombre,
      descripcion: product.descripcion || '',
      precio_costo: product.precio_costo.toString(),
      precio_venta: product.precio_venta.toString(),
      categoria_id: product.categoria_id || '',
      sku: product.sku || '',
      stock_actual: product.stock_actual.toString(),
      stock_minimo: product.stock_minimo.toString(),
      requiere_stock: product.requiere_stock
    });
    setImagePreview(product.url_imagen);
    setShowModal(true);
  };

  const resetForm = React.useCallback(() => {
    setFormData({
      nombre: '',
      descripcion: '',
      precio_costo: '',
      precio_venta: '',
      categoria_id: '',
      sku: '',
      stock_actual: '0',
      stock_minimo: '5',
      requiere_stock: true
    });
    setImageFile(null);
    setImagePreview(null);
    setEditingProduct(null);
    setError(null);
  }, []);

  const markAlertAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('stock_alertas')
        .update({ leido: true })
        .eq('id', alertId);

      if (error) throw error;
      await fetchStockAlerts();
    } catch (err) {
      console.error('Error marking alert as read:', err);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory = !selectedCategory || product.categoria_id === selectedCategory;
    const matchesSearch = !searchQuery || 
      product.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.descripcion?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Cargando productos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
        
        <div className="flex gap-2">
          {stockAlerts.length > 0 && (
            <button
              onClick={() => setShowStockAlerts(true)}
              className="inline-flex items-center px-4 py-2 border border-yellow-500 shadow-sm text-sm font-medium rounded-md text-yellow-700 bg-yellow-50 hover:bg-yellow-100"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Alertas ({stockAlerts.length})
            </button>
          )}
          
          <button
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
          </button>
        </div>
      </div>

      <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="pl-10 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <select
              className="focus:ring-primary-500 focus:border-primary-500 h-full py-2 pl-3 pr-7 border-gray-300 bg-white text-gray-700 sm:text-sm rounded-md"
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
            >
              <option value="">Todas las categorías</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.nombre}
                </option>
              ))}
            </select>

            <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
              <Filter className="h-4 w-4" />
            </button>
            
            <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden group">
            <div className="aspect-w-3 aspect-h-2 relative">
              <img 
                src={product.url_imagen || 'https://via.placeholder.com/300x200?text=No+Image'} 
                alt={product.nombre}
                className="object-cover w-full h-48" 
              />
              <div className="absolute inset-0 bg-black bg-opacity-30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                <button 
                  className="p-2 bg-white rounded-full text-gray-700 hover:text-primary-600 transition-colors"
                  onClick={() => handleEdit(product)}
                >
                  <Edit className="h-5 w-5" />
                </button>
                <button 
                  className="p-2 bg-white rounded-full text-gray-700 hover:text-red-600 transition-colors"
                  onClick={() => setDeleteConfirmId(product.id)}
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{product.nombre}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 h-10">
                    {product.descripcion}
                  </p>
                </div>
              </div>
              
              <div className="mt-4 flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Precio de venta</p>
                  <p className="text-lg font-bold text-gray-900">
                    ${product.precio_venta.toLocaleString()}
                  </p>
                </div>
                
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                  {categories.find(c => c.id === product.categoria_id)?.nombre || 'Sin categoría'}
                </span>
              </div>

              {product.requiere_stock && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <Package className="h-4 w-4 text-gray-400 mr-1" />
                      <span className="text-sm text-gray-500">Stock:</span>
                    </div>
                    <span className={`text-sm font-medium ${
                      product.stock_actual <= 0 ? 'text-red-600' :
                      product.stock_actual <= product.stock_minimo ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {product.stock_actual} unidades
                    </span>
                  </div>
                  {product.sku && (
                    <div className="mt-2 flex items-center text-xs text-gray-500">
                      <Barcode className="h-3 w-3 mr-1" />
                      SKU: {product.sku}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showStockAlerts && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={() => setShowStockAlerts(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Alertas de Stock
                </h3>
                
                <div className="space-y-4">
                  {stockAlerts.map(alert => (
                    <div key={alert.id} className={`p-4 rounded-lg ${
                      alert.tipo === 'sin_stock' ? 'bg-red-50' : 'bg-yellow-50'
                    }`}>
                      <div className="flex justify-between items-start">
                        <div className="flex items-start">
                          <AlertTriangle className={`h-5 w-5 ${
                            alert.tipo === 'sin_stock' ? 'text-red-400' : 'text-yellow-400'
                          } mt-0.5`} />
                          <div className="ml-3">
                            <p className={`text-sm font-medium ${
                              alert.tipo === 'sin_stock' ? 'text-red-800' : 'text-yellow-800'
                            }`}>
                              {alert.mensaje}
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                              {new Date(alert.creado_en).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => markAlertAsRead(alert.id)}
                          className="ml-4 text-gray-400 hover:text-gray-500"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowStockAlerts(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={() => setShowModal(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <form onSubmit={handleSubmit} className="divide-y divide-gray-200">
                <div className="px-4 py-5 sm:px-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                      {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                    </h3>
                    <button
                      type="button"
                      className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                      onClick={() => setShowModal(false)}
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                <div className="px-4 py-5 sm:p-6">
                  {error && (
                    <div className="mb-4 rounded-md bg-red-50 p-4">
                      <div className="flex">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                        <div className="ml-3">
                          <p className="text-sm text-red-700">{error}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column - Image Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Imagen del producto
                      </label>
                      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg relative">
                        <div className="space-y-1 text-center">
                          {imagePreview ? (
                            <div className="relative inline-block">
                              <img
                                src={imagePreview}
                                alt="Preview"
                                className="max-h-64 rounded-lg object-contain mx-auto"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setImageFile(null);
                                  setImagePreview(null);
                                }}
                                className="absolute top-2 right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200 transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <Upload className="mx-auto h-12 w-12 text-gray-400" />
                              <div className="flex text-sm text-gray-600">
                                <label
                                  htmlFor="image-upload"
                                  className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500"
                                >
                                  <span>Sube una imagen</span>
                                  <input
                                    id="image-upload"
                                    name="image-upload"
                                    type="file"
                                    className="sr-only"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                  />
                                </label>
                                <p className="pl-1">o arrastra y suelta</p>
                              </div>
                              <p className="text-xs text-gray-500">PNG, JPG hasta 5MB</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Product Details */}
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">
                          Nombre del producto
                        </label>
                        <input
                          type="text"
                          id="nombre"
                          value={formData.nombre}
                          onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                          className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor="sku" className="block text-sm font-medium text-gray-700">
                          SKU / Código de barras
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                           <input
                            type="text"
                            id="sku"
                            value={formData.sku}
                            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                            className="focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700">
                          Descripción
                        </label>
                        <textarea
                          id="descripcion"
                          rows={3}
                          value={formData.descripcion}
                          onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                          className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="precio_costo" className="block text-sm font-medium text-gray-700">
                            Precio de costo
                          </label>
                          <div className="mt-1 relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 sm:text-sm">$</span>
                            </div>
                            <input
                              type="number"
                              id="precio_costo"
                              value={formData.precio_costo}
                              onChange={(e) => setFormData({ ...formData, precio_costo: e.target.value })}
                              className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                              required
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="precio_venta" className="block text-sm font-medium text-gray-700">
                            Precio de venta
                          </label>
                          <div className="mt-1 relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 sm:text-sm">$</span>
                            </div>
                            <input
                              type="number"
                              id="precio_venta"
                              value={formData.precio_venta}
                              onChange={(e) => setFormData({ ...formData, precio_venta: e.target.value })}
                              className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                              required
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="categoria" className="block text-sm font-medium text-gray-700">
                          Categoría
                        </label>
                        <select
                          id="categoria"
                          value={formData.categoria_id}
                          onChange={(e) => setFormData({ ...formData, categoria_id: e.target.value })}
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                        >
                          <option value="">Sin categoría</option>
                          {categories.map(category => (
                
                            <option key={category.id} value={category.id}>
                              {category.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Stock Control Section */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-medium text-gray-900">Control de Stock</h4>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.requiere_stock}
                          onChange={(e) => setFormData({ ...formData, requiere_stock: e.target.checked })}
                          className="form-checkbox h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-600">
                          Requiere control de stock
                        </span>
                      </label>
                    </div>

                    {formData.requiere_stock && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="stock_actual" className="block text-sm font-medium text-gray-700">
                            Stock Actual
                          </label>
                          <input
                            type="number"
                            id="stock_actual"
                            value={formData.stock_actual}
                            onChange={(e) => setFormData({ ...formData, stock_actual: e.target.value })}
                            className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            min="0"
                          />
                        </div>

                        <div>
                          <label htmlFor="stock_minimo" className="block text-sm font-medium text-gray-700">
                            Stock Mínimo
                          </label>
                          <input
                            type="number"
                            id="stock_minimo"
                            value={formData.stock_minimo}
                            onChange={(e) => setFormData({ ...formData, stock_minimo: e.target.value })}
                            className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            min="0"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-4 py-3 bg-gray-50 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {isSubmitting ? 'Guardando...' : editingProduct ? 'Guardar cambios' : 'Crear producto'}
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <Trash2 className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Eliminar producto
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        ¿Estás seguro de que quieres eliminar este producto? Esta acción no se puede deshacer.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => handleDelete(deleteConfirmId)}
                >
                  Eliminar
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setDeleteConfirmId(null)}
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

export default Products;