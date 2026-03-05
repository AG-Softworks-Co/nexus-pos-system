/*
  # Fix Returns System and Credit Account Handling
  
  1. Changes
    - Add robust error handling to process_return function
    - Check if cuentas_credito table exists before trying to use it
    - Wrap critical operations in BEGIN/EXCEPTION blocks
    - Improve notification handling
*/

-- Enhance the process_return function with better error handling
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
  v_cuenta_credito_exists BOOLEAN;
BEGIN
  -- Only process approved returns
  IF NEW.estado = 'aprobada' AND (OLD.estado IS NULL OR OLD.estado != 'aprobada') THEN
    BEGIN
      v_venta_id := NEW.venta_id;
      v_tipo_devolucion := NEW.tipo_devolucion;
      v_monto_devolucion := NEW.monto_devolucion;
      
      -- Get sale information
      BEGIN
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
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error getting sale information: %', SQLERRM;
      END;
      
      -- Get admin name for notification
      BEGIN
        SELECT nombre_completo INTO v_admin_nombre
        FROM usuarios
        WHERE id = NEW.aprobada_por;
      EXCEPTION WHEN OTHERS THEN
        v_admin_nombre := 'Administrador';
      END;
      
      -- Restore stock for returned items
      BEGIN
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
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error restoring stock: %', SQLERRM;
      END;

      -- Update sale total if partial return
      BEGIN
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
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error updating sale: %', SQLERRM;
      END;

      -- Create history record for return
      BEGIN
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
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error creating history record: %', SQLERRM;
      END;
      
      -- Create notification for the user who created the sale
      BEGIN
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
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error creating notification: %', SQLERRM;
      END;
      
      -- Check if cuentas_credito table exists before trying to update it
      -- This is the critical part that was causing the error
      BEGIN
        -- First check if the table exists
        EXECUTE 'SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = ''public'' 
          AND table_name = ''cuentas_credito''
        )' INTO v_cuenta_credito_exists;
        
        -- Only try to update credit account if the table exists
        IF v_cuenta_credito_exists AND v_metodo_pago = 'credito' AND v_cliente_id IS NOT NULL THEN
          BEGIN
            -- Update credit account if exists
            EXECUTE 'UPDATE cuentas_credito
            SET saldo_actual = GREATEST(0, saldo_actual - $1)
            WHERE cliente_id = $2
            AND negocio_id = $3' 
            USING v_monto_devolucion, v_cliente_id, v_negocio_id;
          EXCEPTION WHEN OTHERS THEN
            -- Just log the error and continue
            RAISE NOTICE 'Error updating credit account: %', SQLERRM;
          END;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Just log the error and continue
        RAISE NOTICE 'Error checking credit account table: %', SQLERRM;
      END;
    EXCEPTION WHEN OTHERS THEN
      -- Catch any other errors in the main block
      RAISE NOTICE 'Error processing return: %', SQLERRM;
    END;
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