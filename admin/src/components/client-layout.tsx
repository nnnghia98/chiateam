'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { Navigation } from '@/components/navigation';

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Allow access to login page without authentication
    if (pathname === '/login') {
      return;
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, pathname, router]);

  // Show login page without navigation
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Show nothing while redirecting
  if (!isAuthenticated) {
    return null;
  }

  // Show authenticated layout
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedLayout>{children}</ProtectedLayout>
    </AuthProvider>
  );
}
