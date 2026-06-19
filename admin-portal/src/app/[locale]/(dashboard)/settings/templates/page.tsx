import { useTranslations } from 'next-intl';
import { MessageTemplatesSettings } from '@/components/settings/MessageTemplatesSettings';

export default function MessageTemplatesPage() {
  const t = useTranslations('settings');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">{t('messageTemplates')}</h2>
        <p className="text-sm text-muted-foreground">{t('messageTemplatesDescription')}</p>
      </div>
      <div className="border-t border-muted" />
      <MessageTemplatesSettings />
    </div>
  );
}
