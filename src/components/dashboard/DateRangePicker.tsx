import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (dates: [Date | null, Date | null]) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [tempStartDate, setTempStartDate] = useState<Date | null>(startDate);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(endDate);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const formatDateRange = () => {
    if (isSameDay(startDate, endDate)) {
      return format(startDate, "d 'de' MMMM", { locale: es });
    }
    return `${format(startDate, 'dd/MM', { locale: es })} - ${format(endDate, 'dd/MM/yyyy', { locale: es })}`;
  };

  const handleDateClick = (date: Date) => {
    if (selectingStart) {
      setTempStartDate(date);
      setTempEndDate(date);
      setSelectingStart(false);
    } else {
      if (tempStartDate && date < tempStartDate) {
        setTempStartDate(date);
        setTempEndDate(tempStartDate);
        // Auto-apply when both dates are selected
        onChange([date, tempStartDate]);
        setIsOpen(false);
        setSelectingStart(true);
      } else {
        setTempEndDate(date);
        // Auto-apply when end date is selected
        if (tempStartDate) {
          onChange([tempStartDate, date]);
          setIsOpen(false);
          setSelectingStart(true);
        }
      }
    }
  };

  const handleApply = () => {
    if (tempStartDate && tempEndDate) {
      onChange([tempStartDate, tempEndDate]);
      setIsOpen(false);
      setSelectingStart(true);
    }
  };

  const handleClear = () => {
    const today = new Date();
    setTempStartDate(today);
    setTempEndDate(today);
    onChange([today, today]);
    setIsOpen(false);
    setSelectingStart(true);
  };

  const isDateInRange = (date: Date) => {
    if (!tempStartDate || !tempEndDate) return false;
    return date >= tempStartDate && date <= tempEndDate;
  };

  const isDateSelected = (date: Date) => {
    if (!tempStartDate || !tempEndDate) return false;
    return isSameDay(date, tempStartDate) || isSameDay(date, tempEndDate);
  };

  const getDaysInMonth = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  };

  const getCalendarDays = () => {
    const daysInMonth = getDaysInMonth();
    const firstDay = startOfMonth(currentMonth);
    const startingDayOfWeek = firstDay.getDay();

    // Add empty cells for days before the first day of the month
    const emptyDays = Array(startingDayOfWeek).fill(null);

    return [...emptyDays, ...daysInMonth];
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const currentYear = currentMonth.getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  return (
    <div className="relative ml-auto mr-4" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200 min-w-[260px] justify-between shadow-[0_2px_4px_rgba(0,0,0,0.02)]"
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium">{formatDateRange()}</span>
        </div>
        <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]" onClick={() => setIsOpen(false)} />

          {/* Calendar Modal — centered on all screens */}
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 sm:p-6 w-full max-w-[420px] max-h-[90vh] overflow-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Seleccionar Rango de Fechas</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Month/Year Navigation */}
              <div className="flex items-center justify-between mb-6 bg-gray-50 p-4 rounded-xl">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-2 hover:bg-white rounded-lg transition-colors shadow-sm"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <select
                      value={currentMonth.getMonth()}
                      onChange={(e) => setCurrentMonth(new Date(currentYear, parseInt(e.target.value), 1))}
                      className="appearance-none bg-white px-4 py-2 pr-8 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm min-w-[120px]"
                      style={{ zIndex: 10000 }}
                    >
                      {monthNames.map((month, index) => (
                        <option key={index} value={index}>{month}</option>
                      ))}
                    </select>
                    <ChevronRight className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none rotate-90" />
                  </div>

                  <div className="relative">
                    <select
                      value={currentYear}
                      onChange={(e) => setCurrentMonth(new Date(parseInt(e.target.value), currentMonth.getMonth(), 1))}
                      className="appearance-none bg-white px-4 py-2 pr-8 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm min-w-[80px]"
                      style={{ zIndex: 10000 }}
                    >
                      {years.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                    <ChevronRight className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none rotate-90" />
                  </div>
                </div>

                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-2 hover:bg-white rounded-lg transition-colors shadow-sm"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {/* Status Indicator */}
              <div className="mb-4 text-center">
                <p className="text-sm text-gray-600 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                  {selectingStart ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      Selecciona la fecha de inicio
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      Selecciona la fecha de fin
                    </span>
                  )}
                </p>
              </div>

              {/* Calendar Grid */}
              <div className="mb-6">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-3">
                  {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                    <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2 bg-gray-100 rounded-lg">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-1">
                  {getCalendarDays().map((date, index) => {
                    if (!date) {
                      return <div key={index} className="h-12" />;
                    }

                    const isCurrentMonth = isSameMonth(date, currentMonth);
                    const isSelected = isDateSelected(date);
                    const isInRange = isDateInRange(date);
                    const isTodayDate = isToday(date);

                    return (
                      <button
                        key={date.toISOString()}
                        onClick={() => handleDateClick(date)}
                        disabled={!isCurrentMonth}
                        className={`
                        h-12 w-12 rounded-xl text-sm font-medium transition-all duration-200 relative flex items-center justify-center
                        ${!isCurrentMonth ? 'text-gray-300 cursor-not-allowed' : ''}
                        ${isSelected ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg scale-110 z-10' : ''}
                        ${isInRange && !isSelected ? 'bg-gradient-to-br from-primary-100 to-primary-200 text-primary-700 shadow-md' : ''}
                        ${isTodayDate && !isSelected ? 'bg-gradient-to-br from-orange-100 to-orange-200 text-orange-700 font-bold shadow-md' : ''}
                        ${isCurrentMonth && !isSelected && !isInRange && !isTodayDate ? 'hover:bg-gray-100 text-gray-700 hover:shadow-md hover:scale-105' : ''}
                      `}
                      >
                        {format(date, 'd')}
                        {isTodayDate && !isSelected && (
                          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-orange-500 rounded-full shadow-sm" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Range Display */}
              {tempStartDate && tempEndDate && (
                <div className="mb-4 p-4 bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl border border-primary-200">
                  <div className="text-center">
                    <p className="text-sm font-medium text-primary-800">Rango Seleccionado</p>
                    <p className="text-lg font-bold text-primary-900 mt-1">
                      {isSameDay(tempStartDate, tempEndDate)
                        ? format(tempStartDate, "d 'de' MMMM 'de' yyyy", { locale: es })
                        : `${format(tempStartDate, 'dd/MM/yyyy')} - ${format(tempEndDate, 'dd/MM/yyyy')}`
                      }
                    </p>
                    <p className="text-xs text-primary-600 mt-1">
                      {isSameDay(tempStartDate, tempEndDate)
                        ? 'Análisis de un día'
                        : `${Math.ceil((tempEndDate.getTime() - tempStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} días seleccionados`
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <button
                  onClick={handleClear}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200"
                >
                  Limpiar
                </button>

                <div className="flex gap-3">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleApply}
                    disabled={!tempStartDate || !tempEndDate}
                    className="px-6 py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white text-sm font-medium rounded-lg hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DateRangePicker;