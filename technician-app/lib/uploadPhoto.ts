/**
 * Get a body suitable for Supabase storage.upload() from a photo URI.
 * Uses fetch for http(s) and expo-file-system/legacy for local file URIs (file://, ph://, etc.)
 * so uploads work reliably on iOS/Android.
 */
import * as FileSystem from 'expo-file-system/legacy';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  let binary: string;
  if (typeof atob !== 'undefined') {
    binary = atob(base64);
  } else {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
    base64 = base64.replace(/=+$/, '');
    const bytes = new Uint8Array((base64.length * 3) >> 2);
    let p = 0;
    for (let i = 0; i < base64.length; i += 4) {
      const a = lookup[base64.charCodeAt(i)];
      const b = lookup[base64.charCodeAt(i + 1)];
      const c = i + 2 < base64.length ? lookup[base64.charCodeAt(i + 2)] : 0;
      const d = i + 3 < base64.length ? lookup[base64.charCodeAt(i + 3)] : 0;
      bytes[p++] = (a << 2) | (b >> 4);
      if (p < bytes.length) bytes[p++] = ((b & 15) << 4) | (c >> 2);
      if (p < bytes.length) bytes[p++] = ((c & 3) << 6) | d;
    }
    return bytes.buffer;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function isLocalUri(uri: string): boolean {
  return /^(file:\/\/|ph:\/\/|content:\/\/)/i.test(uri);
}

/** view-shot and some APIs return a path without file://; normalize for FileSystem. */
function toFileUri(uri: string): string {
  if (isLocalUri(uri)) return uri;
  if (uri.startsWith('/')) return `file://${uri}`;
  return uri;
}

export async function getUploadBodyFromUri(uri: string): Promise<ArrayBuffer | Blob> {
  const fileUri = toFileUri(uri);
  if (isLocalUri(fileUri) || fileUri.startsWith('file://')) {
    try {
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64ToArrayBuffer(base64);
    } catch {
      // Fallback for schemes like ph:// that legacy may not support
    }
  }
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  return response.blob();
}
