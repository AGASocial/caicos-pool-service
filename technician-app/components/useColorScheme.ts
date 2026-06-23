import { useAppColors } from '@/lib/theme';

export function useColorScheme() {
  const { scheme } = useAppColors();
  return scheme;
}
