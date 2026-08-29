import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';

export const metadata: Metadata = {
  title: 'Sign Up — PerDiem Pro',
  description: 'Create a new PerDiem Pro account.',
};

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
