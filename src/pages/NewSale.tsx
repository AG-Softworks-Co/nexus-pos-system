// src/pages/NewSale.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, CreditCard, DollarSign, X, AlertCircle, Smartphone, CreditCard as CardIcon, Truck, MapPin, Phone, Mail, User, ShoppingCart, Minus, AlertTriangle, CheckCircle, ArrowLeft, Landmark, Percent } from 'lucide-react';
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

  const bgColor = type === 'success' ? 'bg-green-50' :
                 type === 'warning' ? 'bg-yellow-50' :
                 'bg-red-50';

  const iconColor = type === 'success' ? 'text-green-400' :
                   type === 'warning' ? 'text-yellow-400' :
                   'text-red-400';

  const textColor = type === 'success' ? 'text-green-800' :
                   type === 'warning' ? 'text-yellow-800' :
                   'text-red-800';

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className={`${bgColor} px-4 py-5 sm:p-6`}>
            <div className="sm:flex sm:items-start">
              <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${bgColor} sm:mx-0 sm:h-10 sm:w-10`}>
                <Icon className={`h-6 w-6 ${iconColor}`} />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className={`text-lg font-medium ${textColor}`}>
                  {title}
                </h3>
                <div className="mt-2">
                  <p className={`text-sm ${textColor}`}>
                    {message}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 ${
                type === 'success' ? 'bg-green-600 hover:bg-green-700' :
                type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' :
                'bg-red-600 hover:bg-red-700'
              } text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                type === 'success' ? 'focus:ring-green-500' :
                type === 'warning' ? 'focus:ring-yellow-500' :
                'focus:ring-red-500'
              } sm:ml-3 sm:w-auto sm:text-sm`}
              onClick={onClose}
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
const NewSale: React.FC = () => {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'bancolombia' | 'nequi' | 'daviplata' | 'tarjeta' | 'credito'>('efectivo');
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
  
  // Discount states
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<{
    type: 'percentage' | 'amount';
    value: number;
    reason: string;
    applyTo: 'total' | string;
    discountAmount: number;
  } | null>(null);

  useEffect(() => {
    if (user?.negocioId) {
      fetchProducts();
      fetchCategories();
      fetchClients();
    }
  }, [user]);

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
        if (item.requiere_stock && item.stock_actual !== null && newQuantity > item.stock_actual) {
          showAlertModal('Stock Insuficiente', 'No hay suficiente stock disponible para esta cantidad.', 'error');
          return item;
        }

        if (item.requiere_stock && item.stock_minimo != null && item.stock_actual != null && (item.stock_actual - newQuantity) <= item.stock_minimo) {
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

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setShowDiscountModal(false);
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
      setCart(prevCart => 
        prevCart.map(item => {
          if (item.productId === appliedDiscount?.applyTo) {
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
    
    if (finalTotal <= 0) {
      showAlertModal('Error', 'El total de la venta no puede ser $0 o negativo.', 'error');
      return;
    }
    
    if (paymentMethod === 'credito' && !selectedClient) {
      showAlertModal('Cliente Requerido', 'Para ventas a crédito, debe seleccionar un cliente.', 'warning');
      return;
    }
    
    if (isDelivery && (!clientName.trim() || !deliveryAddress.trim() || numericDeliveryCost < 0)) {
        showAlertModal('Campos incompletos', 'Para domicilio, por favor complete nombre del cliente, dirección y costo de envío (no puede ser negativo).', 'warning');
        return;
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
      const saleData: any = {
        usuario_id: user.id,
        negocio_id: user.negocioId,
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
      
      console.log('Sending sale data:', saleData);
      
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
    } catch (err: any) {
      console.error('Error completando la venta:', err);
      showAlertModal('Error', `Error al procesar la venta: ${err.message || 'Por favor, intenta de nuevo.'}`, 'error');
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

  const paymentOptions = [
    { value: 'efectivo' as const, label: 'Efectivo', icon: <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 mr-2" /> },
    { value: 'tarjeta' as const, label: 'Tarjeta', icon: <CardIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" /> },
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
    <div className={`h-[calc(100vh-4rem)] flex flex-col md:flex-row md:space-x-6 relative md:pb-0 ${cart.length > 0 && !showMobileCart && !showPaymentModal ? 'pb-24' : 'pb-0'}`}>
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b sticky top-0 z-30">
        <h1 className="text-xl font-semibold">Nueva Venta</h1>
        <button
          onClick={() => setShowMobileCart(true)}
          className="relative p-2 text-gray-600 hover:text-gray-900"
        >
          <ShoppingCart className="h-6 w-6" />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {totalItemsInCart()}
            </span>
          )}
        </button>
      </div>

      {/* Products Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white p-4 shadow-sm border-b sticky top-[73px] md:top-0 z-20">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="pl-10 pr-4 py-2 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                placeholder="Buscar productos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2">
              <select
                className="focus:ring-primary-500 focus:border-primary-500 h-full py-2 pl-3 pr-7 border-gray-300 bg-white text-gray-700 sm:text-sm rounded-md flex-1 md:flex-none"
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
              >
                <option value="">Todas las categorías</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50 custom-scrollbar px-4 pb-4 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {loading && products.length === 0 && (
              <div className="flex items-center justify-center py-10 col-span-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="ml-3 text-gray-500">Cargando productos...</p>
              </div>
            )}
            {!loading && filteredProducts.length === 0 && (
              <div className="text-center py-10 col-span-full">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No se encontraron productos.</p>
                <p className="text-sm text-gray-400">Intenta con otra búsqueda o categoría.</p>
              </div>
            )}
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-transform hover:scale-105 
                  ${ product.requiere_stock && (product.stock_actual == null || product.stock_actual <= 0) 
                      ? 'opacity-60 cursor-not-allowed' 
                      : 'hover:shadow-md'
                  }`}
                disabled={product.requiere_stock && (product.stock_actual == null || product.stock_actual <= 0)}
              >
                <div className="aspect-w-1 aspect-h-1 bg-gray-200 relative">
                  <img 
                    src={product.url_imagen || 'https://via.placeholder.com/300x200?text=No+Imagen'} 
                    alt={product.nombre}
                    className="object-cover w-full h-full" 
                    loading="lazy"
                  />
                  {product.requiere_stock && product.stock_actual !== null && product.stock_actual !== undefined && product.stock_minimo !== null && product.stock_minimo !== undefined && product.stock_actual <= product.stock_minimo && (
                    <div className="absolute top-2 right-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold shadow-md
                        ${ product.stock_actual <= 0 ? 'bg-red-500 text-white' : 'bg-yellow-400 text-yellow-900' }`}>
                        {product.stock_actual <= 0 ? 'Agotado' : `${product.stock_actual} und.`}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="p-3 text-left">
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {product.nombre}
                  </h3>
                  <p className="mt-1 text-sm font-bold text-primary-600">
                    ${product.precio_venta.toLocaleString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Cart Section (Desktop & Mobile Full Screen) */}
      <div className={`bg-white flex flex-col h-full shadow-lg border-l border-gray-200 
                      md:w-1/3 lg:w-1/4 
                      ${showMobileCart ? 'fixed inset-0 z-50' : 'hidden'} md:flex`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-medium text-gray-900">Orden actual</h2>
          {showMobileCart && (
            <button
              onClick={() => setShowMobileCart(false)}
              className="md:hidden text-gray-500 hover:text-gray-700 p-1"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>
        
        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <ShoppingCart className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 mb-2">Carrito vacío</p>
            <p className="text-sm text-gray-400">Agrega productos haciendo clic en ellos</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="divide-y divide-gray-100">
                {cart.map(item => (
                  <div key={item.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 mr-2">
                        <div className="flex items-center">
                          <h3 className="text-sm font-medium text-gray-900">{item.name}</h3>
                          {item.requiere_stock && item.stock_actual !== null && item.stock_minimo !== null &&
                           item.stock_actual <= item.stock_minimo && item.stock_actual > 0 && (
                            <div className="ml-2 flex items-center text-yellow-600" 
                                 title={`Stock bajo: ${item.stock_actual} unidades restantes`}>
                              <AlertTriangle className="h-4 w-4" />
                            </div>
                          )}
                           {item.requiere_stock && item.stock_actual !== null && item.stock_actual <= 0 && (
                            <div className="ml-2 flex items-center text-red-600" 
                                 title={`Producto agotado`}>
                              <AlertCircle className="h-4 w-4" />
                            </div>
                           )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-500">${item.price.toLocaleString()} c/u</p>
                          {item.discountApplied && item.discountApplied > 0 && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                              Descuento: ${item.discountApplied.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <button 
                        className="text-red-400 hover:text-red-600 p-1 -mr-1 -mt-1"
                        onClick={() => removeFromCart(item.id)}
                        aria-label="Eliminar item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center space-x-2">
                        <button 
                          className="text-gray-500 hover:text-primary-600 border border-gray-300 rounded-full p-1.5 disabled:opacity-50"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label="Reducir cantidad"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-gray-900 w-8 text-center text-sm tabular-nums">{item.quantity}</span>
                        <button 
                          className="text-gray-500 hover:text-primary-600 border border-gray-300 rounded-full p-1.5 disabled:opacity-50"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={!!(item.requiere_stock && item.stock_actual !== null && item.quantity >= item.stock_actual)}
                          aria-label="Aumentar cantidad"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        ${(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 sticky bottom-0 bg-white z-10">
              <div className="space-y-3">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>${calculateSubtotal().toLocaleString()}</span>
                </div>
                {isDelivery && (Number(deliveryCost) || 0) > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Domicilio</span>
                    <span>${(Number(deliveryCost) || 0).toLocaleString()}</span>
                  </div>
                )}
                {appliedDiscount && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Descuento ({appliedDiscount.type === 'percentage' ? `${appliedDiscount.value}%` : 'Monto fijo'})</span>
                    <span>-${appliedDiscount.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-medium text-gray-900">
                  <span>Total</span>
                  <span>${calculateTotal().toLocaleString()}</span>
                </div>
                
                {/* Discount section for admins/owners */}
                {user?.rol && ['propietario', 'administrador'].includes(user.rol) && (
                  <div className="pt-3 border-t border-gray-200">
                    {appliedDiscount ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-green-600 font-medium">
                            Descuento aplicado ({appliedDiscount.type === 'percentage' ? `${appliedDiscount.value}%` : `$${appliedDiscount.value.toLocaleString()}`})
                          </span>
                          <button
                            onClick={handleRemoveDiscount}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            Quitar
                          </button>
                        </div>
                        <div className="text-xs text-gray-500">
                          Razón: {appliedDiscount.reason}
                        </div>
                        <div className="text-xs text-green-600">
                          Ahorro: ${appliedDiscount.discountAmount.toLocaleString()}
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDiscountModal(true)}
                        className="w-full flex items-center justify-center py-2 px-3 border border-yellow-300 rounded-md shadow-sm text-sm font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                      >
                        <Percent className="h-4 w-4 mr-2" />
                        Aplicar Descuento
                      </button>
                    )}
                  </div>
                )}
                
                <button
                  className="w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  onClick={handleProceedToPayment}
                  disabled={cart.length === 0}
                >
                  Proceder al Pago
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

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[60] bg-white sm:bg-gray-500 sm:bg-opacity-75 sm:flex sm:items-center sm:justify-center sm:p-4">
          <div className="w-full h-full flex flex-col bg-white text-left overflow-hidden transition-all sm:max-w-2xl sm:my-8 sm:rounded-lg sm:shadow-xl sm:h-auto">
            <div className="flex items-center p-4 border-b">
              <button type="button" className="text-gray-600 hover:text-gray-900 sm:hidden w-8 h-8 flex items-center justify-center -ml-2" onClick={handleClosePaymentModal} aria-label="Volver"><ArrowLeft className="w-5 h-5" /></button>
              <h3 className="text-lg font-semibold text-gray-900 text-center flex-1 sm:text-left sm:flex-none">Completar venta</h3>
              <button type="button" className="text-gray-400 hover:text-gray-500 focus:outline-none hidden sm:block w-8 h-8 flex items-center justify-center -mr-2" onClick={handleClosePaymentModal} aria-label="Cerrar modal"><X className="w-6 h-6" /></button>
              <div className="w-8 sm:hidden"></div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar sm:p-6 sm:max-h-[calc(100vh-220px)] md:max-h-[65vh]">
              <div className="flex items-center justify-between bg-slate-100 p-3 sm:p-4 rounded-lg">
                <div className="flex items-center"><Truck className="h-5 w-5 text-gray-500 mr-3" /><span className="text-sm font-medium text-gray-900">¿Es un domicilio?</span></div>
                <label className="flex items-center cursor-pointer"><div className="relative"><input type="checkbox" className="sr-only" checked={isDelivery} onChange={(e) => setIsDelivery(e.target.checked)} /><div className={`block w-10 h-6 rounded-full ${isDelivery ? 'bg-primary-600' : 'bg-gray-300'}`}></div><div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${isDelivery ? 'transform translate-x-4' : ''}`}></div></div></label>
              </div>

              <div className="flex items-center justify-between bg-slate-100 p-3 sm:p-4 rounded-lg">
                <div className="flex items-center"><User className="h-5 w-5 text-gray-500 mr-3" /><span className="text-sm font-medium text-gray-900">¿Registrar cliente?</span></div>
                <label className="flex items-center cursor-pointer"><div className="relative"><input type="checkbox" className="sr-only" checked={showClientForm} onChange={(e) => setShowClientForm(e.target.checked)} /><div className={`block w-10 h-6 rounded-full ${showClientForm ? 'bg-primary-600' : 'bg-gray-300'}`}></div><div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${showClientForm ? 'transform translate-x-4' : ''}`}></div></div></label>
              </div>

              {(isDelivery || paymentMethod === 'credito' || showClientForm) && (
                <div className="bg-slate-100 p-4 rounded-lg space-y-3">
                  <h4 className="text-md font-semibold text-gray-800 mb-1">Información del Cliente</h4>
                  <div ref={clientSearchRef} className="relative">
                    <input type="text" placeholder="Buscar o crear cliente..." className="w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm" value={clientSearchQuery} onChange={(e) => { setClientSearchQuery(e.target.value); setShowClientSearch(true); if (selectedClient && e.target.value !== selectedClient.nombre_completo) { setSelectedClient(null); setClientName(e.target.value); } else if (!selectedClient) { setClientName(e.target.value); } }} onFocus={() => setShowClientSearch(true)} />
                    {showClientSearch && filteredClients.length > 0 && clientSearchQuery && (
                      <div className="absolute z-20 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-auto custom-scrollbar"><ul>{filteredClients.map(client => (<li key={client.id} className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm" onClick={() => handleClientSelect(client)}><div className="font-medium">{client.nombre_completo}</div><div className="text-xs text-gray-500">{client.telefono && <span><Phone className="inline h-3 w-3 mr-1" />{client.telefono}</span>}</div></li>))}</ul></div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label htmlFor="clientName" className="block text-xs font-medium text-gray-700 mb-1">Nombre completo<span className="text-red-500">*</span></label><div className="relative rounded-md shadow-sm"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><User className="h-4 w-4 text-gray-400" /></div><input id="clientName" type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className="pl-10 pr-3 py-2 bg-white focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md" placeholder="Nombre del cliente" required={isDelivery || paymentMethod === 'credito'}/></div></div>
                    <div><label htmlFor="clientPhone" className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label><div className="relative rounded-md shadow-sm"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Phone className="h-4 w-4 text-gray-400" /></div><input id="clientPhone" type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="pl-10 pr-3 py-2 bg-white focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md" placeholder="Número de contacto"/></div></div>
                    <div className="sm:col-span-2"><label htmlFor="clientEmail" className="block text-xs font-medium text-gray-700 mb-1">Correo (opcional)</label><div className="relative rounded-md shadow-sm"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail className="h-4 w-4 text-gray-400" /></div><input id="clientEmail" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="pl-10 pr-3 py-2 bg-white focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md" placeholder="correo@ejemplo.com"/></div></div>
                    <div className="sm:col-span-2"><label htmlFor="clientAddress" className="block text-xs font-medium text-gray-700 mb-1">Dirección (opcional)</label><div className="relative rounded-md shadow-sm"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><MapPin className="h-4 w-4 text-gray-400" /></div><input id="clientAddress" type="text" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} className="pl-10 pr-3 py-2 bg-white focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md" placeholder="Dirección del cliente"/></div></div>
                  </div>
                </div>
              )}
              {isDelivery && (
                <div className="bg-slate-100 p-4 rounded-lg space-y-3">
                  <h4 className="text-md font-semibold text-gray-800 mb-1">Información de entrega</h4>
                  {selectedClient && clientAddresses.length > 0 && (<div><label htmlFor="savedAddresses" className="block text-xs font-medium text-gray-700 mb-1">Direcciones guardadas</label><select id="savedAddresses" className="w-full border-gray-300 bg-white rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 py-2 px-3 sm:text-sm" onChange={(e) => { const addr = clientAddresses.find(a => a.id === e.target.value); if (addr) handleAddressSelect(addr); else { setSelectedAddress(null); setDeliveryAddress(''); setAddressReferences('');}}} value={selectedAddress?.id || ''}><option value="">-- Nueva dirección --</option>{clientAddresses.map(address => (<option key={address.id} value={address.id}>{address.direccion}</option>))}</select></div>)}
                  <div><label htmlFor="deliveryAddr" className="block text-xs font-medium text-gray-700 mb-1">Dirección <span className="text-red-500">*</span></label><div className="relative rounded-md shadow-sm"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><MapPin className="h-4 w-4 text-gray-400" /></div><input id="deliveryAddr" type="text" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="pl-10 pr-3 py-2 bg-white focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md" placeholder="Dirección completa" required={isDelivery}/></div></div>
                  <div><label htmlFor="addressRef" className="block text-xs font-medium text-gray-700 mb-1">Referencias</label><textarea id="addressRef" value={addressReferences} onChange={(e) => setAddressReferences(e.target.value)} rows={2} className="mt-1 px-3 py-2 bg-white focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md" placeholder="Indicaciones adicionales" /></div>
                  <div><label htmlFor="deliveryCst" className="block text-xs font-medium text-gray-700 mb-1">Costo envío <span className="text-red-500">*</span></label><div className="mt-1 relative rounded-md shadow-sm"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><span className="text-gray-500 sm:text-sm">$</span></div><input id="deliveryCst" type="text" inputMode="decimal" value={deliveryCost} onChange={handleDeliveryCostChange} className="pl-7 pr-3 py-2 bg-white focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md" placeholder="0" required={isDelivery}/></div></div>
                </div>
              )}
              
              <div><label className="block text-sm font-medium text-gray-700 mb-2">Método de pago</label><div className="grid grid-cols-2 gap-2 sm:gap-3">{paymentOptions.map(method => (<button key={method.value} type="button" className={`flex items-center justify-center px-2 py-2.5 sm:px-3 sm:py-3 border rounded-md text-xs sm:text-sm font-medium transition-colors ${ paymentMethod === method.value ? 'bg-primary-50 border-primary-500 text-primary-700 ring-2 ring-primary-500' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`} onClick={() => setPaymentMethod(method.value)}>{method.icon}{method.label}</button>))}</div></div>
              <div><label htmlFor="saleNotes" className="block text-sm font-medium text-gray-700 mb-2">Notas</label><textarea id="saleNotes" rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm" placeholder="Información adicional de la venta..." value={notes} onChange={(e) => setNotes(e.target.value)}/></div>
              
              <div className="bg-slate-100 p-4 rounded-lg">
                <div className="space-y-2">
                  <h4 className="text-md font-semibold text-gray-800 mb-3">Resumen del pedido</h4>
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between text-sm text-gray-600">
                      <span className="truncate pr-2">
                        {item.name} (x{item.quantity})
                        {item.discountApplied && item.discountApplied > 0 && (
                          <span className="text-green-600 ml-1">(-${item.discountApplied.toLocaleString()})</span>
                        )}
                      </span>
                      <span className="flex-shrink-0">${(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal</span>
                      <span>${calculateSubtotal().toLocaleString()}</span>
                    </div>
                    {isDelivery && (Number(deliveryCost) || 0) > 0 && (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Domicilio</span>
                        <span>${(Number(deliveryCost) || 0).toLocaleString()}</span>
                      </div>
                    )}
                    {appliedDiscount && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Descuento ({appliedDiscount.type === 'percentage' ? `${appliedDiscount.value}%` : 'Monto fijo'})</span>
                        <span>-${appliedDiscount.discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between mt-2 pt-2 border-t border-gray-300">
                      <span className="text-base font-medium text-gray-900">Total a pagar</span>
                      <span className="text-lg font-bold text-primary-600">${calculateTotal().toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex flex-col-reverse sm:flex-row-reverse gap-3">
              <button type="button" className="w-full inline-flex justify-center items-center px-4 py-2.5 sm:py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:w-auto disabled:opacity-50" onClick={handleCompleteSale} disabled={isSubmitting || cart.length === 0}>{isSubmitting ? (<><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Procesando...</>) : ('Completar venta')}</button>
              <button type="button" className="w-full inline-flex justify-center px-4 py-2.5 sm:py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:w-auto" onClick={handleClosePaymentModal}>Cancelar</button>
            </div>
          </div>
        </div>
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