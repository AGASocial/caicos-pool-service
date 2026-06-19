'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const SIZES = { sm: 32, md: 48, lg: 64 } as const;

export type LoadingStateProps = {
  className?: string;
  /** Override the translated loading label */
  label?: string;
  size?: keyof typeof SIZES;
  /** Fill the viewport — auth gates and pre-layout loads */
  fullScreen?: boolean;
  /** Vertical padding when not full screen (default true) */
  padded?: boolean;
};

export function LoadingState({
  className,
  label,
  size = 'md',
  fullScreen = false,
  padded = true,
}: LoadingStateProps) {
  const t = useTranslations();
  const px = SIZES[size];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'flex flex-col items-center justify-center gap-3',
        fullScreen && 'min-h-screen',
        padded && !fullScreen && 'py-12',
        className,
      )}
    >
      <div
        className="animate-cadenza-flip-y"
        style={{ width: px, height: px }}
      >
        <Image
          src="/brand-assets/cadenza-app-icon-clean.png"
          alt=""
          width={px}
          height={px}
          priority
          className="size-full object-contain"
        />
      </div>
      <p className="text-sm text-muted-foreground tracking-wide">
        {label ?? t('loading')}
      </p>
    </div>
  );
}
