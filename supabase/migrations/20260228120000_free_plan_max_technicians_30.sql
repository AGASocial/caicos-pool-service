-- Set free plan technician limit to 3 for MVP (hard cap on invitations)
UPDATE public.caicos_billing_plans
SET features = jsonb_set(
  COALESCE(features, '{}'::jsonb),
  '{max_technicians}',
  '30'::jsonb
)
WHERE id = 'plan_free';
