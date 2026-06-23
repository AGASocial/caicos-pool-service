import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme as useRNColorScheme, type ColorSchemeName } from 'react-native';
import Colors from '@/constants/Colors';

export type AppColorScheme = 'light' | 'dark';

type AppThemeContextValue = {
  scheme: AppColorScheme;
  colors: (typeof Colors)['light'];
  isDark: boolean;
};

const AppThemeContext = createContext<AppThemeContextValue>({
  scheme: 'light',
  colors: Colors.light,
  isDark: false,
});

function resolveScheme(colorScheme: ColorSchemeName | null | undefined): AppColorScheme {
  return colorScheme === 'dark' ? 'dark' : 'light';
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const rnColorScheme = useRNColorScheme();
  const [appearanceScheme, setAppearanceScheme] = useState<ColorSchemeName | null>(
    () => Appearance.getColorScheme()
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setAppearanceScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const scheme = useMemo<AppColorScheme>(
    () => resolveScheme(rnColorScheme ?? appearanceScheme),
    [appearanceScheme, rnColorScheme]
  );

  const value = useMemo<AppThemeContextValue>(
    () => ({
      scheme,
      colors: Colors[scheme],
      isDark: scheme === 'dark',
    }),
    [scheme]
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppColors() {
  return useContext(AppThemeContext);
}
