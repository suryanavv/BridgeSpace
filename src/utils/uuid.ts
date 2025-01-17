function generateUUIDv4(): string {
  const hex: string[] = [];
  for (let i = 0; i < 36; i++) {
    hex[i] = '0';
  }
  
  let r: number;
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      hex[i] = '-';
    } else if (i === 14) {
      hex[i] = '4';
    } else {
      if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        r = (window.crypto.getRandomValues(new Uint8Array(1))[0] & 15);
      } else {
        r = Math.floor(Math.random() * 16);
      }
      if (i === 19) {
        r = (r & 3) | 8;
      }
      hex[i] = r.toString(16);
    }
  }
  return hex.join('');
}

export const uuid = {
  generate: (): string => {
    if (typeof crypto !== 'undefined') {
      try {
        if (crypto.randomUUID) {
          return crypto.randomUUID();
        }
        // Modern browsers without randomUUID
        if (crypto.getRandomValues) {
          return generateUUIDv4();
        }
      } catch (e) {
        console.warn('Crypto API not available, falling back to Math.random');
      }
    }
    // Fallback for older browsers
    return generateUUIDv4();
  }
};
