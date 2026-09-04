/**
 * Web Push Notifications Helper for Mindroot
 * Handles Service Worker registration, browser permission requests,
 * native Notification triggering, and backend push subscriptions.
 */

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
}

let swRegistration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('[Push Notifications] Service Worker not supported in this browser.');
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    swRegistration = reg;
    console.log('[Push Notifications] Service Worker registered successfully:', reg.scope);
    return reg;
  } catch (err) {
    console.error('[Push Notifications] Service Worker registration failed:', err);
    return null;
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermissionStatus(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    console.warn('[Push Notifications] Notifications are not supported in this browser.');
    return 'denied';
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      console.log('[Push Notifications] Notification permission granted.');
      await registerServiceWorker();
    } else {
      console.warn('[Push Notifications] Notification permission was:', perm);
    }
    return perm;
  } catch (err) {
    console.error('[Push Notifications] Error requesting notification permission:', err);
    return 'denied';
  }
}

export async function triggerNativeNotification(payload: PushNotificationPayload): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  const title = payload.title || 'Mindroot Alert';
  const options: NotificationOptions = {
    body: payload.body,
    icon: payload.icon || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
    tag: payload.tag || 'mindroot-general',
    data: { url: payload.url || '/dashboard' }
  };

  try {
    if (swRegistration && swRegistration.showNotification) {
      await swRegistration.showNotification(title, options);
      return true;
    } else {
      const n = new Notification(title, options);
      n.onclick = (e) => {
        e.preventDefault();
        window.focus();
        if (payload.url) {
          window.location.href = payload.url;
        }
      };
      return true;
    }
  } catch (err) {
    console.warn('[Push Notifications] Native notification trigger warning:', err);
    return false;
  }
}
