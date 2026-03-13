import React from 'react';
import { Package } from 'lucide-react';

interface ProductQuantity {
  name: string;
  quantity: number;
  percentage: number;
}

interface ProductQuantityChartProps {
  products: ProductQuantity[];
  title?: string;
}

const ProductQuantityChart: React.FC<ProductQuantityChartProps> = ({ 
  products, 
  title = "Cantidades Vendidas" 
}) => {
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <div className="p-2 bg-gradient-to-br from-primary-400 to-primary-600 text-white rounded-lg shadow-md">
          <Package className="h-5 w-5" />
        </div>
      </div>
      
      <div className="space-y-4">
        {products.map((product) => (
          <div key={product.name} className="space-y-3 p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200">
            <div className="flex justify-between items-center text-sm">
              <span className="font-semibold text-gray-900 pr-2">{product.name}</span>
              <div className="text-right">
                <span className="font-bold text-primary-600">{product.quantity}</span>
                <span className="text-gray-500 text-xs ml-1">und.</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
              <div
                className="bg-gradient-to-r from-primary-500 to-primary-600 h-3 rounded-full transition-all duration-500 shadow-sm relative overflow-hidden"
                style={{ width: `${product.percentage}%` }}
              >
                {/* Efecto de brillo */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{product.percentage.toFixed(1)}%</span>
              <span>del total vendido</span>
            </div>
          </div>
        ))}
        
        {products.length === 0 && (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay datos de cantidad</p>
            <p className="text-xs text-gray-400">en el período seleccionado</p>
          </div>
        )}
      </div>
    </>
  );
};

export default ProductQuantityChart;