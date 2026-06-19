"use client";


import Image from 'next/image';
import Navigation from "@/components/Navigation";
import Navbar from "@/components/Navbar";
import { Toaster } from "sonner";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { User, LogOut, Languages, ChevronUp, CreditCard } from "lucide-react";
import { Link, useRouter, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';
import { SessionBillingPrefetch } from '@/lib/billing-queries';
import { APP_VERSION } from '@/lib/app-version';

function getFirstName(user: {
  profile?: { full_name?: string } | null;
  user_metadata?: { full_name?: string };
  email?: string;
} | null): string {
  if (!user) return '';
  const fromProfile = user.profile?.full_name?.trim();
  if (fromProfile) {
    const first = fromProfile.split(/\s+/)[0];
    if (first) return first;
  }
  const full = user.user_metadata?.full_name?.trim();
  if (full) {
    const first = full.split(/\s+/)[0];
    if (first) return first;
  }
  const email = user.email ?? '';
  const local = email.split('@')[0];
  if (local) return local;
  return '';
}

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname?.includes('/auth');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const { user } = useAuth();
  const firstName = getFirstName(user);
  const isAdmin = user?.profile?.role === 'admin';

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.dispatchEvent(new Event('auth-changed'));
    router.push('/auth/login');
  };

  const switchLocale = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  if (isAuthPage) {
    return (
      <div className="min-h-screen surface-bg">
        {children}
        <Toaster richColors closeButton position="top-right" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen surface-bg overflow-x-hidden">
      <SessionBillingPrefetch />
      {/* Sidebar for desktop */}
      <aside className={cn(
        "hidden md:flex flex-col fixed inset-y-0 z-50 transition-all duration-300",
        sidebarCollapsed ? "w-20" : "w-60"
      )}>
        <div className="relative flex-1 flex flex-col min-h-0 bg-sidebar border-r border-sidebar-border shadow-sm transition-all duration-300">
          {/* Logo Area */}
          <div className={cn(
            "flex items-center h-20 border-b border-sidebar-border bg-sidebar transition-all duration-300 shrink-0",
            sidebarCollapsed ? "justify-center px-0" : "px-6"
          )}>
            <div className={cn(
              "relative transition-all duration-300",
              sidebarCollapsed ? "h-16 w-16" : "w-48 h-24"
            )}>
              <Image
                src={sidebarCollapsed ? "/brand-assets/cadenza-app-icon-clean.png" : "/brand-assets/cadenza-wordmark-serif.png"}
                alt="Cadenza"
                fill
                className="object-contain dark:invert"
                priority
                unoptimized
              />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex flex-1 flex-col min-h-0 bg-sidebar">
            <div className="flex-1 overflow-y-auto py-6 px-3">
              <Navigation collapsed={sidebarCollapsed} />
            </div>
            <p
              className={cn(
                "shrink-0 pb-3 text-[10px] text-sidebar-foreground/40 tabular-nums tracking-wide",
                sidebarCollapsed ? "text-center px-1" : "px-5"
              )}
            >
              {sidebarCollapsed ? APP_VERSION : `${t('version')} ${APP_VERSION}`}
            </p>
          </div>

          {/* Toggle Button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-background hover:bg-primary/90 transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn("h-3 w-3 transition-transform duration-300", sidebarCollapsed ? "rotate-180" : "")}
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          {/* User Profile / Footer Area */}
          <div className="p-4 border-t border-sidebar-border bg-sidebar-accent/40">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={cn("w-full justify-start px-2", sidebarCollapsed ? "justify-center px-0" : "")}>
                  <div className="flex items-center gap-2 w-full">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className={cn("flex flex-col items-start overflow-hidden transition-all duration-300", sidebarCollapsed ? "w-0 opacity-0" : "flex-1 opacity-100")}>
                      <span className="text-sm font-medium truncate w-full text-left">{firstName || t('profile')}</span>
                      <span className="text-xs text-muted-foreground truncate w-full text-left">{user?.profile?.role ? t('roles.' + user.profile.role, { defaultValue: user.profile.role }) : t('myAccount')}</span>
                    </div>
                    {!sidebarCollapsed && <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" />}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="right" className="w-56 p-2 mb-2 ml-2">
                <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {t('profile')}
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                    <User className="h-4 w-4 shrink-0 opacity-70" />
                    <span>{t('profileSettings')}</span>
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild><Link href="/billing" className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                    <CreditCard className="h-4 w-4 shrink-0 opacity-70" />
                    <span>{t('billing')}</span>
                  </Link></DropdownMenuItem>
                )}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors focus:bg-accent focus:text-accent-foreground">
                    <Languages className="h-4 w-4 shrink-0 opacity-70" />
                    <span>{t('language')}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="p-1">
                    <DropdownMenuItem onClick={() => switchLocale('en')} className="cursor-pointer">
                      <span className={locale === 'en' ? 'font-bold text-primary' : ''}>English</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => switchLocale('es')} className="cursor-pointer">
                      <span className={locale === 'es' ? 'font-bold text-primary' : ''}>Español</span>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator className="my-2 bg-border/50" />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-destructive focus:bg-destructive/10 focus:text-destructive">
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>{t('signOut')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Sidebar drawer for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex w-60 flex-col bg-sidebar shadow-2xl animate-in slide-in-from-left duration-300 border-r border-sidebar-border">
            <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-32 overflow-hidden rounded-lg">
                  <Image
                    src="/brand-assets/cadenza-wordmark-serif.png"
                    alt="Cadenza"
                    fill
                    className="object-contain dark:invert"
                    unoptimized
                  />
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors"
                aria-label="Close sidebar"
              >
                &times;
              </button>
            </div>
            <div className="flex flex-1 flex-col min-h-0 bg-sidebar">
              <div className="flex-1 overflow-y-auto p-4">
                <Navigation closeSidebar={() => setSidebarOpen(false)} />
              </div>
              <p className="shrink-0 px-5 pb-3 text-[10px] text-sidebar-foreground/40 tabular-nums tracking-wide">
                {t('version')} {APP_VERSION}
              </p>
            </div>
            {/* Mobile Footer */}
            <div className="p-4 border-t border-sidebar-border bg-sidebar-accent/40">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 w-full rounded-lg hover:bg-sidebar-accent transition-all p-2 text-left">
                    <div className="relative flex items-center justify-center shrink-0 rounded-full bg-primary/10 text-primary h-9 w-9">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium text-sidebar-foreground truncate">{firstName || t('profile')}</p>
                      <p className="text-xs text-sidebar-foreground/60 truncate">{t('profileSettings')}</p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" sideOffset={10} className="w-56 p-2">
                  <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {t('profile')}
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                      <User className="h-4 w-4 shrink-0 opacity-70" />
                      <span>{t('profileSettings')}</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors focus:bg-accent focus:text-accent-foreground">
                      <Languages className="h-4 w-4 shrink-0 opacity-70" />
                      <span>{t('language')}</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="p-1">
                      <DropdownMenuItem onClick={() => switchLocale('en')} className="cursor-pointer">
                        <span className={locale === 'en' ? 'font-bold text-primary' : ''}>English</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => switchLocale('es')} className="cursor-pointer">
                        <span className={locale === 'es' ? 'font-bold text-primary' : ''}>Español</span>
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator className="my-2 bg-border/50" />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-destructive focus:bg-destructive/10 focus:text-destructive">
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span>{t('signOut')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="text-xs text-sidebar-foreground/60 text-center mt-4">
                © 2026 Cadenza Inc.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={cn(
        "flex-1 flex flex-col transition-all duration-300 min-w-0",
        sidebarCollapsed ? "md:pl-20" : "md:pl-72"
      )}>
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
      <Toaster richColors closeButton position="top-right" />
    </div>
  );
} 
