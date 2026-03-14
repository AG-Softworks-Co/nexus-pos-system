import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Percent, DollarSign, X, AlertTriangle, Calculator, CheckCircle, Tag } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  originalPrice?: number;
  discountApplied?: number;
}

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onApplyDiscount: (
    discountType: 'percentage' | 'amount',
    discountValue: number,
    reason: string,
    applyTo: 'total' | string // 'total' o productId
  ) => void;
  subtotal: number;
}

const DiscountModal: React.FC<DiscountModalProps> = ({
  isOpen,
  onClose,
  cart,
  onApplyDiscount,
  subtotal
}) => {
  const { user } = useAuth();
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>('percentage');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [reason, setReason] = useState('');
  const [applyTo, setApplyTo] = useState<'total' | string>('total');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Verificar que el usuario sea administrador
  if (!user || !['propietario', 'administrador'].includes(user.rol)) {
    return null;
  }

  const calculateDiscountPreview = () => {
    const value = parseFloat(discountValue) || 0;
    
    if (applyTo === 'total') {
      if (discountType === 'percentage') {
        return Math.min((subtotal * value) / 100, subtotal);
      } else {
        return Math.min(value, subtotal);
      }
    } else {
      // Descuento a producto específico
      const product = cart.find(item => item.productId === applyTo);
      if (!product) return 0;
      
      const productTotal = product.price * product.quantity;
      if (discountType === 'percentage') {
        return Math.min((productTotal * value) / 100, productTotal);
      } else {
        return Math.min(value, productTotal);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const value = parseFloat(discountValue);
    
    if (isNaN(value) || value <= 0) {
      setError('El valor del descuento debe ser mayor a 0');
      return;
    }

    if (discountType === 'percentage' && value > 100) {
      setError('El porcentaje no puede ser mayor a 100%');
      return;
    }

    if (!reason.trim()) {
      setError('Debes proporcionar una razón para el descuento');
      return;
    }

    const maxDiscount = applyTo === 'total' ? subtotal : 
      (cart.find(item => item.productId === applyTo)?.price || 0) * 
      (cart.find(item => item.productId === applyTo)?.quantity || 0);

    if (discountType === 'amount' && value > maxDiscount) {
      setError(`El descuento no puede ser mayor a $${maxDiscount.toLocaleString()}`);
      return;
    }

    onApplyDiscount(discountType, value, reason.trim(), applyTo);
    onClose();
    
    // Reset form
    setDiscountValue('');
    setReason('');
    setApplyTo('total');
    setDiscountType('percentage');
  };

  const discountPreview = calculateDiscountPreview();
  const newTotal = applyTo === 'total' ? subtotal - discountPreview : subtotal;

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-8 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 shadow-sm">
              <Percent className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 font-outfit uppercase tracking-tight">Aplicar Descuento</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Autorización Requerida (Admin)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-3 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-2xl transition-all active:scale-95"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
          {error && (
            <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl animate-in slide-in-from-top-2">
              <div className="flex items-center gap-4 text-rose-600">
                <AlertTriangle className="h-6 w-6 flex-shrink-0" />
                <p className="text-sm font-black uppercase tracking-tight">{error}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              {/* Aplicar a */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Destino del Descuento</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400">
                    <Tag className="h-5 w-5" />
                  </div>
                  <select
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-primary-500 rounded-2xl shadow-inner text-sm font-bold uppercase tracking-widest transition-all appearance-none"
                    value={applyTo}
                    onChange={(e) => setApplyTo(e.target.value)}
                  >
                    <option value="total">TOTAL DE LA VENTA</option>
                    {cart.map(item => (
                      <option key={item.productId} value={item.productId}>
                        {item.name} (${item.price.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tipo de descuento */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Metodología</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2
                      ${discountType === 'percentage' 
                        ? 'bg-primary-50/50 border-primary-500 text-primary-600 ring-4 ring-primary-500/10' 
                        : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                    onClick={() => setDiscountType('percentage')}
                  >
                    <Percent className="h-6 w-6" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Porcentaje</span>
                  </button>
                  <button
                    type="button"
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2
                      ${discountType === 'amount' 
                        ? 'bg-primary-50/50 border-primary-500 text-primary-600 ring-4 ring-primary-500/10' 
                        : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                    onClick={() => setDiscountType('amount')}
                  >
                    <DollarSign className="h-6 w-6" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Monto Fijo</span>
                  </button>
                </div>
              </div>

              {/* Valor del descuento */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                  {discountType === 'percentage' ? 'Porcentaje (%)' : 'Monto ($)'}
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-900 font-black">
                    {discountType === 'percentage' ? '%' : '$'}
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full pl-10 pr-6 py-4 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-primary-500 rounded-2xl shadow-inner text-xl font-black font-outfit tracking-tighter transition-all"
                    value={discountValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) setDiscountValue(val);
                    }}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Razón del descuento */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Justificación Fiscal</label>
                <textarea
                  rows={4}
                  className="w-full px-6 py-4 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-primary-500 rounded-2xl shadow-inner text-[11px] font-bold uppercase tracking-widest transition-all resize-none h-40"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="MOTIVO DEL DESCUENTO (EJ: CLIENTE FRECUENTE, PROMOCIÓN...)"
                  required
                />
              </div>

              {/* Visual Preview */}
              {discountValue && parseFloat(discountValue) > 0 && (
                <div className="bg-slate-900 p-6 rounded-[2rem] text-white space-y-4 shadow-xl shadow-slate-200 animate-in zoom-in-95">
                  <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                    <Calculator className="h-5 w-5 text-primary-400" />
                    <h4 className="text-xs font-black uppercase tracking-widest">Resumen de Ajuste</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span>Base:</span>
                      <span className="text-white">${(applyTo === 'total' ? subtotal : 
                        ((cart.find(item => item.productId === applyTo)?.price || 0) * 
                         (cart.find(item => item.productId === applyTo)?.quantity || 0))
                      ).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-rose-400">
                      <span>Ahorro:</span>
                      <span>-${discountPreview.toLocaleString()}</span>
                    </div>
                    <div className="h-px bg-white/10 my-2" />
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Neto:</span>
                      <span className="text-2xl font-black font-outfit text-primary-400 tracking-tighter">
                        ${(applyTo === 'total' ? newTotal : 
                          ((cart.find(item => item.productId === applyTo)?.price || 0) * 
                           (cart.find(item => item.productId === applyTo)?.quantity || 0)) - discountPreview
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-8 border-t border-slate-50 bg-white grid grid-cols-2 gap-4 sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            className="py-4 rounded-2xl text-slate-400 font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all border border-slate-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="py-4 rounded-2xl bg-gradient-to-r from-primary-600 to-indigo-600 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary-200 transition-all active:scale-95 flex items-center justify-center gap-2 group"
          >
            <CheckCircle className="h-4 w-4" />
            Aplicar Descuento
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DiscountModal;