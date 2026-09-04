/**
 * Shared environment helper for resolving the Backend API / Socket URL
 * across REST fetch calls and WebRTC Socket.io signaling.
 */

export function isLocalOrLanHost(hostname: string): boolean {
  if (!hostname) return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.lan')) return true;
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

let hasLoggedBackendUrl = false;

/**
 * Returns true if the app is running on a non-localhost production host
 * and VITE_BACKEND_URL is not configured at build time.
 */
export function isBackendConfigMissing(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  const hostname = window.location.hostname;
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  const isLocal = isLocalOrLanHost(hostname);
  return !isLocal && (!envUrl || envUrl.trim() === '');
}

/**
 * Resolves the backend base URL.
 * - If accessing via LAN IP or .local hostname on another device, dynamically routes to http(s)://<hostname>:3000.
 * - If VITE_BACKEND_URL is set, returns VITE_BACKEND_URL (substituting localhost with current LAN IP if on another device).
 * - Falls back to http(s)://<hostname>:3000.
 */
export function getBackendUrl(): string {
  const envUrl = import.meta.env.VITE_BACKEND_URL 
    ? import.meta.env.VITE_BACKEND_URL.replace(/\/+$/, '') 
    : '';

  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const isLocal = isLocalOrLanHost(hostname);

    // If accessing via LAN IP or .local from another device (phone/tablet/laptop) on local Wi-Fi,
    // point API requests to http(s)://<LAN-IP>:3000 instead of hardcoded localhost.
    if (isLocal && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      const lanFallback = `${protocol}//${hostname}:3000`;
      if (!hasLoggedBackendUrl) {
        console.log(`[Env] LAN IP detected (${hostname}), routing backend API to: ${lanFallback}`);
        hasLoggedBackendUrl = true;
      }
      return lanFallback;
    }

    if (envUrl) {
      // If envUrl points to localhost/127.0.0.1 but we are on a LAN IP on another device, dynamically patch it
      if (isLocal && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) && hostname !== 'localhost' && hostname !== '127.0.0.1') {
        const patchedEnvUrl = envUrl.replace(/localhost|127\.0\.0\.1/g, hostname);
        if (!hasLoggedBackendUrl) {
          console.log(`[Env] Patched localhost in VITE_BACKEND_URL for LAN device: ${patchedEnvUrl}`);
          hasLoggedBackendUrl = true;
        }
        return patchedEnvUrl;
      }
      if (!hasLoggedBackendUrl) {
        console.log(`[Env] Resolved backend URL from VITE_BACKEND_URL: ${envUrl}`);
        hasLoggedBackendUrl = true;
      }
      return envUrl;
    }

    if (isLocal) {
      const localFallback = `${protocol}//${hostname}:3000`;
      if (!hasLoggedBackendUrl) {
        console.log(`[Env] Local/LAN environment detected without VITE_BACKEND_URL, using fallback: ${localFallback}`);
        hasLoggedBackendUrl = true;
      }
      return localFallback;
    }

    // Production host without VITE_BACKEND_URL
    console.error(
      '🚨 [Env Error] VITE_BACKEND_URL is NOT defined in production build! ' +
      `Attempting to connect to ${hostname}:3000 will fail. ` +
      'Please set VITE_BACKEND_URL in your hosting platform dashboard (e.g., Vercel/Netlify).'
    );
    if (!hasLoggedBackendUrl) {
      hasLoggedBackendUrl = true;
    }
    return '';
  }

  return envUrl || 'http://localhost:3000';
}
