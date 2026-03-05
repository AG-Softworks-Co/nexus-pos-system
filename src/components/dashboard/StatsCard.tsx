import React from 'react';
import { TrendingUp } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle: string;
  iconBgColor: string;
  iconTextColor: string;
  cardBgColor?: string;
  borderColor?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  subtitle,
  iconBgColor,
  iconTextColor,
  cardBgColor = "bg-white",
  borderColor = "border-gray-100",
}) => {
  return (
    <div className={`${cardBgColor} p-6 rounded-xl shadow-lg border ${borderColor} transform hover:scale-105 transition-all duration-200`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {value}
          </p>
          <p className="text-xs text-gray-600 mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 ${iconBgColor} ${iconTextColor} rounded-xl shadow-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatsCard;