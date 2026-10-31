import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState, forwardRef } from 'react';

export const ThemeToggle = forwardRef<HTMLButtonElement, { className?: string }>(
  ({ className }, ref) => {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted) {
      return (
        <div className={cn("w-11 h-11 rounded-xl", className)} />
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className={cn(
          "w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-200",
          "text-muted-foreground hover:text-foreground hover:bg-muted/50 btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun className="w-[18px] h-[18px]" />
        ) : (
          <Moon className="w-[18px] h-[18px]" />
        )}
      </button>
    );
  }
);

ThemeToggle.displayName = 'ThemeToggle';
