'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { UserPlus, Users } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useTeam, useSetTeamMemberActive, type TeamMember } from '@/lib/team';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

/** Roles that can appear as team cards. Matches invite/API roles. */
type RoleKey = 'technician' | 'admin' | 'operations';

/** Order of role cards on the page. Change this array to reorder cards. */
const ROLE_CARD_ORDER: RoleKey[] = ['admin', 'operations', 'technician'];

const ROLE_TRANSLATION_KEYS: Record<RoleKey, string> = {
  admin: 'roleAdmin',
  operations: 'roleOperations',
  technician: 'roleTechnician',
};

function normalizeRole(role: string | undefined): RoleKey {
  if (!role) return 'technician';
  const r = role.toLowerCase();
  if (r === 'admin' || r === 'operations') return r;
  return 'technician';
}

function groupByRole(teamMembers: TeamMember[]): Record<RoleKey, TeamMember[]> {
  const groups: Record<RoleKey, TeamMember[]> = {
    admin: [],
    operations: [],
    technician: [],
  };
  for (const member of teamMembers) {
    const key = normalizeRole(member.role);
    groups[key].push(member);
  }
  return groups;
}

export default function TeamPage() {
  const t = useTranslations();
  const { user } = useAuth();
  const isAdmin = user?.profile?.role === 'admin' || user?.profile?.role === 'owner';
  const { data: teamMembers = [], isLoading: loading, error: queryError } = useTeam();
  const setActive = useSetTeamMemberActive();
  const error = queryError ? (queryError as Error).message : null;
  const byRole = groupByRole(teamMembers);

  const handleToggleActive = (member: TeamMember, nextActive: boolean) => {
    setActive.mutate(
      { id: member.id, is_active: nextActive },
      {
        onError: () => {
          // Error toast could go here; list will refetch and revert
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-700">{t('team')}</h1>
          <p className="text-muted-foreground dark:text-gray-700">{t('teamDescription')}</p>
        </div>
        <Button asChild className="w-fit shrink-0">
          <Link href="/team/invite">
            <UserPlus className="mr-2 h-4 w-4" />
            {t('inviteTeamMember')}
          </Link>
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">{t('loading', { defaultValue: 'Loading…' })}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!loading && !error && teamMembers.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t('noTeamYet')}</p>
          </CardContent>
        </Card>
      )}
      {!loading && !error && teamMembers.length > 0 && (
        <div className="space-y-6">
          {ROLE_CARD_ORDER.map((roleKey) => {
            const list = byRole[roleKey];
            const titleKey = ROLE_TRANSLATION_KEYS[roleKey];
            return (
              <Card key={roleKey}>
                <CardHeader>
                  <CardTitle>{t(titleKey)}</CardTitle>
                  <CardDescription>
                    {list.length === 0
                      ? t('noTeamYet', { defaultValue: 'No members with this role yet.' })
                      : t('teamCardDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t('noTeamYet', { defaultValue: 'No members with this role yet.' })}
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {list.map((member) => {
                        const isCurrentUser = user?.id === member.id;
                        const isActive = member.is_active !== false;
                        const isToggling = setActive.isPending && setActive.variables?.id === member.id;
                        return (
                          <li
                            key={member.id}
                            className={cn(
                              'flex items-center gap-3 py-3 px-3 -mx-3 transition-colors',
                              !isActive && 'opacity-70',
                              'hover:bg-muted/60'
                            )}
                          >
                            <Users className="h-5 w-5 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">{member.full_name}</span>
                              {isCurrentUser && (
                                <span className="text-muted-foreground text-sm ml-2">({t('you', { defaultValue: 'you' })})</span>
                              )}
                              {!isActive && !isCurrentUser && (
                                <span className="text-muted-foreground text-sm ml-2">({t('inactive', { defaultValue: 'inactive' })})</span>
                              )}
                              {member.email_confirmed === false && (
                                <span className="text-amber-700 dark:text-amber-500 text-sm ml-2">
                                  ({t('emailNotConfirmed', { defaultValue: 'email not confirmed' })})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {isActive ? t('active', { defaultValue: 'Active' }) : t('inactive', { defaultValue: 'Inactive' })}
                              </span>
                              {isAdmin && (
                                <Switch
                                  checked={isActive}
                                  disabled={isToggling}
                                  onCheckedChange={(checked) => handleToggleActive(member, checked)}
                                  aria-label={isActive ? t('deactivateUser', { defaultValue: 'Deactivate user' }) : t('activateUser', { defaultValue: 'Activate user' })}
                                />
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
