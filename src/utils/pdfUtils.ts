import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { formatDisplayDate } from './dateUtils';
import type { Sale, SaleDetail } from '../types/sales';
import { supabase } from '../lib/supabase';

// Función para obtener configuración del negocio
const getBusinessConfig = async (negocioId: string) => {
  try {
    const { data: config } = await supabase
      .from('configuracion_negocio')
      .select('*')
      .eq('negocio_id', negocioId)
      .single();

    const { data: business } = await supabase
      .from('negocios')
      .select('*')
      .eq('id', negocioId)
      .single();

    return { config, business };
  } catch (error) {
    console.error('Error fetching business config:', error);
    return { config: null, business: null };
  }
};

// Función para convertir imagen a base64
const getImageAsBase64 = async (imageUrl: string): Promise<string | null> => {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return null;
  }
};

export const generateSaleReceipt = async (sale: Sale) => {
  // Fetch business info and configuration
  const { config, business: businessData } = await getBusinessConfig(sale.negocio_id || '');

  const doc = new jsPDF({
    format: [80, 200], // 80mm width, variable height
    unit: 'mm'
  });

  // Page dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 3;
  const contentWidth = pageWidth - (margin * 2);

  // Helper functions
  const centerText = (text: string, y: number, size = 9, style = 'normal') => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.text(text, pageWidth / 2, y, { align: 'center' });
  };

  const leftText = (text: string, y: number, size = 8, style = 'normal') => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.text(text, margin, y);
  };

  const rightText = (text: string, y: number, size = 8, style = 'normal') => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.text(text, pageWidth - margin, y, { align: 'right' });
  };

  const drawLine = (y: number, thickness = 0.3) => {
    doc.setLineWidth(thickness);
    doc.setDrawColor(0, 0, 0);
    doc.line(margin, y, pageWidth - margin, y);
  };

  let yPos = margin + 2;

  // === LOGO ===
  if (businessData?.logo_url && config?.mostrar_logo_ticket !== false) {
    try {
      const logoBase64 = await getImageAsBase64(businessData.logo_url);
      if (logoBase64) {
        const logoWidth = 25;
        const logoHeight = 18;
        const logoX = (pageWidth - logoWidth) / 2;

        doc.addImage(logoBase64, 'JPEG', logoX, yPos, logoWidth, logoHeight);
        yPos += logoHeight + 2;
      }
    } catch (error) {
      console.error('Error adding logo:', error);
    }
  }

  // === NOMBRE DEL NEGOCIO ===
  centerText((businessData?.nombre || 'MI NEGOCIO').toUpperCase(), yPos, 14, 'bold');
  yPos += 5;

  // === INFORMACIÓN DEL NEGOCIO ===
  if (businessData?.nit && config?.mostrar_nit_ticket !== false) {
    centerText(`NIT: ${businessData.nit}`, yPos, 8);
    yPos += 3.5;
  }

  if (businessData?.direccion && config?.mostrar_direccion_ticket !== false) {
    const direccionLines = doc.splitTextToSize(businessData.direccion, contentWidth);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    for (let i = 0; i < direccionLines.length; i++) {
      centerText(direccionLines[i], yPos, 8);
      yPos += 3;
    }
  }

  if (businessData?.telefono_principal && config?.mostrar_telefono_ticket !== false) {
    centerText(`Tel: ${businessData.telefono_principal}`, yPos, 8);
    yPos += 3.5;
  }

  yPos += 2;
  drawLine(yPos, 0.5);
  yPos += 4;

  // === TÍTULO DEL RECIBO ===
  centerText('RECIBO DE VENTA', yPos, 12, 'bold');
  yPos += 4;
  centerText(`No. ${sale.id.slice(0, 8).toUpperCase()}`, yPos, 9);
  yPos += 5;

  // === INFORMACIÓN DE LA VENTA ===
  const fechaFormateada = new Date(sale.creada_en).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  leftText(`Fecha: ${fechaFormateada}`, yPos, 8);
  yPos += 3.5;

  leftText(`Vendedor: ${sale.usuario.nombre_completo}`, yPos, 8);
  yPos += 3.5;

  if (sale.cliente) {
    leftText(`Cliente: ${sale.cliente.nombre_completo}`, yPos, 8);
    yPos += 3.5;

    if (sale.cliente.telefono) {
      leftText(`Tel: ${sale.cliente.telefono}`, yPos, 8);
      yPos += 3.5;
    }
  }

  // Dirección de entrega para domicilios
  if (sale.es_domicilio && sale.direccion_entrega) {
    leftText('Dirección de entrega:', yPos, 8, 'bold');
    yPos += 3.5;

    const direccionEntrega = doc.splitTextToSize(sale.direccion_entrega.direccion, contentWidth);
    for (let i = 0; i < direccionEntrega.length; i++) {
      leftText(direccionEntrega[i], yPos, 8);
      yPos += 3;
    }

    if (sale.direccion_entrega.referencias) {
      const referencias = doc.splitTextToSize(`Ref: ${sale.direccion_entrega.referencias}`, contentWidth);
      for (let i = 0; i < referencias.length; i++) {
        leftText(referencias[i], yPos, 8);
        yPos += 3;
      }
    }
  }

  yPos += 2;
  drawLine(yPos, 0.5);
  yPos += 4;

  // === TABLA DE PRODUCTOS ===
  // Fetch return information
  const { data: returnData } = await supabase
    .from('devoluciones')
    .select(`
      monto_devolucion,
      detalle_devoluciones (
        detalle_venta_id,
        cantidad_devuelta
      )
    `)
    .eq('venta_id', sale.id)
    .eq('estado', 'aprobada')
    .maybeSingle();

  const returnedQuantities: Record<string, number> = {};
  if (returnData?.detalle_devoluciones) {
    returnData.detalle_devoluciones.forEach(detail => {
      returnedQuantities[detail.detalle_venta_id] = detail.cantidad_devuelta;
    });
  }

  // Configurar columnas de la tabla
  const colWidths = {
    producto: contentWidth * 0.45,  // 45% para producto
    cantidad: contentWidth * 0.15,  // 15% para cantidad
    precio: contentWidth * 0.20,    // 20% para precio
    total: contentWidth * 0.20      // 20% para total
  };

  const colPositions = {
    producto: margin,
    cantidad: margin + colWidths.producto,
    precio: margin + colWidths.producto + colWidths.cantidad,
    total: pageWidth - margin - colWidths.total
  };

  // Encabezado de la tabla con fondo gris
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 1, contentWidth, 5, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);

  doc.text('Producto', colPositions.producto + 1, yPos + 2);
  doc.text('Cant', colPositions.cantidad + (colWidths.cantidad / 2), yPos + 2, { align: 'center' });
  doc.text('Precio', colPositions.precio + (colWidths.precio / 2), yPos + 2, { align: 'center' });
  doc.text('Total', colPositions.total + (colWidths.total / 2), yPos + 2, { align: 'center' });

  yPos += 5;
  drawLine(yPos, 0.4);
  yPos += 2;

  // Productos
  doc.setFont('helvetica', 'normal');
  let subtotalProductos = 0;

  sale.detalle_ventas.forEach((item, index) => {
    const returnedQty = returnedQuantities[item.id] || 0;
    const effectiveQty = item.cantidad - returnedQty;
    const effectiveTotal = effectiveQty * item.precio_unitario;
    subtotalProductos += effectiveTotal;

    // Alternar fondo para mejor legibilidad
    if (index % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, yPos - 1, contentWidth, 4, 'F');
    }

    // Nombre del producto (truncar si es muy largo)
    const maxProductLength = 20;
    let productName = item.producto.nombre;
    if (productName.length > maxProductLength) {
      productName = productName.substring(0, maxProductLength - 3) + '...';
    }

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);

    // Producto
    doc.text(productName, colPositions.producto + 1, yPos + 2);

    // Cantidad
    doc.text(effectiveQty.toString(), colPositions.cantidad + (colWidths.cantidad / 2), yPos + 2, { align: 'center' });

    // Precio unitario
    doc.text(`$${item.precio_unitario.toLocaleString()}`, colPositions.precio + (colWidths.precio / 2), yPos + 2, { align: 'center' });

    // Total
    doc.text(`$${effectiveTotal.toLocaleString()}`, colPositions.total + (colWidths.total / 2), yPos + 2, { align: 'center' });

    yPos += 4;
  });

  yPos += 1;
  drawLine(yPos, 0.4);
  yPos += 4;

  // === TOTALES ===
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  // Subtotal
  leftText('Subtotal:', yPos, 9);
  rightText(`$${(sale.subtotal_antes_descuento || subtotalProductos).toLocaleString()}`, yPos, 9);
  yPos += 4;

  // Descuento si aplica
  if (sale.descuento_total && sale.descuento_total > 0) {
    let discountLabel = 'Descuento:';
    if (sale.descuento_porcentaje_total && sale.descuento_porcentaje_total > 0) {
      discountLabel = `Descuento (${sale.descuento_porcentaje_total}%):`;
    }
    leftText(discountLabel, yPos, 9);
    rightText(`-$${sale.descuento_total.toLocaleString()}`, yPos, 9);
    yPos += 4;
  }

  // Domicilio si aplica
  if (sale.es_domicilio && sale.costo_domicilio > 0) {
    leftText('Domicilio:', yPos, 9);
    rightText(`$${sale.costo_domicilio.toLocaleString()}`, yPos, 9);
    yPos += 4;
  }

  // Devolución si aplica
  if (returnData?.monto_devolucion) {
    leftText('Devolución:', yPos, 9);
    rightText(`-$${returnData.monto_devolucion.toLocaleString()}`, yPos, 9);
    yPos += 4;
  }

  // Línea antes del total
  drawLine(yPos, 0.5);
  yPos += 4;

  // TOTAL FINAL
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  leftText('TOTAL:', yPos, 12, 'bold');
  rightText(`$${sale.total.toLocaleString()}`, yPos, 12, 'bold');
  yPos += 6;

  // Línea después del total
  drawLine(yPos, 0.5);
  yPos += 4;

  // Método de pago
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  centerText(`Método de pago: ${sale.metodo_pago.toUpperCase()}`, yPos, 9);
  yPos += 6;

  // Línea separadora final
  drawLine(yPos, 0.5);
  yPos += 4;

  // === FOOTER ===
  const mensajeGracias = config?.mensaje_agradecimiento || '¡Gracias por su compra!';
  const mensajeDespedida = config?.mensaje_despedida || 'Vuelva pronto';

  doc.setFont('helvetica', 'bold');
  centerText(mensajeGracias, yPos, 10, 'bold');
  yPos += 4;

  doc.setFont('helvetica', 'normal');
  centerText(mensajeDespedida, yPos, 9);
  yPos += 4;

  if (businessData?.correo_empresarial) {
    centerText(businessData.correo_empresarial, yPos, 7);
    yPos += 3;
  }

  // Marca de agua si está cancelada
  if (sale.estado === 'cancelada') {
    doc.setTextColor(200, 200, 200);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(30);
    doc.text('CANCELADA', pageWidth / 2, doc.internal.pageSize.getHeight() / 2, {
      angle: 45,
      align: 'center'
    });
  }

  // Guardar PDF
  doc.save(`ticket-${sale.id.slice(0, 8)}.pdf`);
};