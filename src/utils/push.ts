// src/utils/push.ts
import { supabase } from '../lib/supabase';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeUserToPush(userId: string, negocioId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check if permission is already granted
    if (Notification.permission === 'denied') {
      console.warn('Push permission denied');
      return;
    }

    const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!publicVapidKey) {
      console.error('Missing VITE_VAPID_PUBLIC_KEY');
      return;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
    });

    console.log('User is subscribed:', subscription);

    // Store subscription in Supabase
    const { error } = await supabase
      .from('notificaciones_suscripciones')
      .upsert({
        usuario_id: userId,
        negocio_id: negocioId,
        suscripcion: subscription.toJSON(),
        dispositivo: navigator.userAgent,
        actualizado_en: new Date().toISOString()
      }, {
        onConflict: 'usuario_id, dispositivo'
      });

    if (error) {
      console.error('Error saving subscription to Supabase:', error);
    } else {
      console.log('Subscription saved successfully');
    }

  } catch (err) {
    console.error('Failed to subscribe the user: ', err);
  }
}
