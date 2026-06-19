import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { mapReportRow, normalizeIssueCategories } from '@/lib/service-report';
import {
  DEFAULT_EMAIL_TEMPLATE,
  DEFAULT_SMS_TEMPLATE,
  DEFAULT_TEMPLATE_LOCALE,
  buildIssueDetailsInput,
  formatTemplateDate,
  formatTemplateForClipboard,
  issueCategoryLabels,
  normalizeTemplateRow,
  renderTemplate,
  resolveTemplateLocale,
  selectMessageTemplate,
} from '@/lib/message-templates';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params;
  const channel = request.nextUrl.searchParams.get('channel') === 'sms' ? 'sms' : 'email';
  const locale = resolveTemplateLocale(
    request.nextUrl.searchParams.get('locale') ?? DEFAULT_TEMPLATE_LOCALE,
  );

  const { supabase, user } = await createAuthenticatedRouteClient();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as CadenzaSupabaseClient;

  const { data: job, error: jobErr } = await client
    .from('cadenza_service_jobs')
    .select(`
      id,
      scheduled_date,
      company_id,
      property:cadenza_properties!property_id(
        customer_name,
        customer_email,
        customer_phone,
        address,
        city
      ),
      company:cadenza_companies!company_id(name)
    `)
    .eq('id', jobId)
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const { data: reportRow } = await client
    .from('cadenza_service_reports')
    .select('issue_categories, follow_up_notes')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const report = reportRow ? mapReportRow(reportRow as Record<string, unknown>) : null;
  const issueKeys = normalizeIssueCategories(report?.issue_categories);

  const { data: templateRows } = await client
    .from('cadenza_message_templates')
    .select('id, company_id, channel, locale, name, subject, body, issue_categories, is_default')
    .eq('channel', channel)
    .eq('locale', locale);

  const templates = (templateRows ?? []).map((row) =>
    normalizeTemplateRow(row as Record<string, unknown>),
  );

  const jobCompanyId = String((job as { company_id: string }).company_id);
  const fallback =
    channel === 'email'
      ? { ...DEFAULT_EMAIL_TEMPLATE, id: 'default', company_id: jobCompanyId }
      : { ...DEFAULT_SMS_TEMPLATE, id: 'default', company_id: jobCompanyId };

  const selected = selectMessageTemplate(templates, channel, issueKeys, locale) ?? fallback;

  const jobRecord = job as Record<string, unknown>;
  const property = Array.isArray(jobRecord.property)
    ? jobRecord.property[0]
    : jobRecord.property;
  const company = Array.isArray(jobRecord.company)
    ? jobRecord.company[0]
    : jobRecord.company;

  const propertyRecord = property as Record<string, string> | null | undefined;
  const addressParts = [propertyRecord?.address, propertyRecord?.city].filter(Boolean);
  const rawDate = String(jobRecord.scheduled_date ?? '');

  const issueDetails = buildIssueDetailsInput({
    issueCategoryLabels: issueCategoryLabels(issueKeys, locale),
    followUpNotes: report?.follow_up_notes,
    inline: channel === 'sms',
    locale,
  });

  const mergeVars = {
    customer_name: propertyRecord?.customer_name ?? '',
    customer_email: propertyRecord?.customer_email ?? '',
    customer_phone: propertyRecord?.customer_phone ?? '',
    property_address: addressParts.join(', '),
    scheduled_date: formatTemplateDate(rawDate),
    technician_name: '',
    company_name: (company as { name?: string } | null)?.name ?? '',
    issue_details: issueDetails,
    issue_categories: issueCategoryLabels(issueKeys, locale).join(', '),
  };

  const renderedSubject = selected.subject
    ? renderTemplate(selected.subject, mergeVars, locale)
    : null;
  const renderedBody = renderTemplate(selected.body, mergeVars, locale);

  return NextResponse.json({
    template_id: selected.id,
    template_name: selected.name,
    channel,
    locale,
    customer_email: mergeVars.customer_email || null,
    customer_phone: mergeVars.customer_phone || null,
    subject: renderedSubject,
    body: renderedBody,
    clipboard_text: formatTemplateForClipboard(channel, renderedSubject, renderedBody),
  });
}
