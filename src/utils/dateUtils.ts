import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const formatDateForExcel = (date: string) => {
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: es });
};

export const formatDisplayDate = (dateString: string) => {
  return format(new Date(dateString), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es });
};