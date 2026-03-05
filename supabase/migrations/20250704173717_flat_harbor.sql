/*
  # Script de Corrección para Ventas a Crédito sin Cliente
  
  Este script debe ejecutarse ANTES del script principal para:
  1. Identificar ventas a crédito sin cliente
  2. Corregir el método de pago o asignar un cliente por defecto
  3. Permitir que el constraint se aplique correctamente
*/

-- Paso 1: Verificar cuántas ventas a crédito sin cliente existen
SELECT 
  COUNT(*) as ventas_credito_sin_cliente,
  STRING_AGG(id::text, ', ') as ids_afectados
FROM ventas 
WHERE metodo_pago = 'credito' AND cliente_id IS NULL;

-- Paso 2: Mostrar detalles de estas ventas para revisión
SELECT 
  id,
  creada_en,
  total,
  metodo_pago,
  cliente_id,
  usuario_id,
  negocio_id
FROM ventas 
WHERE metodo_pago = 'credito' AND cliente_id IS NULL
ORDER BY creada_en DESC;

-- Paso 3: OPCIÓN A - Cambiar método de pago a 'efectivo' (Recomendado si fueron errores)
-- Descomenta las siguientes líneas si quieres cambiar estas ventas a efectivo:

/*
UPDATE ventas 
SET metodo_pago = 'efectivo'
WHERE metodo_pago = 'credito' AND cliente_id IS NULL;
*/

-- Paso 4: OPCIÓN B - Crear un cliente genérico y asignarlo (Si realmente fueron créditos)
-- Descomenta las siguientes líneas si quieres mantenerlas como crédito:

/*
-- Crear cliente genérico por cada negocio que tenga ventas a crédito sin cliente
INSERT INTO clientes (nombre_completo, telefono, correo, negocio_id)
SELECT DISTINCT
  'Cliente Genérico - Crédito Histórico' as nombre_completo,
  NULL as telefono,
  NULL as correo,
  negocio_id
FROM ventas 
WHERE metodo_pago = 'credito' AND cliente_id IS NULL
ON CONFLICT DO NOTHING;

-- Asignar el cliente genérico a las ventas a crédito sin cliente
UPDATE ventas 
SET cliente_id = (
  SELECT c.id 
  FROM clientes c 
  WHERE c.negocio_id = ventas.negocio_id 
  AND c.nombre_completo = 'Cliente Genérico - Crédito Histórico'
  LIMIT 1
)
WHERE metodo_pago = 'credito' AND cliente_id IS NULL;
*/

-- Paso 5: Verificar que ya no hay ventas a crédito sin cliente
SELECT 
  COUNT(*) as ventas_credito_sin_cliente_restantes
FROM ventas 
WHERE metodo_pago = 'credito' AND cliente_id IS NULL;

-- Si el resultado es 0, puedes proceder con el script principal