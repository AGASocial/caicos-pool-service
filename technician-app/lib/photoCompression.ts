/**
 * Photo Compression Utility for Technician App
 * Compresses photos to reduce storage and bandwidth usage according to plan limits
 */

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export interface CompressedPhoto {
  /** URI of the compressed full-size photo */
  uri: string;
  /** URI of the thumbnail (320px max dimension) */
  thumbUri: string;
  /** Original dimensions */
  originalWidth: number;
  originalHeight: number;
  /** Compressed dimensions */
  width: number;
  height: number;
  /** Thumbnail dimensions */
  thumbWidth: number;
  thumbHeight: number;
}

const MAX_DIMENSION = 1600; // Long edge of full-size photo
const THUMB_MAX_DIMENSION = 320; // Thumbnail size
const FULL_QUALITY = 0.6; // Full-size JPEG quality
const THUMB_QUALITY = 0.7; // Thumbnail JPEG quality

/**
 * Calculate dimensions to fit within max dimension while maintaining aspect ratio
 */
function calculateResizeDimensions(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  const aspectRatio = width / height;
  const longerSide = Math.max(width, height);

  if (longerSide <= maxDimension) {
    return { width, height }; // Already within limit
  }

  if (width > height) {
    return {
      width: maxDimension,
      height: Math.round(maxDimension / aspectRatio),
    };
  } else {
    return {
      width: Math.round(maxDimension * aspectRatio),
      height: maxDimension,
    };
  }
}

/**
 * Compress a photo and generate a thumbnail
 * @param uri - Original photo URI
 * @param originalWidth - Original width (if known)
 * @param originalHeight - Original height (if known)
 * @returns Compressed photo with full-size and thumbnail URIs
 */
export async function compressPhoto(
  uri: string,
  originalWidth?: number,
  originalHeight?: number
): Promise<CompressedPhoto> {
  // Step 1: Compress full-size photo
  const fullDimensions = calculateResizeDimensions(
    originalWidth || MAX_DIMENSION,
    originalHeight || MAX_DIMENSION,
    MAX_DIMENSION
  );

  const fullCompressed = await manipulateAsync(
    uri,
    [{ resize: fullDimensions }],
    { compress: FULL_QUALITY, format: SaveFormat.JPEG }
  );

  // Step 2: Generate thumbnail
  const thumbDimensions = calculateResizeDimensions(
    fullCompressed.width,
    fullCompressed.height,
    THUMB_MAX_DIMENSION
  );

  const thumbnail = await manipulateAsync(
    fullCompressed.uri,
    [{ resize: thumbDimensions }],
    { compress: THUMB_QUALITY, format: SaveFormat.JPEG }
  );

  return {
    uri: fullCompressed.uri,
    thumbUri: thumbnail.uri,
    originalWidth: originalWidth || fullCompressed.width,
    originalHeight: originalHeight || fullCompressed.height,
    width: fullCompressed.width,
    height: fullCompressed.height,
    thumbWidth: thumbnail.width,
    thumbHeight: thumbnail.height,
  };
}

/**
 * Batch compress multiple photos
 * @param photos - Array of photo URIs with optional dimensions
 * @returns Array of compressed photos
 */
export async function compressPhotos(
  photos: Array<{ uri: string; width?: number; height?: number }>
): Promise<CompressedPhoto[]> {
  const results: CompressedPhoto[] = [];

  for (const photo of photos) {
    try {
      const compressed = await compressPhoto(photo.uri, photo.width, photo.height);
      results.push(compressed);
    } catch (error) {
      console.error(`Failed to compress photo ${photo.uri}:`, error);
      throw error;
    }
  }

  return results;
}

/**
 * Get estimated file size after compression (rough estimate)
 * Useful for showing users how much storage they're saving
 */
export function estimateCompressedSize(
  originalWidth: number,
  originalHeight: number
): { estimatedBytes: number; savings: string } {
  // Rough estimate: assume original is ~4MB for a typical phone camera photo
  const originalBytes = 4 * 1024 * 1024;

  const fullDimensions = calculateResizeDimensions(originalWidth, originalHeight, MAX_DIMENSION);
  const fullPixels = fullDimensions.width * fullDimensions.height;
  const originalPixels = originalWidth * originalHeight;

  // Estimate compressed size based on pixel reduction and quality
  const pixelRatio = fullPixels / originalPixels;
  const estimatedBytes = Math.round(originalBytes * pixelRatio * FULL_QUALITY);

  const savingsPercent = Math.round((1 - estimatedBytes / originalBytes) * 100);

  return {
    estimatedBytes,
    savings: `~${savingsPercent}% smaller`,
  };
}
