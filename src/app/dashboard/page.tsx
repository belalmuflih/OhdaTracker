'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/components/auth-provider';
import { Navbar } from '@/components/navbar';
import { LoggerDashboard } from '@/components/logger-dashboard';
import { BossDashboard } from '@/components/boss-dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

function DashboardContent() {
  const { profile, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading your workspace…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-3 max-w-md text-center">
          <div className="p-4 bg-destructive/10 text-destructive rounded-full">
            <span className="font-bold text-xl">!</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Profile Not Found</h2>
          <p className="text-sm text-muted-foreground">
            Your account was created in authentication, but the database profile is missing. 
            Ensure that you have run the database schema setup (including the `on_auth_user_created` trigger) in your Supabase SQL editor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 pb-safe">
        {profile.role === 'boss' ? <BossDashboard /> : <LoggerDashboard />}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <DashboardContent />
  );
}
