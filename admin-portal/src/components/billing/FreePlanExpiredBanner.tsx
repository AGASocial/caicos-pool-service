"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useIsReadOnly } from "@/lib/company-access-queries";

export function FreePlanExpiredBanner() {
  const t = useTranslations();
  const isReadOnly = useIsReadOnly();

  if (!isReadOnly) return null;

  return (
    <div
      role="alert"
      data-testid="free-plan-expired-banner"
      className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>{t("freePlanExpiredReadOnly")}</p>
        <Link
          href="/billing/plans"
          className="font-medium underline underline-offset-2 hover:no-underline shrink-0"
        >
          {t("upgradeNow")}
        </Link>
      </div>
    </div>
  );
}
