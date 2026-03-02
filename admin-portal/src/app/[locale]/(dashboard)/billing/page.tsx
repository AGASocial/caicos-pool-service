'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { FileText, Calendar, AlertCircle, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { format } from 'date-fns';
import PaymentMethodsList from '@/components/billing/PaymentMethodsList';
import { useTeam } from '@/lib/team';

/** Plan features from caicos_billing_plans (JSONB). -1 = unlimited. */
interface PlanFeatures {
  admin_users_included?: number;
  admin_users?: number; // alias in some API responses
  max_technicians?: number;
  max_properties?: number;
  max_routes?: number;
  max_service_jobs?: number;
  max_photos_per_service?: number;
  storage_gb?: number;
  photo_retention_days?: number;
  priority_support?: boolean;
  advanced_analytics?: boolean;
  api_access?: boolean;
  custom_branding?: boolean;
  automated_scheduling?: boolean;
  real_time_gps_tracking?: boolean;
  sso_saml?: boolean;
  dedicated_account_manager?: boolean;
  /** Legacy keys (optional) */
  max_assets?: number;
  max_beneficiaries?: number;
  max_storage_mb?: number;
  [key: string]: number | boolean | undefined;
}

interface Subscription {
  id: string;
  planId: string;
  status: string;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  plan: {
    name: string;
    amountCents: number;
    currency: string;
    interval: string;
    features: PlanFeatures;
  };
}

interface Invoice {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  issuedAt: Date;
  paidAt?: Date;
  providerInvoiceId?: string;
}

export default function BillingPage() {
  const t = useTranslations();
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [freePlanOverride, setFreePlanOverride] = useState<Subscription['plan'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const { data: teamMembers = [] } = useTeam();
  const userCount = teamMembers.filter(member => member.role === 'technician').length;

  const fetchBillingData = async () => {
    try {
      const [subResponse, invoicesResponse] = await Promise.all([
        fetch('/api/billing/subscriptions', { credentials: 'include' }),
        fetch('/api/billing/invoices', { credentials: 'include' }),
      ]);

      if (subResponse.ok) {
        const subData = await subResponse.json();
        setSubscription(subData.subscription);
        if (subData.config?.provider) {
          setProvider(subData.config.provider);
        }
        // When period has ended, fetch free plan so we can show it as the effective plan
        const periodEnd = subData.subscription?.currentPeriodEnd;
        if (periodEnd && new Date(periodEnd) < new Date()) {
          try {
            const plansRes = await fetch('/api/billing/plans', { credentials: 'include' });
            if (plansRes.ok) {
              const { plans } = await plansRes.json();
              const free = Array.isArray(plans) ? plans.find((p: { id: string }) => p.id === 'plan_free') : null;
              setFreePlanOverride(free ?? null);
            }
          } catch {
            setFreePlanOverride(null);
          }
        } else {
          setFreePlanOverride(null);
        }
      }

      if (invoicesResponse.ok) {
        const invoicesData = await invoicesResponse.json();
        setInvoices(invoicesData.invoices);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
      toast.error(t('errorLoadingSubscription'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancelSubscription = async () => {
    if (!subscription) return;

    if (!confirm(t('confirmCancelSubscription'))) return;

    setCanceling(true);
    try {
      const response = await fetch(
        `/api/billing/subscriptions?subscriptionId=${subscription.id}&atPeriodEnd=true`,
        {
          method: 'DELETE',
          credentials: 'include'
        }
      );

      if (!response.ok) throw new Error('Failed to cancel subscription');

      toast.success(t('subscriptionCanceledSuccess'));
      fetchBillingData();
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast.error(t('billingError'));
    } finally {
      setCanceling(false);
    }
  };

  const handleResumeSubscription = async () => {
    if (!subscription) return;

    try {
      const response = await fetch('/api/billing/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subscriptionId: subscription.id,
          cancelAtPeriodEnd: false,
        }),
      });

      if (!response.ok) throw new Error('Failed to resume subscription');

      toast.success(t('subscriptionResumedSuccess'));
      fetchBillingData();
    } catch (error) {
      console.error('Error resuming subscription:', error);
      toast.error(t('billingError'));
    }
  };

  const formatPrice = (amountCents: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amountCents / 100);
  };

  const formatFeatureValue = (value: number | boolean | undefined, isStorage = false) => {
    if (value === undefined) return '-';
    if (typeof value === 'boolean') return value ? t('yes') : t('no');
    if (value === -1) return t('unlimited');
    if (isStorage) return `${value} GB`;
    return String(value);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'text-green-600';
      case 'past_due':
        return 'text-yellow-600';
      case 'canceled':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center justify-center gap-2 py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-muted-foreground">{t('loadingSubscription')}</span>
        </div>
      </div>
    );
  }

  const isPeriodExpired = Boolean(
    subscription?.currentPeriodEnd && new Date(subscription.currentPeriodEnd) < new Date()
  );
  const isFreePlan = !subscription || subscription.planId === 'plan_free' || isPeriodExpired;
  const effectivePlan = isPeriodExpired && freePlanOverride ? freePlanOverride : subscription?.plan;

  return (
    <div className="container mx-auto py-10 space-y-8 px-2">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-black dark:text-white">{t('billingDashboard')}</h1>
        <p className="text-muted-foreground">{t('manageBilling')}</p>
      </div>

      {/* Subscription Details */}
      <Card className="glass-panel overflow-hidden border-border/50 shadow-xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-500"></div>
        <CardHeader className="border-b border-border/50 pb-6">
          <CardTitle className="flex items-center justify-between text-xl">
            <span className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-primary/10 text-primary"><Calendar className="h-5 w-5" /></span>
              {t('subscriptionDetails')}
            </span>
            <span className={`text-xs px-3 py-1 rounded-full uppercase tracking-wider font-bold ${getStatusColor(subscription?.status?.toString() || '')} bg-muted`}>
              {isFreePlan ? t('freePlan') : t(`subscription${(subscription?.status?.charAt(0).toUpperCase() || '') + (subscription?.status?.slice(1) || '')}`)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8 pt-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">{t('currentPlan')}</h3>
              <p className="text-2xl font-bold">{effectivePlan?.name ?? t('freePlan')}</p>
              <p className="text-muted-foreground">
                {isFreePlan
                  ? t('freeForever')
                  : `${formatPrice(effectivePlan?.amountCents || 0, effectivePlan?.currency || '')} / ${effectivePlan?.interval === 'month' ? t('perMonth') : t('perYear')} / ${t('perTechnician')}`
                }
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {isFreePlan
                  ? t('status')
                  : subscription?.cancelAtPeriodEnd ? t('willCancelOn') : t('renewalDate')
                }
              </h3>
              <p className="text-lg">
                {isFreePlan
                  ? t('noExpiration')
                  : subscription?.currentPeriodEnd
                    ? format(new Date(subscription?.currentPeriodEnd || ''), 'PPP')
                    : '-'}
              </p>
            </div>
          </div>

          {isPeriodExpired && subscription?.currentPeriodEnd && (
            <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
              <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">
                {t('subscriptionEndedOn', { date: format(new Date(subscription.currentPeriodEnd), 'PPP') })}
              </p>
            </div>
          )}

          {/* Users count and next payment */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t('currentUsers')}
              </h3>
              <p className="text-lg">
                {t('usersCount', { count: userCount })}
              </p>
              {effectivePlan?.features && (
                <p className="text-sm text-muted-foreground mt-1">
                  {t('admins', { admins: formatFeatureValue(effectivePlan.features.admin_users_included ?? effectivePlan.features.admin_users) })}
                  {' · '}
                  {t('maxTechnicians', { maxTechnicians: formatFeatureValue(effectivePlan.features.max_technicians) })}
                </p>
              )}
            </div>
            <div>
              <h3 className="font-semibold mb-2">{t('nextPayment')}</h3>
              <p className="text-lg">
                {isFreePlan || subscription?.cancelAtPeriodEnd
                  ? t('noPaymentRequired')
                  : subscription?.currentPeriodEnd
                    ? t('nextPaymentOn', {
                        amount: formatPrice((effectivePlan?.amountCents ?? 0) * userCount || 0, effectivePlan?.currency || 'USD'),
                        date: format(new Date(subscription.currentPeriodEnd), 'PPP'),
                      })
                    : formatPrice(effectivePlan?.amountCents || 0, effectivePlan?.currency || 'USD')}
              </p>
            </div>
          </div>

          {subscription?.cancelAtPeriodEnd && !isPeriodExpired && (
            <div className="flex items-center gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <p className="text-sm">{t('cancelSubscriptionDescription')}</p>
            </div>
          )}

          <div className="flex gap-4">
            {isFreePlan ? (
              <Button onClick={() => router.push('/billing/plans')}>
                {t('upgradeToPremium')}
              </Button>
            ) : !subscription?.cancelAtPeriodEnd ? (
              <>
                {provider !== 'payu' && (
                  <Button
                    variant="outline"
                    onClick={() => router.push('/billing/plans')}
                  >
                    {t('changePlan')}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={handleCancelSubscription}
                  disabled={canceling}
                >
                  {canceling ? t('loading') : t('cancelSubscription')}
                </Button>
              </>
            ) : (
              <Button onClick={handleResumeSubscription}>
                {t('resumeSubscription')}
              </Button>
            )}
          </div>

          {/* Plan Features */}
          <div>
            <h3 className="font-semibold mb-3">{t('planFeatures')}</h3>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between p-2 bg-muted rounded">
                <span>{t('adminsLabel')}</span>
                <span className="font-semibold">
                  {formatFeatureValue(effectivePlan?.features?.admin_users_included ?? effectivePlan?.features?.admin_users)}
                </span>
              </div>
              <div className="flex justify-between p-2 bg-muted rounded">
                <span>{t('maxTechniciansLabel')}</span>
                <span className="font-semibold">
                  {formatFeatureValue(effectivePlan?.features?.max_technicians)}
                </span>
              </div>
              <div className="flex justify-between p-2 bg-muted rounded">
                <span>{t('maxPropertiesLabel')}</span>
                <span className="font-semibold">
                  {formatFeatureValue(effectivePlan?.features?.max_properties)}
                </span>
              </div>
              <div className="flex justify-between p-2 bg-muted rounded">
                <span>{t('maxRoutesLabel')}</span>
                <span className="font-semibold">
                  {formatFeatureValue(effectivePlan?.features?.max_routes)}
                </span>
              </div>
              <div className="flex justify-between p-2 bg-muted rounded">
                <span>{t('maxStorage')}</span>
                <span className="font-semibold">
                  {effectivePlan?.features?.storage_gb !== undefined
                    ? formatFeatureValue(effectivePlan.features.storage_gb, true)
                    : formatFeatureValue(effectivePlan?.features?.max_storage_mb)}
                </span>
              </div>
              <div className="flex justify-between p-2 bg-muted rounded">
                <span>{t('photoRetentionDaysLabel')}</span>
                <span className="font-semibold">
                  {effectivePlan?.features?.photo_retention_days !== undefined
                    ? formatFeatureValue(effectivePlan.features.photo_retention_days)
                    : '-'}
                </span>
              </div>
              <div className="flex justify-between p-2 bg-muted rounded">
                <span>{t('prioritySupport')}</span>
                <span className="font-semibold">
                  {formatFeatureValue(effectivePlan?.features?.priority_support)}
                </span>
              </div>
              <div className="flex justify-between p-2 bg-muted rounded">
                <span>{t('advancedAnalytics')}</span>
                <span className="font-semibold">
                  {formatFeatureValue(effectivePlan?.features?.advanced_analytics)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      {provider !== 'payu' && <PaymentMethodsList />}

      {/* Billing History */}
      <Card className="glass-panel border-border/50">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <FileText className="h-5 w-5" />
            </div>
            {t('billingHistory')}
          </CardTitle>
          {invoices.length > 0 && (
            <p className="text-sm text-muted-foreground font-normal mt-1">
              {t('billingHistoryDescription')}
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-6">
          {invoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('noInvoices')}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left font-semibold p-3">{t('invoiceDate')}</th>
                    <th className="text-left font-semibold p-3">{t('invoiceNumber')}</th>
                    <th className="text-right font-semibold p-3">{t('invoiceAmount')}</th>
                    <th className="text-left font-semibold p-3">{t('invoiceStatus')}</th>
                    <th className="text-right font-semibold p-3 w-24">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="p-3">
                        <span className="font-medium">{format(new Date(invoice.issuedAt), 'PP')}</span>
                        {invoice.paidAt && invoice.status === 'paid' && (
                          <span className="block text-xs text-muted-foreground mt-0.5">
                            {t('paidOn')} {format(new Date(invoice.paidAt), 'PP')}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        {invoice.providerInvoiceId
                          ? String(invoice.providerInvoiceId).slice(-12)
                          : invoice.id.slice(0, 8)}
                      </td>
                      <td className="p-3 text-right font-semibold">
                        {formatPrice(invoice.amountCents, invoice.currency)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-semibold ${invoice.status === 'paid' ? 'text-green-600' : invoice.status === 'open' ? 'text-amber-600' : 'text-muted-foreground'}`}
                        >
                          {t(`invoice${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}`)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {invoice.status === 'paid' && (
                          <Button variant="ghost" size="sm">
                            {t('downloadInvoice')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
