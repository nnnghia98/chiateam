'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Users,
  Trophy,
  Calendar,
  LayoutDashboard,
  LogOut,
  Shield,
  Eye,
  Menu,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const links = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      href: '/players',
      label: 'Players',
      icon: Users,
    },
    {
      href: '/matches',
      label: 'Matches',
      icon: Calendar,
    },
    {
      href: '/leaderboard',
      label: 'Leaderboard',
      icon: Trophy,
    },
  ];

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900">
            ChiaTeam Admin
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-4">
            {links.map(link => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
            <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
              <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
                {role === 'admin' ? (
                  <>
                    <Shield className="w-4 h-4 text-green-600" />
                    <span>Admin</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 text-blue-600" />
                    <span>Viewer</span>
                  </>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center gap-1"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </div>

          {/* Mobile Navigation - Hamburger Menu */}
          <div className="lg:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px]">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-4 mt-6">
                  {/* User Role Badge */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg">
                    {role === 'admin' ? (
                      <>
                        <Shield className="w-5 h-5 text-green-600" />
                        <span className="font-medium text-gray-900">Admin</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-5 h-5 text-blue-600" />
                        <span className="font-medium text-gray-900">
                          Viewer
                        </span>
                      </>
                    )}
                  </div>

                  {/* Navigation Links */}
                  <div className="flex flex-col gap-2">
                    {links.map(link => {
                      const Icon = link.icon;
                      const isActive = pathname === link.href;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors',
                            isActive
                              ? 'bg-gray-100 text-gray-900'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          )}
                        >
                          <Icon className="w-5 h-5" />
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>

                  {/* Logout Button */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-5 h-5" />
                      Logout
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
