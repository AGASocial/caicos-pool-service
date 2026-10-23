'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { LoadingState } from '@/components/ui/loading-state';

interface PlanFeatures {
  admin_users?: number;
  max_technicians?: number;
  max_properties?: number;
  max_photos_per_service?: number;
  photo_retention_days?: number;
  priority_support?: boolean;
  [key: string]: number | boolean | undefined;
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

export default function OnboardingPage() {
  const t = useTranslations();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/billing/plans', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch plans');
      const data = await response.json();
      // Filter to monthly plans only for onboarding
      setPlans(data.plans.filter((p: Plan) => p.interval === 'month' && p.active));
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error(t('errorLoadingPlans'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    setSubscribing(planId);
    try {
      const plan = plans.find(p => p.id === planId);

      // Free plan - skip to dashboard
      if (plan?.amountCents === 0) {
        router.push('/dashboard');
        return;
      }

      // For paid plans, create checkout session
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          planId,
          quantity,
          mode: 'onboarding',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const result = await response.json();

      // Redirect to Stripe Checkout
      if (result.url) {
        window.location.href = result.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Error selecting plan:', error);
      toast.error(error instanceof Error ? error.message : t('billingError'));
      setSubscribing(null);
    }
  };

  const formatPrice = (amountCents: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amountCents / 100);
  };

  const formatFeatureValue = (value: number | boolean | undefined) => {
    if (value === undefined) return '-';
    if (typeof value === 'boolean') return value ? t('yes') : t('no');
    if (value === -1) return t('unlimited');
    return String(value);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <LoadingState label={t('loadingPlans')} />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
          {t('welcomeToCadenza')}
        </h1>
        <p className="text-muted-foreground mb-8">
          {t('chooseYourPlan')}
        </p>

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
      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {plans.map((plan) => {
          const isStandard = plan.id === 'plan_necessary_month';
          const isFree = plan.amountCents === 0;

          return (
            <Card
              key={plan.id}
              className={`relative ${
                isStandard ? 'border-primary shadow-lg' : ''
              }`}
            >
              {isStandard && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                  {t('recommended')}
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">
                      {isFree ? '$0' : formatPrice(plan.amountCents, plan.currency)}
                    </span>
                    {!isFree && (
                      <span className="text-muted-foreground">
                        <br />
                        <span className="text-xs">
                          {t('perMonth')} / {t('perTechnician')}
                        </span>
                      </span>
                    )}
                    {!isFree && quantity > 1 && (
                      <div className="mt-2 text-sm font-semibold text-foreground">
                        {t('totalPrice')}: {formatPrice(plan.amountCents * quantity, plan.currency)}/{t('perMonth')}
                      </div>
                    )}
                  </div>
                </CardDescription>
              </CardHeader>

              <CardContent className="min-h-[300px]">
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>
                      {t('admins', { admins: formatFeatureValue(plan.features.admin_users) })}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>
                      {t('maxTechnicians', { maxTechnicians: formatFeatureValue(plan.features.max_technicians) })}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>
                      {t('maxProperties', { maxProperties: formatFeatureValue(plan.features.max_properties) })}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>
                      {t('photosPerService', { count: plan.features.max_photos_per_service || 0 })}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span>
                      {t('photoRetentionDays', { photoRetentionDays: plan.features.photo_retention_days || 0 })}
                    </span>
                  </li>
                  {plan.features.priority_support && (
                    <li className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      <span>{t('prioritySupport')}</span>
                    </li>
                  )}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={isStandard ? 'default' : 'outline'}
                  disabled={subscribing !== null}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  {subscribing === plan.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('loading')}
                    </>
                  ) : isFree ? (
                    t('startWithFree')
                  ) : (
                    t('selectPlan')
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="text-center mt-8">
        <Button
          variant="link"
          onClick={() => router.push('/dashboard')}
          disabled={subscribing !== null}
        >
          {t('skipForNow')}
        </Button>
      </div>
    </div>
  );
}
