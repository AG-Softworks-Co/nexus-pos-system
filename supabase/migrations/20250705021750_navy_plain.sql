/*
  # Enhance Returns System
  
  1. Changes
    - Improve process_return function to notify admins when a return is approved
    - Add notification to the user who created the return
    - Update sale status and credit balance properly
    - Fix edge cases in return processing
*/

-- Enhance the process_return function to provide better notifications and handling
CREATE OR REPLACE FUNCTION process_return()
RETURNS TRIGGER AS $$
DECLARE
  v_detalle RECORD;
  v_venta_id UUID;
  v_tipo_devolucion TEXT;
  v_monto_devolucion NUMERIC;
  v_negocio_id UUID;
  v_usuario_id UUID;
  v_cliente_id UUID;
  v_metodo_pago TEXT;
  v_admin_nombre TEXT;
BEGIN
  -- Only process approved returns
  IF NEW.estado = 'aprobada' AND (OLD.estado IS NULL OR OLD.estado != 'aprobada') THEN
    v_venta_id := NEW.venta_id;
    v_tipo_devolucion := NEW.tipo_devolucion;
    v_monto_devolucion := NEW.monto_devolucion;
    
    -- Get sale information
    SELECT 
      negocio_id, 
      usuario_id,
      cliente_id,
      metodo_pago
    INTO 
      v_negocio_id,
      v_usuario_id,
      v_cliente_id,
      v_metodo_pago
    FROM ventas 
    WHERE id = v_venta_id;
    
    -- Get admin name for notification
    SELECT nombre_completo INTO v_admin_nombre
    FROM usuarios
    WHERE id = NEW.aprobada_por;
    
    -- Restore stock for returned items
    FOR v_detalle IN (
      SELECT 
        dd.cantidad_devuelta,
        dv.producto_id
      FROM detalle_devoluciones dd
      JOIN detalle_ventas dv ON dd.detalle_venta_id = dv.id
      WHERE dd.devolucion_id = NEW.id
    ) LOOP
      -- Restore product stock
      UPDATE productos
      SET stock_actual = stock_actual + v_detalle.cantidad_devuelta
      WHERE id = v_detalle.producto_id
      AND requiere_stock = true;
    END LOOP;

    -- Update sale total if partial return
    IF v_tipo_devolucion = 'parcial' THEN
      UPDATE ventas
      SET 
        total = total - v_monto_devolucion,
        saldo_pendiente = GREATEST(0, saldo_pendiente - v_monto_devolucion),
        -- Update payment status if needed
        estado_pago = CASE 
          WHEN metodo_pago = 'credito' AND (saldo_pendiente - v_monto_devolucion) <= 0 THEN 'pagado'
          WHEN metodo_pago = 'credito' AND (saldo_pendiente - v_monto_devolucion) > 0 THEN estado_pago
          ELSE 'pagado'
        END
      WHERE id = v_venta_id;
    ELSE
      -- Full return - cancel the sale
      UPDATE ventas
      SET 
        estado = 'cancelada',
        estado_pago = 'pagado',
        saldo_pendiente = 0
      WHERE id = v_venta_id;
    END IF;

    -- Create history record for return
    INSERT INTO historial_ventas (
      venta_id,
      usuario_id,
      accion,
      razon
    ) VALUES (
      v_venta_id,
      NEW.aprobada_por,
      'devolucion',
      'Devolución ' || v_tipo_devolucion || ' por: ' || NEW.razon || 
      '. Monto: $' || v_monto_devolucion || '. Aprobada por: ' || v_admin_nombre
    );
    
    -- Create notification for the user who created the sale
    IF v_usuario_id IS NOT NULL THEN
      INSERT INTO notificaciones (
        usuario_id,
        titulo,
        mensaje,
        leido
      ) VALUES (
        v_usuario_id,
        'Devolución aprobada',
        'La devolución ' || v_tipo_devolucion || ' de la venta #' || 
        substring(v_venta_id::text, 1, 8) || ' por $' || v_monto_devolucion || 
        ' ha sido aprobada por ' || v_admin_nombre,
        false
      );
    END IF;
    
    -- If it was a credit sale, adjust credit balance if needed
    IF v_metodo_pago = 'credito' AND v_cliente_id IS NOT NULL THEN
      -- Update credit account if exists
      UPDATE cuentas_credito
      SET saldo_actual = GREATEST(0, saldo_actual - v_monto_devolucion)
      WHERE cliente_id = v_cliente_id
      AND negocio_id = v_negocio_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger for return processing
DROP TRIGGER IF EXISTS process_return_trigger ON devoluciones;
CREATE TRIGGER process_return_trigger
  AFTER UPDATE OF estado ON devoluciones
  FOR EACH ROW
  EXECUTE FUNCTION process_return();

-- Add a function to notify admins when a new return is created
CREATE OR REPLACE FUNCTION notify_return_created()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
  v_venta_info TEXT;
BEGIN
  -- Get sale reference for notification
  SELECT '#' || substring(id::text, 1, 8) INTO v_venta_info
  FROM ventas
  WHERE id = NEW.venta_id;
  
  -- Notify all admins in the business
  FOR v_admin_id IN (
    SELECT id FROM usuarios
    WHERE negocio_id = NEW.negocio_id
    AND rol IN ('propietario', 'administrador')
  ) LOOP
    INSERT INTO notificaciones (
      usuario_id,
      titulo,
      mensaje,
      leido
    ) VALUES (
      v_admin_id,
      'Nueva solicitud de devolución',
      'Se ha creado una solicitud de devolución ' || NEW.tipo_devolucion || 
      ' para la venta ' || v_venta_info || ' por $' || NEW.monto_devolucion || 
      '. Requiere aprobación.',
      false
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new return notifications
DROP TRIGGER IF EXISTS notify_return_created_trigger ON devoluciones;
CREATE TRIGGER notify_return_created_trigger
  AFTER INSERT ON devoluciones
  FOR EACH ROW
  EXECUTE FUNCTION notify_return_created();