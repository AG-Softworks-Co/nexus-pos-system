// src/pages/NewSale.tsx
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Trash2, CreditCard, DollarSign, X, AlertCircle, Truck, MapPin, Phone, User, ShoppingCart, Minus, AlertTriangle, CheckCircle, Landmark, Percent, ShoppingBag, ArrowRight, Save, Calculator, Lock, Smartphone, Zap, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import DiscountModal from '../components/sales/DiscountModal';
import type { Database } from '../types/database';

// --- DEFINICIÓN DE TIPOS ---
type ProductDB = Database['public']['Tables']['productos']['Row'];
type Category = Database['public']['Tables']['categorias']['Row'];
type Client = Database['public']['Tables']['clientes']['Row'];
type DeliveryAddress = Database['public']['Tables']['direcciones_entrega']['Row'];

type CartItem = {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  stock_actual?: number | null;
  requiere_stock?: boolean | null;
  stock_minimo?: number | null;
  originalPrice?: number;
  discountApplied?: number;
};

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning';
}

// --- COMPONENTE AUXILIAR: MODAL DE ALERTA ---
const AlertModal: React.FC<AlertModalProps> = ({ isOpen, onClose, title, message, type }) => {
  if (!isOpen) return null;

  const Icon = type === 'success' ? CheckCircle : 
               type === 'warning' ? AlertTriangle : 
               AlertCircle;

  const colors = {
    success: 'from-emerald-500 to-teal-600',
    warning: 'from-amber-400 to-orange-500',
    error: 'from-rose-500 to-red-600'
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
        <div className={`h-2 text-center items-center justify-center bg-gradient-to-r ${colors[type]}`} />
        <div className="p-8 pt-10 text-center">
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-[2rem] bg-slate-50 mb-6 drop-shadow-sm">
            <Icon className={`h-10 w-10 ${type === 'success' ? 'text-emerald-500' : type === 'warning' ? 'text-amber-500' : 'text-rose-500'}`} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 font-outfit uppercase tracking-tight mb-2">{title}</h3>
          <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">{message}</p>
          
          <button
            onClick={onClose}
            className={`w-full py-4 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-slate-200 transition-all active:scale-95 bg-gradient-to-r ${colors[type]}`}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// --- COMPONENTE PRINCIPAL ---
const NewSale: React.FC = () => {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'bancolombia' | 'nequi' | 'daviplata' | 'tarjeta' | 'credito' | null>(null);
  const [notes, setNotes] = useState('');
  const [products, setProducts] = useState<ProductDB[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning';
  }>({
    title: '',
    message: '',
    type: 'success'
  });
  
  // Estados para domicilio
  const [isDelivery, setIsDelivery] = useState(false);
  const [deliveryCost, setDeliveryCost] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [addressReferences, setAddressReferences] = useState('');
  const [savedClients, setSavedClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientAddresses, setClientAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<DeliveryAddress | null>(null);
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const clientSearchRef = useRef<HTMLDivElement>(null);
  const [openedPaymentFromMobileCart, setOpenedPaymentFromMobileCart] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);
  
  // Register state
  const [hasOpenRegister, setHasOpenRegister] = useState<boolean | null>(null);

  // Discount states
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<{
    type: 'percentage' | 'amount';
    value: number;
    reason: string;
    applyTo: 'total' | string;
    discountAmount: number;
  } | null>(null);
  
  // Multi-step payment state
  const [paymentStep, setPaymentStep] = useState(1);

  useEffect(() => {
    if (user?.negocioId) {
      checkOpenRegister();
      fetchProducts();
      fetchCategories();
      fetchClients();
    }
  }, [user]);

  const checkOpenRegister = async () => {
    if (!user?.negocioId) return;
    try {
      const { data, error } = await supabase
        .from('cierres_caja')
        .select('id')
        .eq('negocio_id', user.negocioId)
        .eq('estado', 'pendiente')
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setHasOpenRegister(!!data);
    } catch (err) {
      console.error('Error checking register status:', err);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clientSearchRef.current && !clientSearchRef.current.contains(event.target as Node)) {
        setShowClientSearch(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [clientSearchRef]);

  const showAlertModal = (title: string, message: string, type: 'success' | 'error' | 'warning') => {
    setAlertConfig({ title, message, type });
    setShowAlert(true);
  };

  const fetchProducts = async () => {
    if (!user?.negocioId) return;
    try {
      setLoading(true);
      const { data, error: dbError } = await supabase
        .from('productos')
        .select('*')
        .eq('negocio_id', user.negocioId);

      if (dbError) throw dbError;
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
      showAlertModal('Error', 'Error al cargar productos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!user?.negocioId) return;
    try {
      const { data, error: dbError } = await supabase
        .from('categorias')
        .select('*')
        .eq('negocio_id', user.negocioId);

      if (dbError) throw dbError;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      showAlertModal('Error', 'Error al cargar categorías.', 'error');
    }
  };

  const fetchClients = async () => {
    if (!user?.negocioId) return;
    try {
      const { data, error: dbError } = await supabase
        .from('clientes')
        .select('*')
        .eq('negocio_id', user.negocioId);

      if (dbError) throw dbError;
      setSavedClients(data || []);
    } catch (err) {
      console.error('Error fetching clients:', err);
      showAlertModal('Error', 'Error al cargar clientes.', 'error');
    }
  };

  const fetchClientAddresses = async (clientId: string) => {
    try {
      const { data, error: dbError } = await supabase
        .from('direcciones_entrega')
        .select('*')
        .eq('cliente_id', clientId);

      if (dbError) throw dbError;
      setClientAddresses(data || []);
      setSelectedAddress(null); 
    } catch (err) {
      console.error('Error fetching addresses:', err);
      showAlertModal('Error', 'Error al cargar direcciones del cliente.', 'error');
    }
  };

  const handleClientSelect = async (client: Client) => {
    setSelectedClient(client);
    setClientName(client.nombre_completo);
    setClientPhone(client.telefono || '');
    setClientEmail(client.correo || '');
    setClientAddress(client.direccion || '');
    if (isDelivery) {
        await fetchClientAddresses(client.id);
    }
    setShowClientSearch(false);
    setClientSearchQuery(client.nombre_completo);
  };

  const handleAddressSelect = (address: DeliveryAddress) => {
    setSelectedAddress(address);
    setDeliveryAddress(address.direccion);
    setAddressReferences(address.referencias || '');
  };

  const filteredClients = savedClients.filter(client =>
    client.nombre_completo.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
    (client.telefono && client.telefono.includes(clientSearchQuery)) ||
    (client.correo && client.correo.toLowerCase().includes(clientSearchQuery.toLowerCase()))
  );
  
  const filteredProducts = products.filter(product => {
    const matchesCategory = !selectedCategory || product.categoria_id === selectedCategory;
    const matchesSearch = !searchQuery || 
      product.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.descripcion && product.descripcion.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });
  
  const addToCart = (product: ProductDB) => {
    if (product.requiere_stock && (product.stock_actual == null || product.stock_actual <= 0)) {
      showAlertModal('Producto Agotado', 'Este producto está fuera de stock.', 'error');
      return;
    }

    setCart(currentCart => {
      const existingItem = currentCart.find(item => item.productId === product.id);
      
      if (existingItem) {
        if (product.requiere_stock && existingItem.quantity >= (product.stock_actual || 0)) {
          showAlertModal('Stock Insuficiente', 'No hay suficiente stock disponible para añadir más de este producto.', 'error');
          return currentCart;
        }

        if (product.requiere_stock && product.stock_minimo != null && (product.stock_actual || 0) - (existingItem.quantity + 1) <= product.stock_minimo) {
          showAlertModal('Stock Bajo', `Advertencia: Este producto quedará con stock bajo (${(product.stock_actual || 0) - (existingItem.quantity + 1)} unidades).`, 'warning');
        }
        
        return currentCart.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      
      if (product.requiere_stock && product.stock_minimo != null && (product.stock_actual || 0) - 1 <= product.stock_minimo) {
        showAlertModal('Stock Bajo', `Advertencia: Este producto quedará con stock bajo (${(product.stock_actual || 0) - 1} unidades).`, 'warning');
      }

      return [...currentCart, {
        id: Date.now().toString(),
        productId: product.id,
        name: product.nombre,
        price: product.precio_venta,
        originalPrice: product.precio_venta,
        quantity: 1,
        stock_actual: product.stock_actual,
        requiere_stock: product.requiere_stock,
        stock_minimo: product.stock_minimo
      }];
    });
  };
  
  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId));
  };
  
  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setCart(cart.map(item => {
      if (item.id === itemId) {
        if (item.requiere_stock && item.stock_actual !== undefined && item.stock_actual !== null && newQuantity > item.stock_actual) {
          showAlertModal('Stock Insuficiente', 'No hay suficiente stock disponible para esta cantidad.', 'error');
          return item;
        }

        if (item.requiere_stock && item.stock_minimo !== undefined && item.stock_minimo !== null && item.stock_actual !== undefined && item.stock_actual !== null && (item.stock_actual - newQuantity) <= item.stock_minimo) {
          showAlertModal('Stock Bajo', `Advertencia: Este producto quedará con stock bajo (${(item.stock_actual || 0) - newQuantity} unidades).`, 'warning');
        }

        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };
  
  const calculateSubtotal = () => {
    let subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    
    // Apply discount if exists and applies to total
    if (appliedDiscount && appliedDiscount.applyTo === 'total') {
      subtotal -= appliedDiscount.discountAmount;
    }
    
    return Math.max(0, subtotal);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const deliveryAmount = isDelivery ? (Number(deliveryCost) || 0) : 0;
    return subtotal + deliveryAmount;
  };

  const totalItemsInCart = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleProceedToPayment = () => {
    setOpenedPaymentFromMobileCart(showMobileCart);
    setShowPaymentModal(true);
    setShowMobileCart(false);
  };

  const clearTransactionalState = () => {
    setSelectedClient(null);
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setClientAddress('');
    setClientSearchQuery('');
    setShowClientForm(false);
    setIsDelivery(false);
    setDeliveryAddress('');
    setAddressReferences('');
    setSelectedAddress(null);
    setDeliveryCost('');
    setPaymentMethod(null);
    setNotes('');
    setPaymentStep(1);
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setShowDiscountModal(false);
    clearTransactionalState();
    if (openedPaymentFromMobileCart) {
      setShowMobileCart(true);
    }
    setOpenedPaymentFromMobileCart(false);
  };
  
  const handleApplyDiscount = (
    discountType: 'percentage' | 'amount',
    discountValue: number,
    reason: string,
    applyTo: 'total' | string
  ) => {
    let discountAmount = 0;
    
    if (applyTo === 'total') {
      const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
      if (discountType === 'percentage') {
        discountAmount = (subtotal * discountValue) / 100;
      } else {
        discountAmount = discountValue;
      }
      discountAmount = Math.min(discountAmount, subtotal);
    } else {
      // Product-specific discount
      const product = cart.find(item => item.productId === applyTo);
      if (product) {
        const productTotal = product.price * product.quantity;
        if (discountType === 'percentage') {
          discountAmount = (productTotal * discountValue) / 100;
        } else {
          discountAmount = discountValue;
        }
        discountAmount = Math.min(discountAmount, productTotal);
        
        // Apply discount to specific product
        setCart(prevCart => 
          prevCart.map(item => {
            if (item.productId === applyTo) {
              const newPrice = item.originalPrice! - (discountAmount / item.quantity);
              return {
                ...item,
                price: Math.max(0, newPrice),
                discountApplied: discountAmount
              };
            }
            return item;
          })
        );
      }
    }
    
    setAppliedDiscount({
      type: discountType,
      value: discountValue,
      reason,
      applyTo,
      discountAmount
    });
    
    setShowDiscountModal(false);
  };
  
  const handleRemoveDiscount = () => {
    if (appliedDiscount?.applyTo === 'total') {
      // Remove total discount
      setAppliedDiscount(null);
    } else {
      // Remove product-specific discount
      const discountToApply = appliedDiscount; // Capturar para el map
      setCart(prevCart => 
        prevCart.map(item => {
          if (item.productId === discountToApply?.applyTo) {
            return {
              ...item,
              price: item.originalPrice!,
              discountApplied: undefined
            };
          }
          return item;
        })
      );
      setAppliedDiscount(null);
    }
  };
  
  const handleCompleteSale = async () => {
    const numericDeliveryCost = Number(deliveryCost) || 0;
    const finalTotal = calculateTotal();
    
    if (!user?.negocioId || cart.length === 0) {
      showAlertModal('Error', 'El carrito está vacío o no hay información del negocio.', 'error');
      return;
    }

    if (!hasOpenRegister) {
      showAlertModal('Caja Cerrada', 'No puedes registrar ventas porque la caja está cerrada.', 'error');
      return;
    }
    
    if (finalTotal <= 0) {
      showAlertModal('Error', 'El total de la venta no puede ser $0 o negativo.', 'error');
      return;
    }
    
    if (!paymentMethod) {
      showAlertModal('Método de Pago', 'Por favor, selecciona un método de pago.', 'warning');
      return;
    }
    
    if (paymentMethod === 'credito') {
      if (!selectedClient && clientName.trim().length < 3) {
        showAlertModal('Cliente Requerido', 'Para ventas a crédito, debes ingresar un nombre de cliente válido (mínimo 3 caracteres).', 'warning');
        return;
      }
      if (!selectedClient && clientPhone.trim().length < 7) {
        showAlertModal('Contacto Requerido', 'Para cobrar después, necesitamos un número de contacto válido (mínimo 7 dígitos).', 'warning');
        return;
      }
    }
    
    if (isDelivery) {
      if (clientName.trim().length < 3) {
        showAlertModal('Campos incompletos', 'Para domicilio, se requiere el nombre del destinatario (mínimo 3 caracteres).', 'warning');
        return;
      }
      if (!deliveryAddress.trim() || deliveryAddress.trim().length < 5) {
        showAlertModal('Dirección Requerida', 'Por favor ingresa una dirección de entrega válida.', 'warning');
        return;
      }
      if (numericDeliveryCost < 0) {
        showAlertModal('Error de Costo', 'El costo de envío no puede ser negativo.', 'warning');
        return;
      }
    }
    
    setIsSubmitting(true);

    try {
      let clientIdToUse = selectedClient?.id;
      let addressIdToUse = selectedAddress?.id;

      if ((isDelivery || paymentMethod === 'credito') && clientName.trim() && !selectedClient) {
        const { data: existingClientByName, error: findClientError } = await supabase
          .from('clientes')
          .select('id')
          .eq('nombre_completo', clientName.trim())
          .eq('negocio_id', user.negocioId)
          .maybeSingle();

        if (findClientError && findClientError.code !== 'PGRST116') {
            throw findClientError;
        }

        if (existingClientByName) {
          clientIdToUse = existingClientByName.id;
        } else {
          const { data: newClient, error: clientError } = await supabase
            .from('clientes')
            .insert({
              nombre_completo: clientName.trim(),
              telefono: clientPhone.trim() || null,
              correo: clientEmail.trim() || null,
              direccion: clientAddress.trim() || null,
              negocio_id: user.negocioId
            })
            .select()
            .single();

          if (clientError) throw clientError;
          clientIdToUse = newClient.id;
        }
      }
      
      if (isDelivery && clientIdToUse && deliveryAddress.trim() && !selectedAddress) {
        const { data: newAddress, error: addressError } = await supabase
          .from('direcciones_entrega')
          .insert({
            cliente_id: clientIdToUse,
            direccion: deliveryAddress.trim(),
            referencias: addressReferences.trim() || null
          })
          .select()
          .single();

        if (addressError) throw addressError;
        addressIdToUse = newAddress.id;
      }
      
      // Prepare sale data with discount information
      interface SaleData {
        usuario_id: string;
        negocio_id: string;
        total: number;
        metodo_pago: string | null;
        notas: string | null;
        es_domicilio: boolean;
        cliente_id: string | null;
        direccion_entrega_id: string | null;
        costo_domicilio: number;
        estado: string;
        estado_pago: string;
        descuento_total?: number;
        descuento_porcentaje_total?: number;
        subtotal_antes_descuento?: number;
        usuario_descuento_id?: string;
        razon_descuento?: string;
        fecha_descuento?: string;
        saldo_pendiente?: number;
      }

      const saleData: SaleData = {
        usuario_id: user.id || '',
        negocio_id: user.negocioId || '',
        total: finalTotal,
        metodo_pago: paymentMethod,
        notas: notes.trim() || null,
        es_domicilio: isDelivery,
        cliente_id: clientIdToUse || null,
        direccion_entrega_id: addressIdToUse || null,
        costo_domicilio: isDelivery ? numericDeliveryCost : 0,
        estado: paymentMethod === 'credito' ? 'pendiente' : 'pagada',
        estado_pago: paymentMethod === 'credito' ? 'pendiente' : 'pagado'
      };
      
      // Add discount fields if discount was applied
      if (appliedDiscount && user.rol && ['propietario', 'administrador'].includes(user.rol)) {
        if (appliedDiscount.applyTo === 'total') {
          // Always save the calculated discount amount
          saleData.descuento_total = appliedDiscount.discountAmount;
          if (appliedDiscount.type === 'percentage') {
            saleData.descuento_porcentaje_total = appliedDiscount.value;
          }
          saleData.subtotal_antes_descuento = cart.reduce((total, item) => total + ((item.originalPrice || item.price) * item.quantity), 0);
          saleData.usuario_descuento_id = user.id;
          saleData.razon_descuento = appliedDiscount.reason;
          saleData.fecha_descuento = new Date().toISOString();
        }
      }
      
      // Set saldo_pendiente for credit sales
      if (paymentMethod === 'credito') {
        saleData.saldo_pendiente = finalTotal;
      }
      
      
      const { data: saleResult, error: saleError } = await supabase
        .from('ventas')
        .insert([saleData])
        .select()
        .single();

      if (saleError) throw saleError;

      const saleDetails = cart.map(item => ({
        venta_id: saleResult.id,
        producto_id: item.productId,
        cantidad: item.quantity,
        precio_unitario: item.originalPrice || item.price
      }));

      const { error: detailsError } = await supabase
        .from('detalle_ventas')
        .insert(saleDetails);

      if (detailsError) {
        console.error("Error al insertar detalles de venta. La venta principal fue creada.", detailsError);
        throw detailsError;
      }
      
      // Actualizar stock
      for (const item of cart) {
        if (item.requiere_stock && item.stock_actual !== null && item.stock_actual !== undefined) {
          const newStock = item.stock_actual - item.quantity;
          const { error: stockUpdateError } = await supabase
            .from('productos')
            .update({ stock_actual: newStock })
            .eq('id', item.productId);
          
          if (stockUpdateError) {
            console.warn(`Error actualizando stock para producto ${item.productId}:`, stockUpdateError.message);
          }
        }
      }

      // Limpiar formulario
      setCart([]);
      handleClosePaymentModal();
      setNotes('');
      setPaymentMethod('efectivo');
      setIsDelivery(false);
      setDeliveryCost('');
      setClientName('');
      setClientPhone('');
      setClientEmail('');
      setClientAddress('');
      setDeliveryAddress('');
      setAddressReferences('');
      setSelectedClient(null);
      setSelectedAddress(null);
      setClientAddresses([]);
      setClientSearchQuery('');
      setShowClientForm(false);
      setAppliedDiscount(null);
      
      fetchProducts();

      showAlertModal('¡Éxito!', 'Venta completada exitosamente.', 'success');
    } catch (err: unknown) {
      console.error('Error completando la venta:', err);
      const errorMessage = err instanceof Error ? err.message : 'Por favor, intenta de nuevo.';
      showAlertModal('Error', `Error al procesar la venta: ${errorMessage}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="ml-4 text-gray-500">Cargando...</p>
      </div>
    );
  }

  if (hasOpenRegister === false) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md bg-white p-8 rounded-lg shadow-sm border border-gray-200">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
            <Lock className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Caja Cerrada</h2>
          <p className="text-gray-500 mb-6">
            Para poder registrar ventas, necesitas abrir la caja primero.
          </p>
          <button
            onClick={() => window.location.href = '/cash-closing'}
            className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Ir a Cierre de Caja
          </button>
        </div>
      </div>
    );
  }

  const paymentOptions = [
    { value: 'efectivo' as const, label: 'Efectivo', icon: <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 mr-2" /> },
    { value: 'tarjeta' as const, label: 'Tarjeta', icon: <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 mr-2" /> },
    { value: 'credito' as const, label: 'Crédito', icon: <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 mr-2" /> },
    { value: 'bancolombia' as const, label: 'Bancolombia', icon: <Landmark className="h-4 w-4 sm:h-5 sm:w-5 mr-2" /> },
    { value: 'nequi' as const, label: 'Nequi', icon: <Smartphone className="h-4 w-4 sm:h-5 sm:w-5 mr-2" /> },
    { value: 'daviplata' as const, label: 'Daviplata', icon: <Smartphone className="h-4 w-4 sm:h-5 sm:w-5 mr-2" /> },
  ];

  const handleDeliveryCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setDeliveryCost(val);
    }
  };

  return (
    <div className={`h-[calc(100vh-4rem)] flex flex-col md:flex-row relative md:pb-0 ${cart.length > 0 && !showMobileCart && !showPaymentModal ? 'pb-24' : 'pb-0'} bg-slate-50/50`}>
      {/* ═══ MOBILE HEADER ═══ */}
      <div className="md:hidden flex items-center justify-between p-6 bg-white border-b border-slate-100 z-30">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-200">
            <ShoppingBag className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-black text-slate-900 font-outfit uppercase tracking-tight">Caja Vendrix</h1>
        </div>
        <button
          onClick={() => setShowMobileCart(true)}
          className="relative p-3 bg-slate-50 text-slate-400 hover:text-primary-600 rounded-xl transition-all active:scale-95"
        >
          <ShoppingCart className="h-6 w-6" />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-[10px] font-black rounded-full h-5 w-5 flex items-center justify-center shadow-md animate-in zoom-in-50">
              {totalItemsInCart()}
            </span>
          )}
        </button>
      </div>

      {/* ═══ PRODUCTS PORTAL ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white/80 backdrop-blur-md p-6 border-b border-slate-100 sticky top-0 md:top-0 z-20">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-primary-600">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                className="pl-12 pr-6 py-4 bg-slate-50 border-transparent focus:bg-white focus:ring-primary-500 focus:border-primary-500 block w-full text-sm font-medium text-slate-900 border-none rounded-2xl placeholder:text-slate-400 transition-all shadow-inner group-hover:bg-slate-100"
                placeholder="Escribe para buscar productos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2">
              <select
                className="bg-slate-50 border-none focus:ring-2 focus:ring-primary-500 h-full py-4 px-6 text-slate-600 font-bold text-[10px] uppercase tracking-widest rounded-2xl flex-1 md:flex-none cursor-pointer hover:bg-slate-100 transition-all"
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
              >
                <option value="">Todas las categorías</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.nombre.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {loading && products.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 col-span-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Inventario</p>
              </div>
            )}
            {!loading && filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 col-span-full bg-slate-50/50 rounded-[3rem] border border-dashed border-slate-200">
                <Search className="h-16 w-16 text-slate-200 mb-6" />
                <h3 className="text-xl font-black text-slate-900 font-outfit uppercase">Sin resultados</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Prueba con otros términos de auditoría</p>
              </div>
            )}
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className={`bg-white rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative group transition-all duration-300 active:scale-95 text-left
                  ${ product.requiere_stock && (product.stock_actual == null || product.stock_actual <= 0) 
                      ? 'opacity-40 grayscale cursor-not-allowed' 
                      : 'hover:shadow-[0_20px_40px_rgb(0,0,0,0.04)] hover:-translate-y-1'
                  }`}
                disabled={product.requiere_stock && (product.stock_actual == null || product.stock_actual <= 0)}
              >
                <div className="aspect-[4/3] bg-slate-50 relative rounded-t-[2rem] overflow-hidden">
                  <img 
                    src={product.url_imagen || 'https://via.placeholder.com/300x200?text=No+Imagen'} 
                    alt={product.nombre}
                    className="object-cover w-full h-full transform group-hover:scale-110 transition-transform duration-700" 
                    loading="lazy"
                  />
                  
                  {/* Stock Badges */}
                  {product.requiere_stock && product.stock_actual !== null && (
                    <div className="absolute top-4 right-4 flex flex-col gap-1 items-end">
                      <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg backdrop-blur-md
                        ${ product.stock_actual <= 0 
                            ? 'bg-rose-500 text-white' 
                            : product.stock_minimo && product.stock_actual <= product.stock_minimo
                              ? 'bg-amber-400 text-amber-900'
                              : 'bg-emerald-500/90 text-white' }`}>
                        {product.stock_actual <= 0 ? 'SIN STOCK' : `${product.stock_actual} UND.`}
                      </span>
                    </div>
                  )}

                  {/* Add Overlay */}
                  <div className="absolute inset-0 bg-primary-600/0 group-hover:bg-primary-600/10 transition-all duration-300 flex items-center justify-center">
                    <div className="h-12 w-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-primary-600 scale-0 group-hover:scale-100 transition-all duration-300">
                      <Plus className="h-6 w-6" />
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-1">
                    {categories.find(c => c.id === product.categoria_id)?.nombre || 'General'}
                  </span>
                  <h3 className="text-[13px] font-black text-slate-900 font-outfit uppercase leading-tight line-clamp-3 min-h-[3rem] group-hover:text-primary-600 transition-colors">
                    {product.nombre}
                  </h3>
                  <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                    <p className="text-xl font-black text-slate-900 font-outfit">
                      ${product.precio_venta.toLocaleString()}
                    </p>
                    <ArrowRight className="h-5 w-5 text-slate-200 group-hover:text-primary-600 transition-all opacity-0 group-hover:opacity-100 group-hover:translate-x-1" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* ═══ CART PANEL (DESKTOP & MOBILE FULL SCREEN) ═══ */}
      <div className={`bg-white flex flex-col h-full shadow-[0_0_50px_rgba(0,0,0,0.05)] border-l border-slate-100 
                      md:w-1/3 lg:w-[380px] xl:w-[420px] transition-all duration-500
                      ${showMobileCart ? 'fixed inset-0 z-[60]' : 'hidden'} md:flex relative`}>
        
        {/* Header Orden */}
        <div className="p-8 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10">
          <div>
            <h2 className="text-2xl font-black text-slate-900 font-outfit uppercase">Tu Pedido</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              Ref: {new Date().toLocaleDateString()} - {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          {showMobileCart && (
            <button
              onClick={() => setShowMobileCart(false)}
              className="md:hidden bg-slate-50 text-slate-400 hover:text-rose-500 p-3 rounded-2xl transition-all active:scale-95"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>
        
        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/10">
            <div className="h-32 w-32 bg-slate-50 rounded-[3rem] p-8 mb-8 flex items-center justify-center drop-shadow-sm">
              <ShoppingBag className="h-full w-full text-slate-100" />
            </div>
            <h3 className="text-lg font-black text-slate-900 font-outfit uppercase">Carrito Vacío</h3>
            <p className="text-sm text-slate-400 font-medium mt-2 leading-relaxed">Agrega productos del inventario para iniciar una nueva transacción.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
              <div className="space-y-4">
                {cart.map(item => (
                  <div key={item.id} className="bg-white rounded-3xl p-5 border border-slate-50 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-black text-slate-900 uppercase font-outfit line-clamp-1">{item.name}</h3>
                          {item.requiere_stock && item.stock_actual != null && item.stock_minimo != null &&
                           item.stock_actual <= item.stock_minimo && (
                            <AlertTriangle className={`h-4 w-4 ${item.stock_actual <= 0 ? 'text-rose-500' : 'text-amber-500'}`} />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 uppercase">
                            ${item.price.toLocaleString()} UND
                          </span>
                          {item.discountApplied && item.discountApplied > 0 && (
                            <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg uppercase">
                              -{item.discountApplied.toLocaleString()} OFF
                            </span>
                          )}
                        </div>
                      </div>
                      <button 
                        className="h-10 w-10 flex items-center justify-center text-rose-500 bg-rose-50 hover:bg-rose-100 hover:scale-110 active:scale-95 rounded-xl transition-all shadow-sm border border-rose-100"
                        onClick={() => removeFromCart(item.id)}
                        title="Eliminar producto"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-6">
                      <div className="flex items-center bg-slate-50 p-1 rounded-2xl gap-1">
                        <button 
                          className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-primary-600 hover:bg-white rounded-xl transition-all disabled:opacity-30 shadow-sm"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="text-sm font-black text-slate-900 w-10 text-center font-outfit tabular-nums">{item.quantity}</span>
                        <button 
                          className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-primary-600 hover:bg-white rounded-xl transition-all disabled:opacity-30 shadow-sm"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={!!(item.requiere_stock && item.stock_actual != null && item.quantity >= item.stock_actual)}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-lg font-black text-slate-900 font-outfit leading-none">
                        ${(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 bg-slate-900 text-white mt-auto">
              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  <span>Subtotal Fiscal</span>
                  <span className="text-white">${calculateSubtotal().toLocaleString()}</span>
                </div>
                {isDelivery && (Number(deliveryCost) || 0) > 0 && (
                  <div className="flex justify-between text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    <span>Logística Domicilio</span>
                    <span className="text-white">${(Number(deliveryCost) || 0).toLocaleString()}</span>
                  </div>
                )}
                {appliedDiscount && (
                  <div className="flex justify-between text-[11px] font-black text-emerald-400 uppercase tracking-widest">
                    <span>Descuento Aplicado</span>
                    <span>-${appliedDiscount.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="h-px bg-white/10 my-4" />
                <div className="flex justify-between items-end">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Total Factura</span>
                    <span className="text-4xl font-black font-outfit tracking-tighter block mt-1">
                      ${calculateTotal().toLocaleString()}
                    </span>
                  </div>
                  <div className="h-12 w-12 bg-white/5 rounded-[1.2rem] flex items-center justify-center text-white/40">
                    <Calculator className="h-6 w-6" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {/* Discount Trigger for Admins */}
                {user?.rol && ['propietario', 'administrador'].includes(user.rol) && (
                  <button
                    onClick={appliedDiscount ? handleRemoveDiscount : () => setShowDiscountModal(true)}
                    className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest
                      ${appliedDiscount 
                        ? 'bg-rose-500/10 border border-rose-500/20 text-rose-500' 
                        : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'}`}
                  >
                    {appliedDiscount ? (
                      <>
                        <X className="h-4 w-4" />
                        Eliminar Descuento
                      </>
                    ) : (
                      <>
                        <Percent className="h-4 w-4" />
                        Aplicar Descuento
                      </>
                    )}
                  </button>
                )}

                <button
                  className="w-full py-6 rounded-[2rem] bg-gradient-to-r from-primary-500 to-indigo-600 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-primary-900/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale disabled:pointer-events-none"
                  onClick={handleProceedToPayment}
                  disabled={cart.length === 0}
                >
                  <div className="flex items-center justify-center gap-3">
                    COMPLETAR TRANSACCIÓN
                    <ArrowRight className="h-5 w-5" />
                  </div>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Mobile Cart Footer */}
      {cart.length > 0 && !showMobileCart && !showPaymentModal && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-top-lg z-40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{totalItemsInCart()} {totalItemsInCart() === 1 ? 'producto' : 'productos'}</p>
              <p className="text-lg font-bold text-primary-600">${calculateTotal().toLocaleString()}</p>
            </div>
            <button
              onClick={() => setShowMobileCart(true)}
              className="px-6 py-3 bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700"
            >
              Ver Carrito
            </button>
          </div>
        </div>
      )}

      {/* ═══ MODERN MULTI-STEP PAYMENT MODAL ═══ */}
      {showPaymentModal && createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-0 sm:p-6 overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={handleClosePaymentModal} />
          
          <div className="relative w-full h-full sm:h-fit sm:max-h-[85vh] sm:max-w-2xl bg-white sm:rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-500 overflow-hidden flex flex-col mx-auto my-auto">
            
            {/* Modal Header */}
            <div className="p-6 md:p-8 flex items-center justify-between border-b border-slate-50 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-primary-50 rounded-2xl flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 font-outfit uppercase tracking-tight">Finalizar Venta</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`h-1.5 w-6 rounded-full transition-all duration-300 ${paymentStep >= 1 ? 'bg-primary-600' : 'bg-slate-100'}`} />
                    <span className={`h-1.5 w-6 rounded-full transition-all duration-300 ${paymentStep >= 2 ? 'bg-primary-600' : 'bg-slate-100'}`} />
                    <span className={`h-1.5 w-6 rounded-full transition-all duration-300 ${paymentStep >= 3 ? 'bg-primary-600' : 'bg-slate-100'}`} />
                  </div>
                </div>
              </div>
              <button 
                onClick={handleClosePaymentModal}
                className="h-12 w-12 bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all active:scale-95 flex items-center justify-center"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 custom-scrollbar bg-slate-50/20">
              
              {/* STEP 1: IDENTIFICACIÓN & LOGÍSTICA BASE */}
              {paymentStep === 1 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button 
                      onClick={() => setIsDelivery(!isDelivery)}
                      className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col gap-4 text-left group
                        ${isDelivery ? 'bg-primary-50/50 border-primary-500 shadow-lg shadow-primary-200/50' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                    >
                      <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all 
                        ${isDelivery ? 'bg-primary-600 text-white animate-bounce' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100'}`}>
                        <Truck className="h-7 w-7" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest block mb-1">Tipo de Entrega</span>
                        <h4 className="text-lg font-black text-slate-900 font-outfit uppercase">¿Es Domicilio?</h4>
                        <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-tighter">Habilitar parámetros de envío</p>
                      </div>
                    </button>

                    <button 
                      onClick={() => {
                        if (showClientForm) {
                          setSelectedClient(null);
                          setClientName('');
                          setClientPhone('');
                          setClientEmail('');
                          setClientAddress('');
                          setClientSearchQuery('');
                        }
                        setShowClientForm(!showClientForm);
                      }}
                      className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col gap-4 text-left group
                        ${showClientForm ? 'bg-indigo-50/50 border-indigo-500 shadow-lg shadow-indigo-200/50' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                    >
                      <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all 
                        ${showClientForm ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100'}`}>
                        <User className="h-7 w-7" />
                      </div>
                      <div className="flex-1">
                        <span className="text-[10px] font-black uppercase tracking-widest block mb-1">Información Fiscal</span>
                        <h4 className="text-lg font-black text-slate-900 font-outfit uppercase">¿Registrar Cliente?</h4>
                        <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-tighter">Asociar factura a base de datos</p>
                      </div>
                      {showClientForm && (
                        <div className="absolute top-4 right-4 h-6 w-6 bg-indigo-600 rounded-full flex items-center justify-center animate-in zoom-in-50">
                          <CheckCircle className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </button>
                  </div>

                  {!isDelivery && !showClientForm && paymentMethod !== 'credito' && (
                    <div className="bg-amber-50/50 border border-amber-100/50 p-8 rounded-[2.5rem] animate-in fade-in slide-in-from-top-4 duration-500">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 bg-amber-400 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-amber-200 animate-pulse">
                          <Zap className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-amber-900 uppercase font-outfit">Venta Rápida Activada</h4>
                          <p className="text-[11px] text-amber-700 font-bold uppercase mt-1 leading-relaxed opacity-80">
                            No has seleccionado domicilio ni registro de cliente. 
                            Puedes proceder directamente a confirmar el pago.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {(isDelivery || showClientForm || paymentMethod === 'credito') && (
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-6">
                      <div className="flex items-center gap-3 pb-6 border-b border-slate-50">
                        <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                          <User className="h-5 w-5" />
                        </div>
                        <h4 className="text-lg font-black text-slate-900 font-outfit uppercase">Detalles del Cliente</h4>
                      </div>

                      <div ref={clientSearchRef} className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                          <Search className="h-4 w-4" />
                        </div>
                        <input 
                          type="text" 
                          placeholder="BUSCAR CLIENTE POR NOMBRE O TELÉFONO..." 
                          className="w-full pl-11 pr-6 py-4 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-primary-500 rounded-2xl shadow-inner text-sm font-bold uppercase tracking-widest transition-all"
                          value={clientSearchQuery} 
                          onChange={(e) => { 
                            setClientSearchQuery(e.target.value); 
                            setShowClientSearch(true); 
                            if (selectedClient && e.target.value !== selectedClient.nombre_completo) { 
                              setSelectedClient(null); 
                              setClientName(e.target.value); 
                            } else if (!selectedClient) { 
                              setClientName(e.target.value); 
                            } 
                          }} 
                          onFocus={() => setShowClientSearch(true)} 
                        />
                        {showClientSearch && filteredClients.length > 0 && clientSearchQuery && (
                          <div className="absolute z-60 w-full mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 max-h-60 overflow-hidden animate-in zoom-in-95">
                            <ul className="divide-y divide-slate-50">
                              {filteredClients.map(client => (
                                <li key={client.id} className="p-4 hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => handleClientSelect(client)}>
                                  <div className="font-black text-slate-900 font-outfit uppercase text-sm">{client.nombre_completo}</div>
                                  <div className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-2">
                                    <Phone className="h-3 w-3" />
                                    {client.telefono || 'SIN TELÉFONO'}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nombre Facturación</label>
                          <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-xl text-xs font-bold uppercase" placeholder="NOMBRE COMPLETO" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">WhatsApp / Tel</label>
                          <input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-xl text-xs font-bold uppercase" placeholder="300 000 0000" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: LOGÍSTICA DE ENVÍO */}
              {paymentStep === 2 && isDelivery && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-6">
                    <div className="flex items-center gap-3 pb-6 border-b border-slate-50">
                      <div className="h-10 w-10 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <h4 className="text-lg font-black text-slate-900 font-outfit uppercase">Ubicación de Entrega</h4>
                    </div>

                    {selectedClient && clientAddresses.length > 0 && (
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Direcciones Guardadas</label>
                        <div className="grid grid-cols-1 gap-2">
                          {clientAddresses.map(address => (
                            <button 
                              key={address.id} 
                              onClick={() => handleAddressSelect(address)}
                              className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3
                                ${selectedAddress?.id === address.id ? 'bg-primary-50/50 border-primary-500' : 'bg-white border-slate-50 hover:border-slate-100'}`}
                            >
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${selectedAddress?.id === address.id ? 'bg-primary-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                <MapPin className="h-4 w-4" />
                              </div>
                              <span className="text-xs font-bold uppercase truncate">{address.direccion}</span>
                            </button>
                          ))}
                          <button 
                            onClick={() => { setSelectedAddress(null); setDeliveryAddress(''); setAddressReferences(''); }}
                            className={`p-4 rounded-2xl border-2 border-dashed text-left transition-all flex items-center gap-3
                              ${!selectedAddress ? 'bg-slate-50 border-slate-300' : 'border-slate-200 text-slate-400'}`}
                          >
                            <Plus className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-tight">Nueva Dirección</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Dirección de Destino</label>
                        <input type="text" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-xl text-xs font-bold uppercase" placeholder="CALLE, CARRERA, BARRIO..." />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Indicaciones / Referencias</label>
                        <textarea value={addressReferences} onChange={(e) => setAddressReferences(e.target.value)} rows={2} className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-xl text-xs font-bold uppercase resize-none" placeholder="EJ: CASA BLANCA SEGUNDO PISO..." />
                      </div>
                      <div className="space-y-2 pt-4">
                        <label className="text-sm font-black text-slate-900 font-outfit uppercase">Costo del Envío</label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-900 font-black">$</div>
                          <input type="text" inputMode="decimal" value={deliveryCost} onChange={handleDeliveryCostChange} className="w-full pl-10 pr-6 py-4 bg-slate-100 border-none rounded-2xl text-xl font-black font-outfit tracking-tighter" placeholder="0" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: MÉTODO DE PAGO & RESUMEN */}
              {paymentStep === 3 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecciona Método de Pago</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {paymentOptions.map(method => (
                        <button 
                          key={method.value} 
                          type="button" 
                          onClick={() => {
                            if (method.value === 'credito' && !selectedClient && !clientName.trim()) {
                              showAlertModal('Identificación Necesaria', 'Para ventas a crédito o domicilios con pago pendiente, es obligatorio registrar o asignar un cliente.', 'warning');
                            }
                            setPaymentMethod(method.value);
                          }}
                          className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 group
                            ${ paymentMethod === method.value 
                                ? 'bg-primary-600 border-primary-600 shadow-lg shadow-primary-200 shadow-primary-900/10' 
                                : 'bg-white border-slate-100 hover:border-slate-200'}`}
                        >
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all
                            ${paymentMethod === method.value ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100'}`}>
                            {method.icon}
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${paymentMethod === method.value ? 'text-white' : 'text-slate-600'}`}>
                            {method.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white space-y-6 shadow-2xl">
                    <div className="flex items-center gap-3 pb-6 border-b border-white/10">
                      <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center text-white">
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                      <h4 className="text-lg font-black font-outfit uppercase">Resumen de Factura</h4>
                    </div>

                    <div className="space-y-3 max-h-40 overflow-y-auto custom-scrollbar-white pr-2">
                      {cart.map(item => (
                        <div key={item.id} className="flex justify-between items-start text-xs font-black uppercase tracking-widest">
                          <span className="text-slate-400 pr-4">{item.name} (x{item.quantity})</span>
                          <span>${(item.price * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-6 border-t border-white/10 space-y-4">
                      <div className="flex justify-between text-xs font-black uppercase text-slate-400 tracking-widest">
                        <span>Abono Logística</span>
                        <span className="text-white">${(Number(deliveryCost) || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-rose-400 uppercase mb-1">Total Neto a Recibir</span>
                          <span className="text-4xl font-black font-outfit tracking-tighter text-primary-400">
                            ${calculateTotal().toLocaleString()}
                          </span>
                        </div>
                        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${paymentMethod === 'credito' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'}`}>
                          {paymentMethod === 'credito' ? 'CRÉDITO PENDIENTE' : 'RECIBO CERRADO'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {(paymentMethod === 'credito') && !selectedClient && (
                    <div className="bg-rose-50 border border-rose-200 p-8 rounded-[2.5rem] space-y-4 animate-in slide-in-from-top-4 shadow-xl shadow-rose-100">
                      <div className="flex items-center gap-3 pb-4 border-b border-rose-100">
                        <div className="h-10 w-10 bg-rose-600 rounded-xl flex items-center justify-center text-white">
                          <UserPlus className="h-5 w-5" />
                        </div>
                        <h4 className="text-sm font-black text-rose-900 uppercase tracking-tight">Asignación de Cliente Requerida</h4>
                      </div>
                      <p className="text-[11px] font-bold text-rose-700 uppercase tracking-tight leading-relaxed">
                        {paymentMethod === 'credito' 
                          ? 'Las ventas a crédito no pueden ser anónimas. Debes registrar un cliente para llevar el historial de deuda.'
                          : 'Este domicilio requiere un cliente asociado para procesar el pago pendiente.'}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-rose-900/40 uppercase tracking-widest ml-2">Nombre Completo *</label>
                          <input 
                            type="text" 
                            value={clientName} 
                            onChange={(e) => setClientName(e.target.value)} 
                            className="w-full px-5 py-4 bg-white border-none rounded-xl text-xs font-black uppercase ring-2 ring-rose-100 focus:ring-rose-500 transition-all" 
                            placeholder="NOMBRE DEL DEUDOR" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-rose-900/40 uppercase tracking-widest ml-2">WhatsApp / Tel *</label>
                          <input 
                            type="tel" 
                            value={clientPhone} 
                            onChange={(e) => setClientPhone(e.target.value)} 
                            className="w-full px-5 py-4 bg-white border-none rounded-xl text-xs font-black uppercase ring-2 ring-rose-100 focus:ring-rose-500 transition-all" 
                            placeholder="CELULAR DE CONTACTO" 
                          />
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setPaymentStep(1)}
                        className="w-full py-3 bg-white border border-rose-200 rounded-xl text-[10px] font-black uppercase text-rose-600 hover:bg-rose-50 transition-all mt-2"
                      >
                        O buscar cliente existente en el Paso 1
                      </button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Notas de Auditoría</label>
                    <textarea 
                      placeholder="INFORMACIÓN ADICIONAL DE LA VENTA..." 
                      className="w-full px-6 py-4 bg-slate-100 border-none rounded-2xl text-[10px] font-black uppercase tracking-widest resize-none h-24 focus:ring-2 focus:ring-primary-500" 
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-8 pb-10 border-t border-slate-50 bg-white flex flex-col-reverse sm:grid sm:grid-cols-2 gap-4">
              <button 
                onClick={paymentStep === 1 ? handleClosePaymentModal : () => setPaymentStep(prev => prev === 3 && !isDelivery ? 1 : prev - 1)}
                className="py-4 rounded-2xl text-slate-400 font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all border border-slate-100"
              >
                {paymentStep === 1 ? 'Cancelar' : 'Regresar'}
              </button>

              {paymentStep < 3 ? (
                <button 
                  onClick={() => setPaymentStep(prev => prev === 1 && !isDelivery ? 3 : prev + 1)}
                  className="py-4 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2 group"
                >
                  Continuar
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <button 
                  disabled={isSubmitting || !paymentMethod || (paymentMethod === 'credito' && !selectedClient && !clientName.trim())}
                  onClick={handleCompleteSale}
                  className="py-4 rounded-2xl bg-gradient-to-r from-primary-600 to-indigo-600 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary-200 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale"
                >
                  {isSubmitting ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isSubmitting ? 'PROCESANDO...' : 'CONFIRMAR Y FINALIZAR'}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Discount Modal */}
      <DiscountModal
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        cart={cart}
        onApplyDiscount={handleApplyDiscount}
        subtotal={cart.reduce((total, item) => total + ((item.originalPrice || item.price) * item.quantity), 0)}
      />
      
      <AlertModal isOpen={showAlert} onClose={() => setShowAlert(false)} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} />
    </div>
  );
};

export default NewSale;