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

  const handleLogout = async () => {
    await logout();
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
    <nav className="bg-white border-b border-[#c1c1c1] sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight"
            style={{ color: '#ff385c' }}
          >
            ChiaTeam Admin
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center">
            {links.map(link => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-2 px-4 h-16 text-sm font-medium transition-colors border-b-2',
                    isActive
                      ? 'border-[#222222] text-[#222222]'
                      : 'border-transparent text-[#6a6a6a] hover:text-[#222222] hover:border-[#c1c1c1]'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
            <div className="flex items-center gap-2 pl-4 ml-2 border-l border-[#c1c1c1]">
              <div className="flex items-center gap-1 text-sm font-medium text-[#222222]">
                {role === 'admin' ? (
                  <>
                    <Shield className="w-4 h-4 text-[#ff385c]" />
                    <span>Admin</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 text-[#6a6a6a]" />
                    <span>Viewer</span>
                  </>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void handleLogout();
                }}
                className="flex items-center gap-1 border-[#c1c1c1] text-[#222222] hover:border-[#222222] rounded-airbnb"
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
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#c1c1c1] text-[#222222] hover:border-[#222222] rounded-airbnb"
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px]">
                <SheetHeader>
                  <SheetTitle className="text-[#222222] font-semibold tracking-tight">
                    Menu
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-4 mt-6">
                  {/* User Role Badge */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-[#f2f2f2] rounded-airbnb">
                    {role === 'admin' ? (
                      <>
                        <Shield className="w-5 h-5 text-[#ff385c]" />
                        <span className="font-medium text-[#222222]">
                          Admin
                        </span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-5 h-5 text-[#6a6a6a]" />
                        <span className="font-medium text-[#222222]">
                          Viewer
                        </span>
                      </>
                    )}
                  </div>

                  {/* Navigation Links */}
                  <div className="flex flex-col gap-1">
                    {links.map(link => {
                      const Icon = link.icon;
                      const isActive = pathname === link.href;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 rounded-airbnb text-base font-medium transition-colors',
                            isActive
                              ? 'bg-[#f2f2f2] text-[#222222]'
                              : 'text-[#6a6a6a] hover:bg-[#f2f2f2] hover:text-[#222222]'
                          )}
                        >
                          <Icon className="w-5 h-5" />
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>

                  {/* Logout Button */}
                  <div className="mt-4 pt-4 border-t border-[#c1c1c1]">
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2 border-[#c1c1c1] text-[#222222] hover:border-[#222222] rounded-airbnb"
                      onClick={() => {
                        void handleLogout();
                      }}
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
