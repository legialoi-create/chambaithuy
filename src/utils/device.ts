export type EffectiveDeviceType = 'mobile' | 'desktop';

const STORAGE_KEY = 'tro_ly_cham_van_device_mode';

/**
 * Checks if the actual environment is a touch mobile/tablet device
 * based on userAgent, maxTouchPoints, and platform, NOT window.innerWidth alone!
 */
export function detectHardwareDevice(): EffectiveDeviceType {
  if (typeof window === 'undefined') return 'desktop';

  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  
  // Explicit mobile operating systems
  const isMobileOS = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua);
  
  // Touch device check + coarse pointer (standard for mobile devices)
  const hasTouch = ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 1);
  const isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  if (isMobileOS || (hasTouch && isCoarsePointer)) {
    return 'mobile';
  }

  return 'desktop';
}

export function getSavedDeviceMode(): 'auto' | 'mobile' | 'desktop' {
  if (typeof window === 'undefined') return 'auto';
  return (localStorage.getItem(STORAGE_KEY) as any) || 'auto';
}

export function saveDeviceMode(mode: 'auto' | 'mobile' | 'desktop') {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, mode);
}

export function getEffectiveDeviceType(): EffectiveDeviceType {
  const saved = getSavedDeviceMode();
  if (saved === 'mobile') return 'mobile';
  if (saved === 'desktop') return 'desktop';
  return detectHardwareDevice();
}
