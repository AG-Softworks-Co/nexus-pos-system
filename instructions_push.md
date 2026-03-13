# Configuración de Notificaciones Push (Background)

Para que las notificaciones lleguen al móvil incluso con el navegador cerrado, se requiere configurar la base de datos y una función en Supabase.

## 1. SQL: Tabla de Suscripciones

Ejecuta este código en el **SQL Editor** de Supabase para guardar los tokens de los dispositivos:

```sql
-- Crear tabla de suscripciones push
create table if not exists public.notificaciones_suscripciones (
  id uuid default gen_random_uuid() primary key,
  usuario_id uuid references auth.users(id) on delete cascade,
  negocio_id uuid references public.negocios(id) on delete cascade,
  suscripcion jsonb not null,
  dispositivo text,
  creado_en timestamp with time zone default now(),
  actualizado_en timestamp with time zone default now(),
  unique(usuario_id, dispositivo)
);

-- Habilitar RLS
alter table public.notificaciones_suscripciones enable row level security;

-- Políticas
create policy "Usuarios pueden manejar sus suscripciones"
  on public.notificaciones_suscripciones
  for all
  using (auth.uid() = usuario_id);
```

## 2. Variables de Entorno (Secrets)

En el panel de Supabase (**Settings > Edge Functions**), añade estos secrets:
- `VAPID_PUBLIC_KEY`: `BJvSi0DD52RbSe4LnGWUpOqUrF4AMbbilqcYxdJ29LxKCcAPTpqwFmvOwm1bce0NgabDm33sUgUKnMPWhRt6H62w`
- `VAPID_PRIVATE_KEY`: `57EKkaRS0L6AhrcYtpSTOkevtLtOPQrfkehXqxZ1PkQ`

## 3. Lógica de Envío (Edge Function)

Cuando estés listo para habilitar el envío automático, puedes crear una Edge Function que escuche cambios en la tabla `ventas` y envíe el push usando una librería como `web-push`.

> [!NOTE]
> Por ahora, la aplicación ya está configurada para:
> 1.  Filtrar ventas por negocio (Realtime).
> 2.  Redirigir al detalle de la venta al hacer clic.
> 3.  Instalarse como PWA (App móvil) con un icono premium.
