"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';

// Curated collection of pool-related images for Caicos pool service platform
// Using Unsplash images - beautiful, high-quality pool and water photos
const IMAGE_SOURCES = [
  // Resort & luxury pools
  'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=1200&h=1600&fit=crop&q=80', // Blue pool, clear water
  'https://images.unsplash.com/photo-1605649487212-47bdab064df7?w=1200&h=1600&fit=crop&q=80', // Pool villa
  'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1200&h=1600&fit=crop&q=80', // Outdoor pool
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&h=1600&fit=crop&q=80', // Pool resort

  // Pool views & architecture
  'https://images.unsplash.com/photo-1572891086295-6c65f5352b0f?w=1200&h=1600&fit=crop&q=80', // Pool deck
  'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&h=1600&fit=crop&q=80', // Beach pool
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&h=1600&fit=crop&q=80', // Resort pool
  'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200&h=1600&fit=crop&q=80', // Pool view

  // Water & maintenance vibes
  'https://images.unsplash.com/photo-1576610616656-d3aa5d1f4534?w=1200&h=1600&fit=crop&q=80', // Pool water
  'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=1200&h=1600&fit=crop&q=80', // Pool summer
  'https://images.unsplash.com/photo-1580121441575-41bcb5c42b37?w=1200&h=1600&fit=crop&q=80', // Swimming pool
  'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=1200&h=1600&fit=crop&q=80', // Pool blue water
];

// Calculate initial random indices once at module load time
const getInitialIndices = () => {
  const initialIndex = Math.floor(Math.random() * IMAGE_SOURCES.length);
  return {
    current: initialIndex,
    next: (initialIndex + 1) % IMAGE_SOURCES.length,
    preload: (initialIndex + 2) % IMAGE_SOURCES.length,
  };
};

const INITIAL_INDICES = getInitialIndices();

export function AuthHero({ quote, author, children }: { quote: string; author: string; children?: React.ReactNode }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(INITIAL_INDICES.current);
  const [nextImageIndex, setNextImageIndex] = useState(INITIAL_INDICES.next);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [nextImageLoaded, setNextImageLoaded] = useState(false);
  const [preloadImageIndex, setPreloadImageIndex] = useState(INITIAL_INDICES.preload);

  // Calculate image URLs from indices (must be before useEffects that use them)
  const currentImage = IMAGE_SOURCES[currentImageIndex];
  const nextImage = IMAGE_SOURCES[nextImageIndex];
  const preloadImage = IMAGE_SOURCES[preloadImageIndex];

  // Check if next image is loaded (including cached images)
  useEffect(() => {
    // Get the next image URL
    const nextImageUrl = IMAGE_SOURCES[nextImageIndex];

    // Reset loaded state when nextImageIndex changes - use setTimeout to avoid synchronous setState
    let isMounted = true;
    const resetTimeout = setTimeout(() => {
      if (isMounted) {
        setNextImageLoaded(false);
      }
    }, 0);

    // Preload the next image to check if it's cached or needs loading
    const img = new window.Image();
    img.onload = () => {
      if (isMounted) {
        setNextImageLoaded(true);
      }
    };
    img.onerror = () => {
      if (isMounted) {
        setNextImageLoaded(true); // Allow transition even if image fails
      }
    };

    // Start loading the image
    img.src = nextImageUrl;

    // If image is already cached and loaded, onload might not fire
    // Check after a short delay
    const timeout = setTimeout(() => {
      if (isMounted && img.complete && img.naturalWidth > 0) {
        setNextImageLoaded(true);
      }
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(resetTimeout);
      clearTimeout(timeout);
    };
  }, [nextImageIndex]);

  // Handle image transitions timer
  useEffect(() => {
    const interval = setInterval(() => {
      // Only transition if the next image is loaded (or after a timeout as fallback)
      if (nextImageLoaded) {
        setIsTransitioning(true);
        setTimeout(() => {
          setCurrentImageIndex(nextImageIndex);
          const newNextIdx = (nextImageIndex + 1) % IMAGE_SOURCES.length;
          setNextImageIndex(newNextIdx);
          setPreloadImageIndex((newNextIdx + 1) % IMAGE_SOURCES.length);
          setIsTransitioning(false);
          setNextImageLoaded(false); // Reset for next cycle
        }, 800);
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [nextImageIndex, nextImageLoaded]);

  return (
    <div className="fixed inset-0 lg:relative flex h-screen lg:h-full lg:min-h-0 min-h-screen flex-col p-6 sm:p-8 lg:p-10 text-white overflow-hidden z-10">
      {/* Background Images with fade transition */}
      <div className="absolute inset-0">
        {/* Current visible image */}
        <div
          className={`absolute inset-0 transition-opacity duration-1000 ${isTransitioning ? 'opacity-0' : 'opacity-100'
            }`}
        >
          <Image
            src={currentImage}
            alt="Background"
            fill
            className="object-cover"
            priority={currentImageIndex === 0}
            quality={85}
            sizes="100vw"
            unoptimized={false}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>

        {/* Next image - always rendered but hidden until transition, preloading in background */}
        <div
          className={`absolute inset-0 transition-opacity duration-1000 ${isTransitioning ? 'opacity-100' : 'opacity-0'
            }`}
          style={{
            visibility: isTransitioning ? 'visible' : 'hidden',
            pointerEvents: 'none'
          }}
        >
          <Image
            src={nextImage}
            alt="Background"
            fill
            className="object-cover"
            quality={85}
            sizes="100vw"
            unoptimized={false}
            onLoad={() => {
              // Mark next image as loaded when it's ready
              setNextImageLoaded(true);
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              // If image fails to load, mark as loaded anyway to prevent blocking
              setNextImageLoaded(true);
            }}
          />
        </div>

        {/* Preload next-next image in background (invisible) */}
        <div className="absolute inset-0 opacity-0 pointer-events-none" style={{ visibility: 'hidden' }}>
          <Image
            src={preloadImage}
            alt="Preload"
            fill
            className="object-cover"
            quality={85}
            sizes="100vw"
            unoptimized={false}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
      </div>

      {/* Gradient overlay - Primary color with modern gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-blue-500/50 to-primary/70 backdrop-blur-[2px]" />

      {/* Additional overlay for depth and text readability - lightened */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/30" />

      {/* Subtle vignette effect - reduced opacity */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(0,0,0,0.1)_100%)]" />

      {/* Animated gradient orbs for extra visual interest */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Content */}
      <div className="relative z-20 flex items-center text-base sm:text-lg font-medium">
        {children || (
          <div className="flex items-center group">
            <div className="p-1.5 sm:p-2 rounded-lg transition-colors">
              <Image src="/logo-iablee-dark2.png" alt="Logo" width={300} height={200} />
            </div>
          </div>
        )}
      </div>

      {/* Quote at bottom - Shown on desktop/tablet, hidden on mobile to make room for form */}
      <div className="relative z-20 mt-auto hidden lg:block">
        <blockquote className="space-y-3">
          <div className="p-4 sm:p-6 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl">
            <p className="text-base sm:text-lg font-medium leading-relaxed drop-shadow-lg text-white/95">
              &ldquo;{quote}&rdquo;
            </p>
            <footer className="text-xs sm:text-sm text-white/70 font-light mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/10">
              — {author}
            </footer>
          </div>
        </blockquote>
      </div>
    </div>
  );
}

