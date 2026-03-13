import React, { useState } from 'react';
import { X, DollarSign, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

interface CashMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cierreId: string;
}

const CashMovementModal: React.FC<CashMovementModalProps> = ({ isOpen, onClose, onSuccess, cierreId }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('egreso');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.negocioId) return;

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      toast.error('Ingrese un monto válido mayor a 0');
      return;
    }

    if (!descripcion.trim()) {
      toast.error('Ingrese una descripción');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('movimientos_caja')
        .insert({
          cierre_caja_id: cierreId,
          negocio_id: user.negocioId,
          usuario_id: user.id,
          tipo,
          monto: montoNum,
          descripcion: descripcion.trim()
        });

      if (error) throw error;

      toast.success(tipo === 'ingreso' ? 'Ingreso registrado' : 'Egreso registrado');
      onSuccess();
      onClose();
      
      // Reset form
      setMonto('');
      setDescripcion('');
      setTipo('egreso');

    } catch (err: any) {
      console.error('Error saving movement:', err);
      toast.error(err.message || 'Error al guardar el movimiento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Registrar Movimiento de Caja
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Tipo Selector */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setTipo('ingreso')}
                    className={`flex items-center justify-center px-4 py-3 border rounded-md shadow-sm text-sm font-medium ${
                      tipo === 'ingreso'
                        ? 'border-green-500 ring-2 ring-green-200 bg-green-50 text-green-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <ArrowUpCircle className={`mr-2 h-5 w-5 ${tipo === 'ingreso' ? 'text-green-500' : 'text-gray-400'}`} />
                    Ingreso Extra
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipo('egreso')}
                    className={`flex items-center justify-center px-4 py-3 border rounded-md shadow-sm text-sm font-medium ${
                      tipo === 'egreso'
                        ? 'border-red-500 ring-2 ring-red-200 bg-red-50 text-red-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <ArrowDownCircle className={`mr-2 h-5 w-5 ${tipo === 'egreso' ? 'text-red-500' : 'text-gray-400'}`} />
                    Egreso / Gasto
                  </button>
                </div>

                <div>
                  <label htmlFor="monto_movimiento" className="block text-sm font-medium text-gray-700">
                    Monto
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <DollarSign className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      name="monto"
                      id="monto_movimiento"
                      required
                      min="1"
                      step="1"
                      className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-lg border-gray-300 rounded-md py-3"
                      placeholder="0"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700">
                    Descripción / Razón
                  </label>
                  <div className="mt-1 text-sm text-gray-500 mb-2">
                    {tipo === 'ingreso' ? 'Ej: Sencillo adicional, pago de deuda ajena' : 'Ej: Pago insumos, almuerzos, caja menor'}
                  </div>
                  <input
                    type="text"
                    name="descripcion"
                    id="descripcion"
                    required
                    maxLength={200}
                    className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="Describe el concepto del movimiento"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={loading}
                className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${
                  tipo === 'ingreso' 
                    ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                    : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                } disabled:opacity-50`}
              >
                {loading ? 'Guardando...' : `Registrar ${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}`}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CashMovementModal;
