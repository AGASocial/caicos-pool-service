/**
 * Cleanup Photos Beyond Retention
 * 
 * Deletes photos that exceed the plan's photo_retention_days limit.
 * 
 * **SAFETY**: Only deletes photos that have been successfully archived to R2
 * (storage_tier = 'archive' AND archive_key IS NOT NULL) OR photos that are
 * beyond retention in hot storage AND R2 archiving is not configured.
 * 
 * This prevents accidental data loss if archiving fails or is disabled.
 * 
 * Environment variables required:
 * - R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME (optional)
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, DeleteObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    
    if (!authHeader?.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '') &&
        authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if R2 is configured
    const r2Endpoint = Deno.env.get('R2_ENDPOINT');
    const r2AccessKey = Deno.env.get('R2_ACCESS_KEY_ID');
    const r2SecretKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const r2Bucket = Deno.env.get('R2_BUCKET_NAME');
    const r2Configured = !!(r2Endpoint && r2AccessKey && r2SecretKey && r2Bucket);

    let r2Client: S3Client | null = null;
    if (r2Configured) {
      r2Client = new S3Client({
        endpoint: r2Endpoint,
        region: 'auto',
        credentials: {
          accessKeyId: r2AccessKey!,
          secretAccessKey: r2SecretKey!,
        },
      });
    }

    // Get all companies with their plans
    const { data: companies } = await supabase
      .from('cadenza_profiles')
      .select('company_id, id')
      .eq('role', 'owner')
      .eq('is_active', true);

    let totalDeleted = 0;
    const results: { company_id: string; deleted: number; errors: number; skipped?: number }[] = [];

    for (const company of companies || []) {
      try {
        // Get company's plan retention limit
        const { data: subscription } = await supabase
          .from('cadenza_billing_subscriptions')
          .select('plan_id')
          .eq('user_id', company.id)
          .in('status', ['active', 'trialing', 'past_due'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const planId = subscription?.plan_id || 'plan_free';
        const { data: plan } = await supabase
          .from('cadenza_billing_plans')
          .select('features')
          .eq('id', planId)
          .single();

        const features = plan?.features as { photo_retention_days?: number } || {};
        const retentionDays = features.photo_retention_days || 30;

        if (retentionDays === -1) {
          continue; // Unlimited retention
        }

        // Find photos beyond retention
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        // SAFETY: Only select photos that are either:
        // 1. Successfully archived (storage_tier = 'archive' AND archive_key IS NOT NULL)
        // 2. In hot storage AND beyond retention (only if R2 is not configured)
        let query = supabase
          .from('cadenza_report_photos')
          .select('id, archive_key, storage_tier, file_path')
          .eq('company_id', company.company_id)
          .lt('created_at', cutoffDate.toISOString());

        if (r2Configured) {
          // If R2 is configured, only delete archived photos
          query = query.eq('storage_tier', 'archive').not('archive_key', 'is', null);
        }
        // If R2 is not configured, delete all photos beyond retention (hot or archive)

        const { data: photosToDelete } = await query.limit(100);

        if (!photosToDelete?.length) {
          continue;
        }

        let companyDeleted = 0;
        let companyErrors = 0;
        let companySkipped = 0;

        for (const photo of photosToDelete) {
          try {
            // Safety check: skip if in hot storage and R2 is configured but photo wasn't archived
            if (r2Configured && photo.storage_tier === 'hot') {
              console.warn(`Skipping hot photo ${photo.id} - should have been archived but wasn't`);
              companySkipped++;
              continue;
            }

            // Delete from R2 if archived
            if (photo.archive_key && r2Client && r2Bucket) {
              try {
                const deleteCommand = new DeleteObjectCommand({
                  Bucket: r2Bucket,
                  Key: photo.archive_key,
                });
                await r2Client.send(deleteCommand);
              } catch (r2Error) {
                console.error(`Failed to delete from R2: ${photo.archive_key}`, r2Error);
                // Continue with DB deletion even if R2 deletion fails
              }
            } else if (photo.storage_tier === 'hot') {
              // Delete from Supabase Storage if still hot
              try {
                await supabase.storage.from('report-photos').remove([photo.file_path]);
              } catch (storageError) {
                console.error(`Failed to delete from Supabase: ${photo.file_path}`, storageError);
                // Continue with DB deletion even if storage deletion fails
              }
            }

            // Delete DB record
            const { error: deleteError } = await supabase
              .from('cadenza_report_photos')
              .delete()
              .eq('id', photo.id);

            if (deleteError) {
              companyErrors++;
            } else {
              companyDeleted++;
              totalDeleted++;
            }
          } catch (photoError) {
            console.error(`Error deleting photo ${photo.id}:`, photoError);
            companyErrors++;
          }
        }

        results.push({
          company_id: company.company_id,
          deleted: companyDeleted,
          errors: companyErrors,
          ...(companySkipped > 0 && { skipped: companySkipped }),
        });
      } catch (companyError) {
        console.error(`Error processing company ${company.company_id}:`, companyError);
        results.push({
          company_id: company.company_id,
          deleted: 0,
          errors: 1,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        r2_configured: r2Configured,
        total_deleted: totalDeleted,
        companies_processed: results.length,
        results,
        safety_note: r2Configured 
          ? 'Only archived photos were deleted'
          : 'R2 not configured - deleted all photos beyond retention from Supabase Storage',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Cleanup function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
