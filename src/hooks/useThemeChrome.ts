import { useLayoutEffect } from 'react';
import { isHandheldRoute } from '@/lib/appNavigation';
import { useTheme } from 'next-themes';

const COLORS = {
  dark: '#0d1210',
  light: '#e9eeea',
} as const;

/** Keeps browser/PWA chrome visually attached to the active app theme. */
export function useThemeChrome(pathname: string) {
  const { resolvedTheme, theme } = useTheme();

  useLayoutEffect(() => {
    document.dispatchEvent(new Event('dh:route-changed'));
    const handheld = isHandheldRoute(pathname);
    const active = !handheld && (resolvedTheme ?? theme) === 'light' ? 'light' : 'dark';
    const color = handheld ? '#102224' : COLORS[active];

    let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeColor) {
      themeColor = document.createElement('meta');
      themeColor.name = 'theme-color';
      document.head.appendChild(themeColor);
    }
    themeColor.content = color;

    let colorScheme = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    if (!colorScheme) {
      colorScheme = document.createElement('meta');
      colorScheme.name = 'color-scheme';
      document.head.appendChild(colorScheme);
    }
    colorScheme.content = active;
  }, [resolvedTheme, theme, pathname]);
}
