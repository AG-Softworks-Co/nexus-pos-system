/*
  # Sistema de Configuración Completo
  
  1. Nuevas Tablas
    - `configuracion_negocio` - Configuraciones generales del negocio
    - `plantillas_ticket` - Plantillas personalizables para tickets
    - `temas_personalizados` - Temas de colores personalizados
    - `configuracion_impresora` - Configuración de impresoras

  2. Funcionalidades
    - Personalización completa de tickets
    - Temas de colores personalizados
    - Configuración de impresoras
    - Configuraciones generales del negocio
*/

-- Crear tabla de configuración general del negocio
CREATE TABLE IF NOT EXISTS configuracion_negocio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE UNIQUE,
  
  -- Configuración de tickets
  mostrar_logo_ticket BOOLEAN DEFAULT true,
  mostrar_nit_ticket BOOLEAN DEFAULT true,
  mostrar_direccion_ticket BOOLEAN DEFAULT true,
  mostrar_telefono_ticket BOOLEAN DEFAULT true,
  mensaje_agradecimiento TEXT DEFAULT '¡Gracias por su compra!',
  mensaje_despedida TEXT DEFAULT 'Vuelva pronto',
  
  -- Configuración de impresión
  ancho_papel_mm INTEGER DEFAULT 80 CHECK (ancho_papel_mm IN (58, 80)),
  tamaño_fuente_titulo INTEGER DEFAULT 14 CHECK (tamaño_fuente_titulo BETWEEN 10 AND 20),
  tamaño_fuente_normal INTEGER DEFAULT 9 CHECK (tamaño_fuente_normal BETWEEN 8 AND 14),
  tamaño_fuente_pequeño INTEGER DEFAULT 8 CHECK (tamaño_fuente_pequeño BETWEEN 6 AND 12),
  
  -- Configuración de colores y tema
  tema_activo TEXT DEFAULT 'default',
  color_primario TEXT DEFAULT '#6366f1',
  color_secundario TEXT DEFAULT '#8b5cf6',
  color_acento TEXT DEFAULT '#06b6d4',
  
  -- Configuración de notificaciones
  notificaciones_whatsapp BOOLEAN DEFAULT true,
  notificaciones_email BOOLEAN DEFAULT false,
  
  -- Configuración de ventas
  permitir_ventas_sin_stock BOOLEAN DEFAULT false,
  solicitar_cliente_domicilio BOOLEAN DEFAULT true,
  tiempo_estimado_domicilio INTEGER DEFAULT 45, -- minutos
  
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- Crear tabla de plantillas de ticket personalizables
CREATE TABLE IF NOT EXISTS plantillas_ticket (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  es_activa BOOLEAN DEFAULT false,
  
  -- Estructura del ticket
  mostrar_encabezado BOOLEAN DEFAULT true,
  encabezado_personalizado TEXT,
  mostrar_fecha_hora BOOLEAN DEFAULT true,
  mostrar_vendedor BOOLEAN DEFAULT true,
  mostrar_cliente BOOLEAN DEFAULT true,
  mostrar_metodo_pago BOOLEAN DEFAULT true,
  
  -- Formato de productos
  mostrar_sku BOOLEAN DEFAULT false,
  mostrar_precio_unitario BOOLEAN DEFAULT true,
  mostrar_subtotales BOOLEAN DEFAULT true,
  
  -- Pie del ticket
  mostrar_totales BOOLEAN DEFAULT true,
  mostrar_qr_codigo BOOLEAN DEFAULT false,
  texto_pie TEXT,
  
  -- Estilos
  alineacion_titulo TEXT DEFAULT 'center' CHECK (alineacion_titulo IN ('left', 'center', 'right')),
  negrita_titulo BOOLEAN DEFAULT true,
  separadores BOOLEAN DEFAULT true,
  
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- Crear tabla de temas personalizados
CREATE TABLE IF NOT EXISTS temas_personalizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  es_activo BOOLEAN DEFAULT false,
  
  -- Colores principales
  color_primario TEXT NOT NULL DEFAULT '#6366f1',
  color_primario_hover TEXT NOT NULL DEFAULT '#4f46e5',
  color_secundario TEXT NOT NULL DEFAULT '#8b5cf6',
  color_acento TEXT NOT NULL DEFAULT '#06b6d4',
  
  -- Colores de estado
  color_exito TEXT NOT NULL DEFAULT '#10b981',
  color_advertencia TEXT NOT NULL DEFAULT '#f59e0b',
  color_error TEXT NOT NULL DEFAULT '#ef4444',
  color_info TEXT NOT NULL DEFAULT '#3b82f6',
  
  -- Colores de fondo
  color_fondo TEXT NOT NULL DEFAULT '#f8fafc',
  color_fondo_tarjeta TEXT NOT NULL DEFAULT '#ffffff',
  color_fondo_sidebar TEXT NOT NULL DEFAULT '#1e293b',
  
  -- Colores de texto
  color_texto_primario TEXT NOT NULL DEFAULT '#1f2937',
  color_texto_secundario TEXT NOT NULL DEFAULT '#6b7280',
  color_texto_sidebar TEXT NOT NULL DEFAULT '#f1f5f9',
  
  -- Configuración de bordes y sombras
  radio_bordes TEXT DEFAULT 'md', -- sm, md, lg, xl
  intensidad_sombras TEXT DEFAULT 'md', -- sm, md, lg, xl
  
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- Crear tabla de configuración de impresoras
CREATE TABLE IF NOT EXISTS configuracion_impresora (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo_impresora TEXT NOT NULL CHECK (tipo_impresora IN ('termica', 'matricial', 'laser', 'inyeccion')),
  
  -- Configuración de conexión
  tipo_conexion TEXT NOT NULL CHECK (tipo_conexion IN ('usb', 'red', 'bluetooth', 'serie')),
  direccion_ip TEXT, -- Para impresoras de red
  puerto INTEGER, -- Para impresoras de red
  
  -- Configuración de papel
  ancho_papel INTEGER NOT NULL DEFAULT 80, -- mm
  alto_papel INTEGER, -- mm (null para papel continuo)
  margen_izquierdo INTEGER DEFAULT 5, -- mm
  margen_derecho INTEGER DEFAULT 5, -- mm
  margen_superior INTEGER DEFAULT 5, -- mm
  margen_inferior INTEGER DEFAULT 5, -- mm
  
  -- Configuración de impresión
  caracteres_por_linea INTEGER DEFAULT 32,
  velocidad_impresion TEXT DEFAULT 'normal' CHECK (velocidad_impresion IN ('lenta', 'normal', 'rapida')),
  densidad_impresion TEXT DEFAULT 'normal' CHECK (densidad_impresion IN ('clara', 'normal', 'oscura')),
  
  -- Configuración específica
  corte_automatico BOOLEAN DEFAULT true,
  apertura_cajon BOOLEAN DEFAULT false,
  sonido_impresion BOOLEAN DEFAULT false,
  
  es_predeterminada BOOLEAN DEFAULT false,
  activa BOOLEAN DEFAULT true,
  
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE configuracion_negocio ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantillas_ticket ENABLE ROW LEVEL SECURITY;
ALTER TABLE temas_personalizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_impresora ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view business configuration"
  ON configuracion_negocio FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage business configuration"
  ON configuracion_negocio FOR ALL
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios 
    WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
  ));

CREATE POLICY "Users can view ticket templates"
  ON plantillas_ticket FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage ticket templates"
  ON plantillas_ticket FOR ALL
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios 
    WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
  ));

CREATE POLICY "Users can view custom themes"
  ON temas_personalizados FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage custom themes"
  ON temas_personalizados FOR ALL
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios 
    WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
  ));

CREATE POLICY "Users can view printer configuration"
  ON configuracion_impresora FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage printer configuration"
  ON configuracion_impresora FOR ALL
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios 
    WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
  ));

-- Función para crear configuración por defecto al crear un negocio
CREATE OR REPLACE FUNCTION create_default_business_config()
RETURNS TRIGGER AS $$
BEGIN
  -- Crear configuración por defecto
  INSERT INTO configuracion_negocio (negocio_id) VALUES (NEW.id);
  
  -- Crear plantilla de ticket por defecto
  INSERT INTO plantillas_ticket (
    negocio_id,
    nombre,
    descripcion,
    es_activa
  ) VALUES (
    NEW.id,
    'Plantilla Estándar',
    'Plantilla de ticket por defecto del sistema',
    true
  );
  
  -- Crear tema por defecto
  INSERT INTO temas_personalizados (
    negocio_id,
    nombre,
    descripcion,
    es_activo
  ) VALUES (
    NEW.id,
    'Tema Nexus',
    'Tema por defecto de Nexus POS',
    true
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para actualizar timestamp de actualización
CREATE OR REPLACE FUNCTION update_configuration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para asegurar que solo hay un tema/plantilla activa por negocio
CREATE OR REPLACE FUNCTION ensure_single_active()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.es_activa = true OR NEW.es_activo = true THEN
    -- Desactivar otros temas/plantillas del mismo negocio
    IF TG_TABLE_NAME = 'temas_personalizados' THEN
      UPDATE temas_personalizados 
      SET es_activo = false 
      WHERE negocio_id = NEW.negocio_id AND id != NEW.id;
    ELSIF TG_TABLE_NAME = 'plantillas_ticket' THEN
      UPDATE plantillas_ticket 
      SET es_activa = false 
      WHERE negocio_id = NEW.negocio_id AND id != NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear triggers
CREATE TRIGGER create_default_business_config_trigger
  AFTER INSERT ON negocios
  FOR EACH ROW
  EXECUTE FUNCTION create_default_business_config();

CREATE TRIGGER update_configuracion_negocio_timestamp
  BEFORE UPDATE ON configuracion_negocio
  FOR EACH ROW
  EXECUTE FUNCTION update_configuration_timestamp();

CREATE TRIGGER update_plantillas_ticket_timestamp
  BEFORE UPDATE ON plantillas_ticket
  FOR EACH ROW
  EXECUTE FUNCTION update_configuration_timestamp();

CREATE TRIGGER update_temas_personalizados_timestamp
  BEFORE UPDATE ON temas_personalizados
  FOR EACH ROW
  EXECUTE FUNCTION update_configuration_timestamp();

CREATE TRIGGER ensure_single_active_theme_trigger
  BEFORE INSERT OR UPDATE ON temas_personalizados
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_active();

CREATE TRIGGER ensure_single_active_template_trigger
  BEFORE INSERT OR UPDATE ON plantillas_ticket
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_active();

-- Insertar temas predefinidos para todos los negocios existentes
INSERT INTO temas_personalizados (negocio_id, nombre, descripcion, es_activo, color_primario, color_secundario)
SELECT 
  id,
  'Tema Azul Clásico',
  'Tema azul profesional por defecto',
  true,
  '#3b82f6',
  '#1d4ed8'
FROM negocios
WHERE NOT EXISTS (
  SELECT 1 FROM temas_personalizados WHERE negocio_id = negocios.id
);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_configuracion_negocio_negocio_id ON configuracion_negocio(negocio_id);
CREATE INDEX IF NOT EXISTS idx_plantillas_ticket_negocio_id ON plantillas_ticket(negocio_id);
CREATE INDEX IF NOT EXISTS idx_plantillas_ticket_activa ON plantillas_ticket(es_activa);
CREATE INDEX IF NOT EXISTS idx_temas_personalizados_negocio_id ON temas_personalizados(negocio_id);
CREATE INDEX IF NOT EXISTS idx_temas_personalizados_activo ON temas_personalizados(es_activo);
CREATE INDEX IF NOT EXISTS idx_configuracion_impresora_negocio_id ON configuracion_impresora(negocio_id);