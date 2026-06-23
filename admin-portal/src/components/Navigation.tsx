'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { LayoutDashboard, Briefcase, Building2, Route, Users, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { hasEntitlement, type Resource } from '@/lib/entitlements';

export default function Navigation({ closeSidebar, collapsed }: { closeSidebar?: () => void; collapsed?: boolean }) {
  const t = useTranslations();
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems: Array<{ href: string; label: string; icon: typeof LayoutDashboard; resource: Resource }> = [
    { href: '/dashboard', label: t('dashboard'), icon: LayoutDashboard, resource: 'dashboard' },
    { href: '/reports', label: t('reports'), icon: FileText, resource: 'report' },
    { href: '/jobs', label: t('jobs'), icon: Briefcase, resource: 'job' },
    { href: '/routes', label: t('routes'), icon: Route, resource: 'route' },
    { href: '/team', label: t('team'), icon: Users, resource: 'team' },
    { href: '/properties', label: t('properties'), icon: Building2, resource: 'property' },
  ];

  const visibleNavItems = navItems.filter((item) =>
    hasEntitlement(user?.profile?.role, item.resource, 'view'),
  );

  return (
    <nav className="space-y-6">
      <ul className="space-y-1">
        {visibleNavItems.map((item) => {
          const isActive = pathname?.includes(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={closeSidebar}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative overflow-hidden",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border font-semibold"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? item.label : undefined}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                )}
                <item.icon className={cn(
                  "h-5 w-5 transition-transform duration-200 shrink-0",
                  isActive
                    ? "text-primary scale-110"
                    : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground group-hover:scale-110"
                )} />
                <span className={cn(
                  "text-sm transition-all duration-200 overflow-hidden whitespace-nowrap",
                  collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                )}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

    </nav>
  );
} 