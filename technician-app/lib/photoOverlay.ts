import * as Location from 'expo-location';

/** Format like "Jan 23, 2026 at 8:39:24 AM" */
export function formatPhotoTimestamp(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${month} ${day}, ${year} at ${hours}:${mm}:${ss} ${ampm}`;
}

/** Build address lines for overlay, e.g. ["1604 Newport Ln", "Weston FL 33326", "United States"] */
function addressLinesFromGeocode(addr: {
  street?: string | null;
  streetNumber?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
}): string[] {
  const line1 = [addr.streetNumber, addr.street].filter(Boolean).join(' ').trim() || addr.street?.trim();
  const parts2 = [addr.city, addr.region, addr.postalCode].filter(Boolean);
  const line2 = parts2.join(' ').replace(/\s+/g, ' ').trim();
  const line3 = addr.country?.trim();
  const lines: string[] = [];
  if (line1) lines.push(line1);
  if (line2) lines.push(line2);
  if (line3) lines.push(line3);
  return lines;
}

export type PhotoOverlayInfo = {
  timestamp: string;
  addressLines: string[];
};

/**
 * Fetches current location, reverse-geocodes to address, and returns timestamp + address lines
 * for photo overlay. On permission/location/geocode failure, returns timestamp only.
 */
export async function getPhotoOverlayInfo(): Promise<PhotoOverlayInfo> {
  const timestamp = formatPhotoTimestamp(new Date());
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { timestamp, addressLines: [] };

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const [geocode] = await Location.reverseGeocodeAsync({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
    const addressLines = geocode ? addressLinesFromGeocode(geocode) : [];
    return { timestamp, addressLines };
  } catch {
    return { timestamp, addressLines: [] };
  }
}
