import React from 'react';
import { ShoppingBag, Package } from 'lucide-react';

interface TopProduct {
  id: string;
  name: string;
  quantity: number;
  amount: number;
}

interface TopProductsProps {
  products: TopProduct[];
  title?: string;
}

const TopProducts: React.FC<TopProductsProps> = ({ 
  products, 
  title = "Productos Top" 
}) => {
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <div className="p-2 bg-gradient-to-br from-primary-400 to-primary-600 text-white rounded-lg shadow-md">
          <ShoppingBag className="h-5 w-5" />
        </div>
      </div>
      
      <div className="space-y-4">
        {products.map((product, index) => (
          <div key={product.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200">
            <div className="flex items-center">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg ${
                index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-600' :
                index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                'bg-gradient-to-br from-gray-300 to-gray-500'
              }`}>
                {index + 1}
              </div>
              <div className="ml-3">
                <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                <p className="text-xs text-gray-500">
                  {product.quantity} unidades • ${(product.amount / product.quantity).toFixed(0)} c/u
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-900">
                ${product.amount > 999 ? `${(product.amount / 1000).toFixed(1)}k` : product.amount.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">{product.quantity} und.</p>
            </div>
          </div>
        ))}
        
        {products.length === 0 && (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay productos vendidos</p>
            <p className="text-xs text-gray-400">en el período seleccionado</p>
          </div>
        )}
      </div>
    </>
  );
};

export default TopProducts;