import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';

export const metadata: Metadata = {
  title: 'Sign In — PerDiem Pro',
  description: 'Sign in to your PerDiem Pro account to manage per diem expenses.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
