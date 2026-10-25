/**
 * Cleanup Archived Photos Beyond Retention
 * 
 * Deletes photos from R2 that exceed the plan's photo_retention_days limit.
 * Invoked by pg_cron or scheduled Edge Function trigger.
 * 
 * Environment variables required:
 * - R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
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

    const r2Client = new S3Client({
      endpoint: Deno.env.get('R2_ENDPOINT'),
      region: 'auto',
      credentials: {
        accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
        secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
      },
    });
    const r2Bucket = Deno.env.get('R2_BUCKET_NAME')!;

    // Get all companies with their plans
    const { data: companies } = await supabase
      .from('cadenza_profiles')
      .select('company_id, id')
      .eq('role', 'owner')
      .eq('is_active', true);

    let totalDeleted = 0;
    const results: { company_id: string; deleted: number; errors: number }[] = [];

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

        const { data: photosToDelete } = await supabase
          .from('cadenza_report_photos')
          .select('id, archive_key')
          .eq('company_id', company.company_id)
          .lt('created_at', cutoffDate.toISOString())
          .limit(100);

        if (!photosToDelete?.length) {
          continue;
        }

        let companyDeleted = 0;
        let companyErrors = 0;

        for (const photo of photosToDelete) {
          try {
            // Delete from R2 if archived
            if (photo.archive_key) {
              const deleteCommand = new DeleteObjectCommand({
                Bucket: r2Bucket,
                Key: photo.archive_key,
              });
              await r2Client.send(deleteCommand);
            } else {
              // Delete from Supabase Storage if still hot
              const { data: record } = await supabase
                .from('cadenza_report_photos')
                .select('file_path')
                .eq('id', photo.id)
                .single();

              if (record?.file_path) {
                await supabase.storage.from('report-photos').remove([record.file_path]);
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
        total_deleted: totalDeleted,
        companies_processed: results.length,
        results,
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
