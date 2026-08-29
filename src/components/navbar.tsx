'use client';

import { useAuth } from '@/components/auth-provider';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Receipt, Sun, Moon, LogOut, User } from 'lucide-react';

export function Navbar() {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
            <Receipt className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight text-foreground">PerDiem Pro</span>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Role badge */}
          {profile && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground">
              <User className="w-3 h-3" />
              {profile.role === 'boss' ? 'Reviewer' : 'Logger'}
            </div>
          )}

          {/* Theme toggle */}
          <Button
            id="theme-toggle-btn"
            variant="ghost"
            size="sm"
            className="w-9 h-9 p-0"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </Button>

          {/* Sign out */}
          <Button
            id="sign-out-btn"
            variant="ghost"
            size="sm"
            className="w-9 h-9 p-0 text-muted-foreground hover:text-destructive"
            onClick={signOut}
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
