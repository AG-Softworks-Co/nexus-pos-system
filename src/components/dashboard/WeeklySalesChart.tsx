import React from 'react';

interface WeeklySalesChartProps {
  salesData: {
    day: string;
    amount: number;
  }[];
}

const WeeklySalesChart: React.FC<WeeklySalesChartProps> = ({
  salesData
}) => {
  const maxSalesValue = Math.max(...salesData.map(day => day.amount));

  return (
    <>
      <div className="h-80 flex items-end justify-between gap-1 px-2">
        {salesData.map((day) => (
          <div key={day.day} className="flex flex-col items-center flex-1 group">
            <div
              className="w-full bg-gradient-to-t from-primary-600 to-primary-400 hover:from-primary-700 hover:to-primary-500 rounded-t-lg transition-all duration-300 shadow-lg group-hover:shadow-xl relative overflow-hidden"
              style={{
                height: maxSalesValue > 0 ? `${(day.amount / maxSalesValue) * 280}px` : '4px',
                minHeight: '4px'
              }}
            >
              {/* Efecto de brillo en hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

              {/* Tooltip en hover */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10 shadow-xl">
                <div className="font-semibold">{day.day}</div>
                <div>${day.amount.toLocaleString()}</div>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>

            <div className="mt-3 text-center">
              <p className="text-xs font-semibold text-gray-700">{day.day}</p>
              <p className="text-xs text-gray-500 mt-1">
                ${day.amount > 999 ? `${(day.amount / 1000).toFixed(1)}k` : day.amount.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Summary stats below chart */}
      <div className="mt-6 grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-900">
            ${Math.max(...salesData.map(d => d.amount)).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">Pico máximo</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-900">
            ${Math.round(salesData.reduce((sum, d) => sum + d.amount, 0) / salesData.length).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">Promedio</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-900">
            ${salesData.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
      </div>
    </>
  );
};

export default WeeklySalesChart;