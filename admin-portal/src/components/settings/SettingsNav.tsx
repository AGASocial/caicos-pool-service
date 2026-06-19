"use client";

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { User, Settings, Trash2, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

type SettingsNavProps = React.HTMLAttributes<HTMLElement>;

const TRASH_ROLES = new Set(['owner', 'admin', 'operations']);

export function SettingsNav({ className, ...props }: SettingsNavProps) {
    const t = useTranslations('settings');
    const pathname = usePathname();
    const { user } = useAuth();
    const canViewTrash = TRASH_ROLES.has(user?.profile?.role ?? '');

    const items = [
        {
            title: t('profile'),
            href: '/settings',
            icon: User,
        },
        {
            title: t('preferences'),
            href: '/settings/preferences',
            icon: Settings,
        },
        ...(canViewTrash
            ? [
                  {
                      title: t('messageTemplates'),
                      href: '/settings/templates',
                      icon: Mail,
                  },
                  {
                      title: t('trash'),
                      href: '/settings/trash',
                      icon: Trash2,
                  },
              ]
            : []),
    ];

    return (
        <nav
            className={cn(
                "flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1",
                className
            )}
            {...props}
        >
            {items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/settings' && pathname?.startsWith(item.href));

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            buttonVariants({ variant: "ghost" }),
                            isActive
                                ? "bg-muted hover:bg-muted font-medium"
                                : "hover:bg-transparent hover:underline text-muted-foreground",
                            "justify-start dark:text-white"
                        )}
                    >
                        <item.icon className="mr-2 h-4 w-4" />
                        {item.title}
                    </Link>
                );
            })}
        </nav>
    );
}
