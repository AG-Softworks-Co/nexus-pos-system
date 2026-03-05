import React, { useState } from 'react';
import { Percent, DollarSign, X, AlertTriangle, Calculator, Save } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                  <Percent className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                  <h3 className="text-lg font-medium text-gray-900">
                    Aplicar Descuento
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Solo administradores pueden aplicar descuentos
                  </p>
                </div>
              </div>
              
              {error && (
                <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-4 space-y-4">
                {/* Aplicar a */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Aplicar descuento a:
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    value={applyTo}
                    onChange={(e) => setApplyTo(e.target.value)}
                  >
                    <option value="total">Total de la venta</option>
                    {cart.map(item => (
                      <option key={item.productId} value={item.productId}>
                        {item.name} (${item.price.toLocaleString()} x {item.quantity})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tipo de descuento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de descuento:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      className={`flex items-center justify-center px-4 py-3 border rounded-md text-sm font-medium transition-colors ${
                        discountType === 'percentage'
                          ? 'bg-primary-50 border-primary-500 text-primary-700'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => setDiscountType('percentage')}
                    >
                      <Percent className="h-4 w-4 mr-2" />
                      Porcentaje
                    </button>
                    <button
                      type="button"
                      className={`flex items-center justify-center px-4 py-3 border rounded-md text-sm font-medium transition-colors ${
                        discountType === 'amount'
                          ? 'bg-primary-50 border-primary-500 text-primary-700'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => setDiscountType('amount')}
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Monto Fijo
                    </button>
                  </div>
                </div>

                {/* Valor del descuento */}
                <div>
                  <label htmlFor="discountValue" className="block text-sm font-medium text-gray-700 mb-1">
                    {discountType === 'percentage' ? 'Porcentaje de descuento' : 'Monto del descuento'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      {discountType === 'percentage' ? (
                        <Percent className="h-5 w-5 text-gray-400" />
                      ) : (
                        <span className="text-gray-500 sm:text-sm">$</span>
                      )}
                    </div>
                    <input
                      type="number"
                      id="discountValue"
                      className="pl-10 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={discountType === 'percentage' ? '10' : '5000'}
                      min="0"
                      max={discountType === 'percentage' ? '100' : undefined}
                      step={discountType === 'percentage' ? '0.1' : '100'}
                      required
                    />
                  </div>
                </div>

                {/* Razón del descuento */}
                <div>
                  <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                    Razón del descuento <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="reason"
                    rows={3}
                    className="focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ej: Cliente frecuente, promoción especial, producto dañado..."
                    required
                  />
                </div>

                {/* Preview del descuento */}
                {discountValue && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center mb-2">
                      <Calculator className="h-5 w-5 text-blue-600 mr-2" />
                      <h4 className="text-sm font-medium text-blue-900">Vista Previa del Descuento</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-blue-700">
                          {applyTo === 'total' ? 'Subtotal:' : 'Precio del producto:'}
                        </span>
                        <span className="font-medium text-blue-900">
                          ${(applyTo === 'total' ? subtotal : 
                            ((cart.find(item => item.productId === applyTo)?.price || 0) * 
                             (cart.find(item => item.productId === applyTo)?.quantity || 0))
                          ).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700">Descuento:</span>
                        <span className="font-medium text-red-600">
                          -${discountPreview.toLocaleString()}
                          {discountType === 'percentage' && ` (${discountValue}%)`}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-blue-200">
                        <span className="text-blue-700 font-medium">
                          {applyTo === 'total' ? 'Nuevo total:' : 'Nuevo precio:'}
                        </span>
                        <span className="font-bold text-green-600">
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
            
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
              >
                <Save className="h-4 w-4 mr-2" />
                Aplicar Descuento
              </button>
              <button
                type="button"
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={onClose}
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DiscountModal;