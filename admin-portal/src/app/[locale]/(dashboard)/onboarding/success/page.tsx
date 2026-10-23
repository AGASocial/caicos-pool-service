'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function OnboardingSuccessPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifySession = async () => {
      if (!sessionId) {
        setError('No session ID provided');
        setVerifying(false);
        return;
      }

      try {
        // Wait a moment for webhook to process
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify subscription was created
        const response = await fetch('/api/billing/subscriptions', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.subscription && data.subscription.planId !== 'plan_free') {
            // Success - subscription is active
            setVerifying(false);
          } else {
            // Still processing, wait a bit more
            await new Promise(resolve => setTimeout(resolve, 3000));
            setVerifying(false);
          }
        } else {
          setError('Failed to verify subscription');
          setVerifying(false);
        }
      } catch (err) {
        console.error('Error verifying session:', err);
        setError('Failed to verify subscription');
        setVerifying(false);
      }
    };

    verifySession();
  }, [sessionId]);

  const handleContinue = () => {
    router.push('/dashboard');
  };

  if (verifying) {
    return (
      <div className="container mx-auto py-20 px-4">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <h2 className="text-xl font-semibold">{t('processingPayment')}</h2>
              <p className="text-muted-foreground">
                {t('pleaseWaitWhileWeSetupYourAccount')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-20 px-4">
        <Card className="max-w-md mx-auto border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">{t('paymentError')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => router.push('/billing')} className="w-full">
              {t('goToBilling')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-20 px-4">
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <h2 className="text-2xl font-bold">{t('subscriptionSuccess')}</h2>
            <p className="text-muted-foreground">
              {t('yourSubscriptionIsActive')}
            </p>
            <Button onClick={handleContinue} className="w-full mt-4">
              {t('goToDashboard')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
