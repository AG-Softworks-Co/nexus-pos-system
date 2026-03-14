import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, AlertCircle, Layers, Tag, Package, ChevronRight, X, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Database } from '../types/database';

type Category = Database['public']['Tables']['categorias']['Row'];

const Categories: React.FC = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: ''
  });
  
  useEffect(() => {
    if (user?.negocioId) {
      fetchCategories();
    }
  }, [user]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('negocio_id', user?.negocioId)
        .order('nombre');

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      nombre: category.nombre,
      descripcion: category.descripcion || ''
    });
    setShowModal(true);
  };
  
  const handleAddNew = () => {
    setEditingCategory(null);
    setFormData({
      nombre: '',
      descripcion: ''
    });
    setShowModal(true);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const categoryData = {
        nombre: formData.nombre,
        descripcion: formData.descripcion || null,
        negocio_id: user?.negocioId
      };

      if (editingCategory) {
        const { error } = await supabase
          .from('categorias')
          .update(categoryData)
          .eq('id', editingCategory.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('categorias')
          .insert([categoryData]);

        if (error) throw error;
      }

      await fetchCategories();
      setShowModal(false);
      setFormData({ nombre: '', descripcion: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('categorias')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchCategories();
      setDeleteConfirmId(null);
    } catch (err: any) {
      console.error('Error deleting category:', err);
    }
  };

  const filteredCategories = categories.filter(category =>
    category.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.descripcion?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <div className="h-10 w-10 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin"></div>
      <p className="mt-4 text-slate-500 font-bold font-outfit uppercase tracking-tighter">Organizando inventario...</p>
    </div>
  );
  
  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 lg:p-6 pb-20 lg:pb-8 animate-in fade-in duration-700">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight font-outfit">Maestro de Categorías</h1>
          <p className="text-slate-500 font-medium">Clasificación estratégica para una gestión de inventario eficiente.</p>
        </div>
        
        <button
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-200 hover:bg-primary-700 transition-all hover:scale-[1.02] active:scale-95"
          onClick={handleAddNew}
        >
          <Plus className="h-5 w-5" />
          Nueva Categoría
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 relative group overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
             <Layers className="h-20 w-20 text-indigo-600" />
           </div>
           <Tag className="h-8 w-8 text-indigo-600 mb-4 bg-indigo-50 p-1.5 rounded-xl" />
           <p className="text-3xl font-black text-slate-900 leading-none">{categories.length}</p>
           <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2">Grupos Definidos</p>
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 relative group overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
             <Package className="h-20 w-20 text-emerald-600" />
           </div>
           <Package className="h-8 w-8 text-emerald-600 mb-4 bg-emerald-50 p-1.5 rounded-xl" />
           <p className="text-3xl font-black text-slate-900 leading-none">Activas</p>
           <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2">Estado Operativo</p>
        </div>
      </div>
      
      {/* Search Bar */}
      <div className="bg-white p-2 rounded-3xl shadow-sm border border-slate-100 flex items-center relative gap-2">
        <Search className="absolute left-6 h-5 w-5 text-slate-400" />
        <input
          type="text"
          className="w-full pl-12 pr-4 py-4 bg-slate-50/50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 text-sm font-bold text-slate-700 placeholder:text-slate-400 transition-all"
          placeholder="Busca categorías por nombre o descripción técnica..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      {/* View Logic */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredCategories.map((category) => (
          <div key={category.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_8px_25px_rgb(0,0,0,0.02)] hover:shadow-[0_15px_35px_rgb(0,0,0,0.06)] transition-all p-8 flex flex-col group relative">
            <div className="flex justify-between items-start mb-6">
               <div className="h-14 w-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200">
                  <Tag className="h-7 w-7" />
               </div>
               
               <div className="flex gap-1">
                 <button 
                    className="p-3 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                    onClick={() => handleEditClick(category)}
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  {deleteConfirmId === category.id ? (
                    <div className="flex items-center bg-rose-50 rounded-xl px-4 animate-in fade-in slide-in-from-right-2">
                       <span className="text-[10px] font-black uppercase text-rose-600 mr-3">¿Seguro?</span>
                       <button onClick={() => handleDelete(category.id)} className="text-xs font-black text-rose-600 hover:underline px-2 py-1">Sí</button>
                       <button onClick={() => setDeleteConfirmId(null)} className="text-xs font-black text-slate-400 hover:underline px-2 py-1">No</button>
                    </div>
                  ) : (
                    <button 
                      className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      onClick={() => setDeleteConfirmId(category.id)}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
               </div>
            </div>

            <div className="flex-1 space-y-2">
              <h3 className="text-xl font-black text-slate-900 group-hover:text-primary-600 transition-colors">{category.nombre}</h3>
              <p className="text-sm font-medium text-slate-500 leading-relaxed line-clamp-2">
                {category.descripcion || 'Sin descripción técnica disponible para esta categoría.'}
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
               <span>ID: {category.id.slice(0,8)}</span>
               <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {new Date(category.creado_en).toLocaleDateString()}</span>
            </div>

            <div className="absolute top-2 right-2 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <ChevronRight className="h-4 w-4 text-primary-500" />
            </div>
          </div>
        ))}
        
        {filteredCategories.length === 0 && (
          <div className="col-span-full py-24 flex flex-col items-center text-center opacity-50">
            <Layers className="h-16 w-16 text-slate-200 mb-4" />
            <h3 className="text-lg font-black text-slate-900">Sin Coincidencias</h3>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Refina tus parámetros de búsqueda</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom sm:zoom-in duration-300">
            <form onSubmit={handleSubmit} className="p-10 space-y-8">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                    {editingCategory ? 'Ajustar Categoría' : 'Nueva Clasificación'}
                  </h3>
                  <p className="text-slate-500 font-medium mt-1">Define las propiedades de este grupo comercial.</p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-3 hover:bg-slate-50 rounded-full transition-colors">
                  <X className="h-6 w-6 text-slate-300" />
                </button>
              </div>

              {error && (
                <div className="p-4 bg-rose-50 border-l-4 border-rose-500 flex gap-4 rounded-xl">
                  <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
                  <p className="text-xs font-bold text-rose-800 uppercase tracking-tight">{error}</p>
                </div>
              )}
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nombre Técnico <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all shadow-sm"
                    value={formData.nombre}
                    onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                    required
                    placeholder="Ej. Hidráulica, Electrónica, etc."
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Descripción de Alcance</label>
                  <textarea
                    rows={4}
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all shadow-sm"
                    value={formData.descripcion}
                    onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                    placeholder="Describe los productos o servicios que abarca este grupo..."
                  ></textarea>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-5 bg-slate-900 text-white rounded-[2rem] text-sm font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isSubmitting ? 'Sincronizando...' : editingCategory ? 'Guardar Cambios' : 'Crear Categoría'}
                </button>
                <button
                  type="button"
                  className="py-5 px-8 bg-slate-50 text-slate-400 rounded-[2rem] text-sm font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                  onClick={() => setShowModal(false)}
                >
                  Cerrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;