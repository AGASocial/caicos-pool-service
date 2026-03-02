'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import type { Subscription, PlanDefinition, CheckoutSessionDetails } from '@/lib/billing/types';

const PAYMENT_GATEWAY = process.env.NEXT_PUBLIC_PAYMENT_GATEWAY || 'payu';

interface PlanFeatures {
  admin_users: number;
  max_technicians: number;
  max_properties: number;
  max_routes: number;
  max_service_jobs: number;
  max_photos_per_service: number;
  max_file_size_mb: number;
  max_storage_gb: number;
  photo_retention_days: number;
  trial_days: number;
  priority_support: boolean;
  advanced_analytics: boolean;
  api_access: boolean;
  custom_branding: boolean;
  automated_scheduling: boolean;
  real_time_gps_tracking: boolean;
  sso_saml: boolean;
  dedicated_account_manager: boolean;
}

interface Plan {
  id: string;
  name: string;
  currency: string;
  amountCents: number;
  interval: 'month' | 'year';
  active: boolean;
  features: PlanFeatures;
}

interface SubscriptionWithPlan extends Subscription {
  plan?: PlanDefinition;
}

export default function PlansPage() {
  const t = useTranslations();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>('month');
  const [quantity, setQuantity] = useState(1);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<SubscriptionWithPlan | null>(null);

  useEffect(() => {
    fetchPlans();
    fetchCurrentSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCurrentSubscription = async () => {
    try {
      const response = await fetch('/api/billing/subscriptions', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        const sub = data.subscription;
        const periodEnd = sub?.currentPeriodEnd;
        const isExpired = periodEnd && new Date(periodEnd) < new Date();
        if (sub && isExpired) {
          setCurrentSubscription({ id: 'free', planId: 'plan_free' } as SubscriptionWithPlan);
        } else {
          setCurrentSubscription(sub ?? null);
        }
      }
    } catch (error) {
      console.error('Error fetching current subscription:', error);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/billing/plans', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch plans');
      const data = await response.json();
      setPlans(data.plans);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error(t('errorLoadingPlans'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    setSubscribing(planId);
    try {
      const plan = plans.find(p => p.id === planId);

      // Free plan - users are already on it by default
      if (plan?.amountCents === 0) {
        toast.info(t('alreadyOnFreePlan'));
        router.push('/billing');
        return;
      }

      if (PAYMENT_GATEWAY !== 'payu') {
        // Check if user has a payment method
        const pmResponse = await fetch('/api/billing/payment-methods', {
          credentials: 'include'
        });

        if (!pmResponse.ok) {
          toast.error(t('billingError'));
          return;
        }

        const { paymentMethods } = await pmResponse.json();

        if (!paymentMethods || paymentMethods.length === 0) {
          toast.error(t('addPaymentMethodFirst'));
          router.push('/billing');
          return;
        }
      }

      // Check if user has existing subscription (not Free plan)
      const hasExistingSubscription = currentSubscription &&
                                      currentSubscription.planId !== 'plan_free' &&
                                      currentSubscription.id !== 'free';

      let response;
      if (hasExistingSubscription) {
        // Update existing subscription
        response = await fetch('/api/billing/subscriptions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            subscriptionId: currentSubscription.id,
            planId,
          }),
        });
      } else {
        // Create new subscription
        response = await fetch('/api/billing/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ planId, quantity }),
        });
      }

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create subscription');
      }

      if (PAYMENT_GATEWAY === 'payu' && result.checkoutSession) {
        startPayuCheckout(result.checkoutSession);
        return;
      }

      toast.success(hasExistingSubscription ? t('subscriptionUpdatedSuccess') : t('subscriptionCreatedSuccess'));
      router.push('/billing');
    } catch (error) {
      console.error('Error subscribing:', error);
      toast.error(error instanceof Error ? error.message : t('billingError'));
    } finally {
      setSubscribing(null);
    }
  };

  const startPayuCheckout = (session: CheckoutSessionDetails) => {
    if (!session.formFields || !session.url) {
      toast.error(t('billingError'));
      return;
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = session.url;
    form.style.display = 'none';

    Object.entries(session.formFields).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  };

  const formatPrice = (amountCents: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amountCents / 100);
  };

  const formatFeatureValue = (key: string, value: number | boolean) => {
    console.log('key', key, value);
    if (typeof value === 'boolean') {
      return value ? t('yes') : t('no');
    }
    if (value === -1) {
      return t('unlimited');
    }
    if (key.includes('storage') || key.includes('file_size')) {
      return `${value} MB`;
    }
    
    return value.toString().replace('-1', t('unlimited'));
  };

  const filteredPlans = plans.filter(plan => plan.interval === billingCycle);

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <div className="text-center">{t('loadingPlans')}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-4 text-black dark:text-white">{t('pricing')}</h1>
        <p className="text-muted-foreground mb-8">
          {t('choosePlan')}
        </p>

        {/* Billing Cycle Toggle */}
        <div className="inline-flex items-center gap-4 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setBillingCycle('month')}
            className={`px-6 py-2 rounded-md transition-colors ${
              billingCycle === 'month'
                ? 'bg-background shadow-sm'
                : 'hover:bg-background/50'
            }`}
          >
            {t('monthly')}
          </button>
          <button
            onClick={() => setBillingCycle('year')}
            className={`px-6 py-2 rounded-md transition-colors ${
              billingCycle === 'year'
                ? 'bg-background shadow-sm'
                : 'hover:bg-background/50'
            }`}
          >
            {t('yearly')}
            <span className="ml-2 text-xs text-green-600 font-semibold">
              {t('saveWithYearly')}
            </span>
          </button>
        </div>

        {/* Number of technicians (seats) */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <label htmlFor="quantity" className="text-sm font-medium text-muted-foreground">
            {t('numberOfTechnicians')}:
          </label>
          <input
            id="quantity"
            type="number"
            min={1}
            max={500}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)))}
            className="w-20 rounded-md border border-input bg-background px-3 py-2 text-center text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto px-4 justify-center items-center">
        {filteredPlans.map((plan) => {
          const isPremium = plan.name === 'Necessary';
          const isActive = plan.active;
          const isCurrentPlan = currentSubscription?.planId === plan.id;

          return (
            <Card
              key={plan.id}
              className={`relative min-h-[600px] ${isActive ? '' : 'opacity-60'} ${
                isPremium ? 'border-primary shadow-lg' : ''
              }`}
            >
              {isPremium && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-green-600 text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                  {t('popular')}
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">
                      {formatPrice(plan.amountCents, plan.currency)}
                    </span>
                    <span className="text-muted-foreground">
                      <br /> <span className="text-xs text-muted-foreground">
                      {plan.interval === 'month' ? t('perMonth') : t('perYear')}
                        {' / '}
                        {t('perTechnician')}
                      </span>
                    </span>
                    {plan.amountCents > 0 && quantity > 1 && (
                      <div className="mt-2 text-sm font-semibold text-foreground">
                        {t('totalPrice')}: {formatPrice(plan.amountCents * quantity, plan.currency)}
                        /{plan.interval === 'month' ? t('perMonth') : t('perYear')}
                      </div>
                    )}
                  </div>
                  <div className="text-xs mt-2">
                    {/* {plan.interval === 'month' ? t('billedMonthly') : t('billedYearly')} */}
                  </div>
                </CardDescription>
              </CardHeader>

              <CardContent className="min-h-[300px]">
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>
                      {t('admins', { admins: formatFeatureValue('admin_users', plan.features.admin_users) })}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>
                      {t('maxTechnicians', { maxTechnicians: formatFeatureValue('max_technicians', plan.features.max_technicians) })}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>
                      {t('maxRoutes', { maxRoutes: formatFeatureValue('max_routes', plan.features.max_routes) })}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>                     
                      {t('maxProperties', { maxProperties: formatFeatureValue('max_properties', plan.features.max_properties) })}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>                      
                      {t('photoRetentionDays', { photoRetentionDays: plan.features.photo_retention_days })}
                    </span>
                  </li>
                  {plan.features.advanced_analytics && (
                    <li className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      <span>{t('advancedAnalytics')}</span>
                    </li>
                  )}
                  {plan.features.priority_support && (
                    <li className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      <span>{t('prioritySupport')}</span>
                    </li>
                  )}
                </ul>
              </CardContent>

              <CardFooter>
                {isActive && (
                <Button
                  className="w-full"
                  variant={isPremium ? 'default' : 'outline'}
                  disabled={subscribing === plan.id || isCurrentPlan}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {subscribing === plan.id
                    ? t('loading')
                    : isCurrentPlan
                    ? t('currentPlan')
                    : t('subscribe')}
                </Button>
                )}
                {!isActive && (
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={true}
                  >
                    {t('comingSoon')}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
