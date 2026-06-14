"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Building2, Users, Route } from 'lucide-react';

type WizardStep = 'welcome' | 'overview' | 'final';

const STEPS: WizardStep[] = ['welcome', 'overview', 'final'];

export default function WizardPage() {
  const t = useTranslations();
  const { user } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [loading, setLoading] = useState(false);

  const stepIndex = STEPS.indexOf(currentStep);

  const handleNext = () => {
    const next = STEPS[stepIndex + 1];
    if (next) setCurrentStep(next);
  };

  const handleBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setCurrentStep(prev);
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wizard/complete', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to complete setup');
      }

      toast.success(t('wizard-final-congrats'));
      router.push('/dashboard');
    } catch (error) {
      console.error('Wizard completion error:', error);
      const message = error instanceof Error ? error.message : null;
      toast.error(message || t('errorSavingAsset') || 'An error occurred while completing setup.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="text-center px-4 sm:px-0">
            <h1 className="text-xl sm:text-2xl font-bold mb-4 text-foreground">
              {t('wizard-welcome-title', { name: user?.user_metadata?.full_name || user?.email || 'User' })}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mb-6">
              {t('wizard-cadenza-welcome-description')}
            </p>
            <Button onClick={handleNext} className="w-full sm:w-auto px-8">
              {t('wizard-continue')}
            </Button>
          </div>
        );

      case 'overview':
        return (
          <div className="px-4 sm:px-0">
            <h1 className="text-xl sm:text-2xl font-bold mb-4 text-foreground">
              {t('wizard-cadenza-overview-title')}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mb-6">
              {t('wizard-cadenza-overview-description')}
            </p>
            <ul className="space-y-4 mb-6">
              <li className="flex items-start gap-3 rounded-lg border p-4">
                <Building2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">{t('properties')}</p>
                  <p className="text-sm text-muted-foreground">{t('wizard-cadenza-properties-hint')}</p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-lg border p-4">
                <Users className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">{t('team')}</p>
                  <p className="text-sm text-muted-foreground">{t('wizard-cadenza-team-hint')}</p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-lg border p-4">
                <Route className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">{t('routes')}</p>
                  <p className="text-sm text-muted-foreground">{t('wizard-cadenza-routes-hint')}</p>
                </div>
              </li>
            </ul>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                {t('back')}
              </Button>
              <Button onClick={handleNext} className="flex-1">
                {t('wizard-next')}
              </Button>
            </div>
          </div>
        );

      case 'final':
        return (
          <div className="text-center px-4 sm:px-0 text-foreground">
            <h1 className="text-xl sm:text-2xl font-bold mb-4 text-foreground">
              {t('wizard-cadenza-final-title')}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mb-6">
              {t('wizard-cadenza-final-description')}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                {t('back')}
              </Button>
              <Button onClick={handleFinish} disabled={loading} className="flex-1">
                {loading ? t('saving') : t('wizard-finish')}
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <ProtectedRoute>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8">
        <div className="mb-6 sm:mb-8">
          <div className="block sm:hidden mb-6">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-medium mx-auto mb-2">
                  {stepIndex + 1}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Step {stepIndex + 1} of {STEPS.length}
                </p>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center justify-center mb-4">
            <div className="flex items-center space-x-6">
              {STEPS.map((step, index) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-medium ${
                      currentStep === step
                        ? 'bg-blue-600 text-white'
                        : index < stepIndex
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {index + 1}
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`w-24 h-1 mx-3 ${
                        index < stepIndex ? 'bg-green-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        {renderStep()}
      </div>
    </ProtectedRoute>
  );
}
