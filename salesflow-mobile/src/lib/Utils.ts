/**
 * Utils.ts
 * Shared utilities for the SalesFlow mobile app.
 */

/**
 * Converts a base64 string to a Uint8Array.
 * Useful for Supabase storage uploads in React Native where 'atob' might be missing.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = decodeBase64(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * decodes a base64 string.
 * Polyfill for 'atob' which is often missing in RN environments.
 */
export function decodeBase64(input: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = input.replace(/=+$/, '');
  let output = '';

  if (str.length % 4 === 1) {
    throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
  }

  for (
    let bc = 0, bs = 0, buffer, i = 0;
    (buffer = str.charAt(i++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = chars.indexOf(buffer);
  }

  return output;
}

/**
 * Ensures a file path has the 'file://' prefix required by some Android operations.
 */
export function ensureFileUri(path: string): string {
  if (!path) return path;
  return path.startsWith('file://') ? path : `file://${path}`;
}

/**
 * Formats a phone number into a more readable format.
 */
export function formatPhone(phone: string): string {
  if (!phone) return 'Unknown';
  // Example: 919999999999 -> +91 99999-99999
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 12) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{5})/, '+$1 $2-$3');
  }
  return phone;
}
