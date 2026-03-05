/*
  # Sistema de Seguimiento de Domicilios
  
  1. Nuevas Tablas
    - `estados_domicilio` - Estados del proceso de entrega
    - `seguimiento_domicilios` - Tracking de cada domicilio
    - `historial_seguimiento` - Historial de cambios de estado
    - `notificaciones_whatsapp` - Log de notificaciones enviadas

  2. Funcionalidades
    - Estados: pendiente, preparando, listo, despachado, entregado, cancelado
    - Tracking completo con timestamps
    - Notificaciones automáticas por WhatsApp
    - Estimación de tiempo de entrega
*/

-- Crear enum para estados de domicilio
CREATE TYPE estado_domicilio AS ENUM (
  'pendiente',     -- Pedido recibido
  'preparando',    -- En preparación
  'listo',         -- Listo para despacho
  'despachado',    -- En camino
  'entregado',     -- Entregado exitosamente
  'cancelado'      -- Cancelado
);

-- Tabla de configuración de estados (para personalización futura)
CREATE TABLE IF NOT EXISTS estados_domicilio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estado estado_domicilio NOT NULL UNIQUE,
  nombre_display TEXT NOT NULL,
  descripcion TEXT,
  color_hex TEXT DEFAULT '#6B7280',
  orden INTEGER NOT NULL,
  activo BOOLEAN DEFAULT true,
  tiempo_estimado_minutos INTEGER, -- Tiempo estimado para este estado
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Tabla principal de seguimiento de domicilios
CREATE TABLE IF NOT EXISTS seguimiento_domicilios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID REFERENCES ventas(id) ON DELETE CASCADE NOT NULL,
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE NOT NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  direccion_entrega_id UUID REFERENCES direcciones_entrega(id) ON DELETE SET NULL,
  
  -- Estado actual
  estado_actual estado_domicilio DEFAULT 'pendiente',
  
  -- Información del repartidor
  repartidor_nombre TEXT,
  repartidor_telefono TEXT,
  
  -- Tiempos de seguimiento
  fecha_pedido TIMESTAMPTZ DEFAULT now(),
  fecha_preparacion TIMESTAMPTZ,
  fecha_listo TIMESTAMPTZ,
  fecha_despacho TIMESTAMPTZ,
  fecha_entrega TIMESTAMPTZ,
  fecha_cancelacion TIMESTAMPTZ,
  
  -- Estimaciones
  tiempo_estimado_entrega TIMESTAMPTZ,
  
  -- Información adicional
  notas_preparacion TEXT,
  notas_despacho TEXT,
  notas_entrega TEXT,
  motivo_cancelacion TEXT,
  
  -- Notificaciones
  notificacion_enviada_preparando BOOLEAN DEFAULT false,
  notificacion_enviada_listo BOOLEAN DEFAULT false,
  notificacion_enviada_despachado BOOLEAN DEFAULT false,
  notificacion_enviada_entregado BOOLEAN DEFAULT false,
  
  -- Calificación del cliente (opcional)
  calificacion INTEGER CHECK (calificacion >= 1 AND calificacion <= 5),
  comentario_cliente TEXT,
  
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- Tabla de historial de cambios de estado
CREATE TABLE IF NOT EXISTS historial_seguimiento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seguimiento_id UUID REFERENCES seguimiento_domicilios(id) ON DELETE CASCADE NOT NULL,
  estado_anterior estado_domicilio,
  estado_nuevo estado_domicilio NOT NULL,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  notas TEXT,
  timestamp_cambio TIMESTAMPTZ DEFAULT now()
);

-- Tabla de notificaciones WhatsApp enviadas
CREATE TABLE IF NOT EXISTS notificaciones_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seguimiento_id UUID REFERENCES seguimiento_domicilios(id) ON DELETE CASCADE NOT NULL,
  telefono_destino TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  estado_notificacion TEXT NOT NULL, -- 'enviado', 'entregado', 'leido', 'fallido'
  tipo_notificacion TEXT NOT NULL, -- 'estado_cambio', 'recordatorio', 'encuesta'
  fecha_envio TIMESTAMPTZ DEFAULT now(),
  fecha_entrega TIMESTAMPTZ,
  fecha_lectura TIMESTAMPTZ,
  error_mensaje TEXT,
  proveedor TEXT DEFAULT 'whatsapp' -- Para futuras integraciones
);

-- Insertar estados por defecto
INSERT INTO estados_domicilio (estado, nombre_display, descripcion, color_hex, orden, tiempo_estimado_minutos) VALUES
('pendiente', 'Pedido Recibido', 'El pedido ha sido recibido y está en cola', '#6B7280', 1, 5),
('preparando', 'En Preparación', 'El pedido está siendo preparado', '#F59E0B', 2, 15),
('listo', 'Listo para Despacho', 'El pedido está listo y esperando al repartidor', '#10B981', 3, 5),
('despachado', 'En Camino', 'El pedido está en camino hacia su destino', '#3B82F6', 4, 30),
('entregado', 'Entregado', 'El pedido ha sido entregado exitosamente', '#059669', 5, 0),
('cancelado', 'Cancelado', 'El pedido ha sido cancelado', '#DC2626', 6, 0);

-- Enable RLS
ALTER TABLE estados_domicilio ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguimiento_domicilios ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_seguimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones_whatsapp ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can view delivery states"
  ON estados_domicilio FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view delivery tracking from their business"
  ON seguimiento_domicilios FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Users can manage delivery tracking from their business"
  ON seguimiento_domicilios FOR ALL
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Users can view tracking history from their business"
  ON historial_seguimiento FOR SELECT
  USING (seguimiento_id IN (
    SELECT id FROM seguimiento_domicilios WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can create tracking history"
  ON historial_seguimiento FOR INSERT
  WITH CHECK (seguimiento_id IN (
    SELECT id FROM seguimiento_domicilios WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can view WhatsApp notifications from their business"
  ON notificaciones_whatsapp FOR SELECT
  USING (seguimiento_id IN (
    SELECT id FROM seguimiento_domicilios WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

CREATE POLICY "System can manage WhatsApp notifications"
  ON notificaciones_whatsapp FOR ALL
  USING (seguimiento_id IN (
    SELECT id FROM seguimiento_domicilios WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

-- Función para crear seguimiento automático cuando se crea una venta de domicilio
CREATE OR REPLACE FUNCTION create_delivery_tracking()
RETURNS TRIGGER AS $$
DECLARE
  v_tiempo_estimado TIMESTAMPTZ;
BEGIN
  -- Solo crear tracking para domicilios
  IF NEW.es_domicilio = true THEN
    -- Calcular tiempo estimado (45 minutos por defecto)
    v_tiempo_estimado := NEW.creada_en + INTERVAL '45 minutes';
    
    INSERT INTO seguimiento_domicilios (
      venta_id,
      negocio_id,
      cliente_id,
      direccion_entrega_id,
      estado_actual,
      fecha_pedido,
      tiempo_estimado_entrega
    ) VALUES (
      NEW.id,
      NEW.negocio_id,
      NEW.cliente_id,
      NEW.direccion_entrega_id,
      'pendiente',
      NEW.creada_en,
      v_tiempo_estimado
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para actualizar estado y crear historial
CREATE OR REPLACE FUNCTION update_delivery_status()
RETURNS TRIGGER AS $$
DECLARE
  v_estado_anterior estado_domicilio;
BEGIN
  -- Obtener estado anterior
  v_estado_anterior := OLD.estado_actual;
  
  -- Actualizar timestamps según el nuevo estado
  CASE NEW.estado_actual
    WHEN 'preparando' THEN
      NEW.fecha_preparacion := COALESCE(NEW.fecha_preparacion, now());
    WHEN 'listo' THEN
      NEW.fecha_listo := COALESCE(NEW.fecha_listo, now());
    WHEN 'despachado' THEN
      NEW.fecha_despacho := COALESCE(NEW.fecha_despacho, now());
    WHEN 'entregado' THEN
      NEW.fecha_entrega := COALESCE(NEW.fecha_entrega, now());
    WHEN 'cancelado' THEN
      NEW.fecha_cancelacion := COALESCE(NEW.fecha_cancelacion, now());
    ELSE
      -- No hacer nada para 'pendiente'
  END CASE;
  
  -- Actualizar timestamp de modificación
  NEW.actualizado_en := now();
  
  -- Crear registro en historial si cambió el estado
  IF v_estado_anterior IS DISTINCT FROM NEW.estado_actual THEN
    INSERT INTO historial_seguimiento (
      seguimiento_id,
      estado_anterior,
      estado_nuevo,
      usuario_id
    ) VALUES (
      NEW.id,
      v_estado_anterior,
      NEW.estado_actual,
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para generar mensaje de WhatsApp según el estado
CREATE OR REPLACE FUNCTION generate_whatsapp_message(
  p_estado estado_domicilio,
  p_cliente_nombre TEXT,
  p_venta_id TEXT,
  p_tiempo_estimado TIMESTAMPTZ DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_mensaje TEXT;
  v_tiempo_texto TEXT;
BEGIN
  -- Generar texto de tiempo estimado si aplica
  IF p_tiempo_estimado IS NOT NULL THEN
    v_tiempo_texto := to_char(p_tiempo_estimado, 'HH24:MI');
  END IF;
  
  -- Generar mensaje según el estado
  CASE p_estado
    WHEN 'preparando' THEN
      v_mensaje := '🍽️ ¡Hola ' || p_cliente_nombre || '! Tu pedido #' || substring(p_venta_id, 1, 8) || 
                   ' está siendo preparado con mucho cariño. Te notificaremos cuando esté listo. ¡Gracias por tu paciencia!';
    
    WHEN 'listo' THEN
      v_mensaje := '✅ ¡Perfecto ' || p_cliente_nombre || '! Tu pedido #' || substring(p_venta_id, 1, 8) || 
                   ' está listo y esperando al repartidor. Pronto estará en camino hacia ti.';
    
    WHEN 'despachado' THEN
      v_mensaje := '🚗 ¡En camino ' || p_cliente_nombre || '! Tu pedido #' || substring(p_venta_id, 1, 8) || 
                   ' ya salió y está en camino hacia tu dirección.' ||
                   CASE WHEN v_tiempo_texto IS NOT NULL THEN ' Tiempo estimado de llegada: ' || v_tiempo_texto ELSE '' END ||
                   ' ¡Prepárate para recibirlo!';
    
    WHEN 'entregado' THEN
      v_mensaje := '🎉 ¡Entregado ' || p_cliente_nombre || '! Tu pedido #' || substring(p_venta_id, 1, 8) || 
                   ' ha sido entregado exitosamente. ¡Esperamos que lo disfrutes! Califícanos: [link_calificacion]';
    
    WHEN 'cancelado' THEN
      v_mensaje := '❌ Lamentamos informarte ' || p_cliente_nombre || ' que tu pedido #' || substring(p_venta_id, 1, 8) || 
                   ' ha sido cancelado. Nos pondremos en contacto contigo para más información.';
    
    ELSE
      v_mensaje := 'Actualización de tu pedido #' || substring(p_venta_id, 1, 8) || ': ' || p_estado;
  END CASE;
  
  RETURN v_mensaje;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para enviar notificación WhatsApp (simulada)
CREATE OR REPLACE FUNCTION send_whatsapp_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_cliente_nombre TEXT;
  v_cliente_telefono TEXT;
  v_venta_id TEXT;
  v_mensaje TEXT;
  v_debe_notificar BOOLEAN := false;
BEGIN
  -- Solo procesar si cambió el estado
  IF OLD.estado_actual IS DISTINCT FROM NEW.estado_actual THEN
    
    -- Obtener información del cliente
    SELECT c.nombre_completo, c.telefono, v.id
    INTO v_cliente_nombre, v_cliente_telefono, v_venta_id
    FROM clientes c
    JOIN ventas v ON v.cliente_id = c.id
    WHERE v.id = NEW.venta_id;
    
    -- Verificar si debe enviar notificación para este estado
    CASE NEW.estado_actual
      WHEN 'preparando' THEN
        v_debe_notificar := NOT NEW.notificacion_enviada_preparando;
      WHEN 'listo' THEN
        v_debe_notificar := NOT NEW.notificacion_enviada_listo;
      WHEN 'despachado' THEN
        v_debe_notificar := NOT NEW.notificacion_enviada_despachado;
      WHEN 'entregado' THEN
        v_debe_notificar := NOT NEW.notificacion_enviada_entregado;
      ELSE
        v_debe_notificar := false;
    END CASE;
    
    -- Enviar notificación si es necesario y hay teléfono
    IF v_debe_notificar AND v_cliente_telefono IS NOT NULL THEN
      -- Generar mensaje
      v_mensaje := generate_whatsapp_message(
        NEW.estado_actual,
        v_cliente_nombre,
        v_venta_id,
        NEW.tiempo_estimado_entrega
      );
      
      -- Registrar notificación (en producción aquí iría la integración real con WhatsApp)
      INSERT INTO notificaciones_whatsapp (
        seguimiento_id,
        telefono_destino,
        mensaje,
        estado_notificacion,
        tipo_notificacion
      ) VALUES (
        NEW.id,
        v_cliente_telefono,
        v_mensaje,
        'enviado', -- En producción sería el estado real de la API
        'estado_cambio'
      );
      
      -- Marcar como notificado
      CASE NEW.estado_actual
        WHEN 'preparando' THEN
          NEW.notificacion_enviada_preparando := true;
        WHEN 'listo' THEN
          NEW.notificacion_enviada_listo := true;
        WHEN 'despachado' THEN
          NEW.notificacion_enviada_despachado := true;
        WHEN 'entregado' THEN
          NEW.notificacion_enviada_entregado := true;
      END CASE;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear triggers
CREATE TRIGGER create_delivery_tracking_trigger
  AFTER INSERT ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION create_delivery_tracking();

CREATE TRIGGER update_delivery_status_trigger
  BEFORE UPDATE ON seguimiento_domicilios
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_status();

CREATE TRIGGER send_whatsapp_notification_trigger
  AFTER UPDATE ON seguimiento_domicilios
  FOR EACH ROW
  EXECUTE FUNCTION send_whatsapp_notification();

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_seguimiento_domicilios_negocio_id ON seguimiento_domicilios(negocio_id);
CREATE INDEX IF NOT EXISTS idx_seguimiento_domicilios_estado ON seguimiento_domicilios(estado_actual);
CREATE INDEX IF NOT EXISTS idx_seguimiento_domicilios_fecha_pedido ON seguimiento_domicilios(fecha_pedido);
CREATE INDEX IF NOT EXISTS idx_seguimiento_domicilios_venta_id ON seguimiento_domicilios(venta_id);
CREATE INDEX IF NOT EXISTS idx_historial_seguimiento_seguimiento_id ON historial_seguimiento(seguimiento_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_whatsapp_seguimiento_id ON notificaciones_whatsapp(seguimiento_id);