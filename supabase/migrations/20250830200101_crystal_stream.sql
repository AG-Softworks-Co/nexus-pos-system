/*
  # Arreglar cálculo de descuentos que causa totales en $0
  
  1. Cambios
    - Corregir función calculate_sale_totals_with_discounts
    - Asegurar que ventas sin descuento mantengan su total original
    - Separar lógica de descuentos de cálculo de totales normales
    - Mantener compatibilidad con ventas existentes
*/

-- Función corregida para calcular totales con descuentos
CREATE OR REPLACE FUNCTION calculate_sale_totals_with_discounts()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal NUMERIC(10,2);
  v_descuento_monto NUMERIC(10,2) := 0;
  v_total_final NUMERIC(10,2);
BEGIN
  -- Calcular subtotal de los detalles de venta
  SELECT COALESCE(SUM(cantidad * precio_unitario), 0)
  INTO v_subtotal
  FROM detalle_ventas
  WHERE venta_id = NEW.id;

  -- Solo procesar descuentos si realmente hay descuentos aplicados
  IF NEW.descuento_porcentaje_total > 0 OR NEW.descuento_total > 0 THEN
    -- Guardar subtotal antes del descuento
    NEW.subtotal_antes_descuento = v_subtotal;

    -- Calcular monto del descuento
    IF NEW.descuento_porcentaje_total > 0 THEN
      v_descuento_monto = v_subtotal * (NEW.descuento_porcentaje_total / 100);
    ELSE
      v_descuento_monto = COALESCE(NEW.descuento_total, 0);
    END IF;

    -- Asegurar que el descuento no exceda el subtotal
    v_descuento_monto = LEAST(v_descuento_monto, v_subtotal);
    NEW.descuento_total = v_descuento_monto;
  ELSE
    -- Si no hay descuentos, asegurar que los campos estén en 0
    NEW.descuento_total = 0;
    NEW.descuento_porcentaje_total = 0;
    NEW.subtotal_antes_descuento = v_subtotal;
    v_descuento_monto = 0;
  END IF;

  -- Calcular total final (incluyendo costo de domicilio)
  v_total_final = v_subtotal - v_descuento_monto + COALESCE(NEW.costo_domicilio, 0);
  NEW.total = v_total_final;

  -- Configurar saldo pendiente para ventas a crédito
  IF NEW.metodo_pago = 'credito' THEN
    NEW.saldo_pendiente = v_total_final;
    NEW.estado_pago = 'pendiente';
    
    -- Establecer fecha de vencimiento si no se proporcionó
    IF NEW.fecha_vencimiento_credito IS NULL THEN
      NEW.fecha_vencimiento_credito = NEW.creada_en + INTERVAL '30 days';
    END IF;
  ELSE
    NEW.saldo_pendiente = 0;
    NEW.estado_pago = 'pagado';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función corregida para registrar descuentos aplicados
CREATE OR REPLACE FUNCTION register_discount_application()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo registrar si realmente se aplicó un descuento
  IF (NEW.descuento_total > 0 OR NEW.descuento_porcentaje_total > 0) AND NEW.usuario_descuento_id IS NOT NULL THEN
    INSERT INTO descuentos_aplicados (
      venta_id,
      negocio_id,
      usuario_id,
      tipo_descuento,
      valor_descuento,
      monto_descontado,
      razon,
      aplicado_a
    ) VALUES (
      NEW.id,
      NEW.negocio_id,
      NEW.usuario_descuento_id,
      CASE 
        WHEN NEW.descuento_porcentaje_total > 0 THEN 'porcentaje_total'
        ELSE 'monto_total'
      END,
      CASE 
        WHEN NEW.descuento_porcentaje_total > 0 THEN NEW.descuento_porcentaje_total
        ELSE NEW.descuento_total
      END,
      NEW.descuento_total,
      COALESCE(NEW.razon_descuento, 'Descuento aplicado'),
      'total'
    );
    
    -- Registrar en historial
    INSERT INTO historial_ventas (
      venta_id,
      usuario_id,
      accion,
      razon
    ) VALUES (
      NEW.id,
      NEW.usuario_descuento_id,
      'descuento',
      'Descuento aplicado: $' || NEW.descuento_total || 
      CASE 
        WHEN NEW.descuento_porcentaje_total > 0 THEN ' (' || NEW.descuento_porcentaje_total || '%)'
        ELSE ''
      END ||
      '. Razón: ' || COALESCE(NEW.razon_descuento, 'Sin especificar')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear triggers con orden correcto
DROP TRIGGER IF EXISTS calculate_sale_totals_with_discounts_trigger ON ventas;
DROP TRIGGER IF EXISTS register_discount_application_trigger ON ventas;

-- Crear trigger para cálculo de totales ANTES de insertar
CREATE TRIGGER calculate_sale_totals_with_discounts_trigger
  BEFORE INSERT OR UPDATE ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION calculate_sale_totals_with_discounts();

-- Crear trigger para registro de descuentos DESPUÉS de insertar
CREATE TRIGGER register_discount_application_trigger
  AFTER INSERT OR UPDATE ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION register_discount_application();

-- Arreglar ventas existentes que tienen total en $0
UPDATE ventas 
SET total = (
  SELECT COALESCE(SUM(cantidad * precio_unitario), 0) + COALESCE(costo_domicilio, 0)
  FROM detalle_ventas 
  WHERE venta_id = ventas.id
)
WHERE total = 0 AND EXISTS (
  SELECT 1 FROM detalle_ventas WHERE venta_id = ventas.id
);