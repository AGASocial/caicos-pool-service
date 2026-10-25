/**
 * Archive Photos to Cloudflare R2
 * 
 * Nightly job that moves photos older than photo_hot_storage_days from
 * Supabase Storage to Cloudflare R2 for cost-effective long-term storage.
 * 
 * Invoked by pg_cron or scheduled Edge Function trigger.
 * 
 * Environment variables required:
 * - R2_ENDPOINT: R2 endpoint URL (e.g., https://<account-id>.r2.cloudflarestorage.com)
 * - R2_ACCESS_KEY_ID: R2 access key
 * - R2_SECRET_ACCESS_KEY: R2 secret key
 * - R2_BUCKET_NAME: R2 bucket name for archived photos
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3';

interface ArchivePhotoRecord {
  id: string;
  company_id: string;
  service_job_id: string;
  file_path: string;
  thumb_path?: string;
  created_at: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify auth (require service role or cron secret)
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

    // Initialize R2 client (S3-compatible)
    const r2Client = new S3Client({
      endpoint: Deno.env.get('R2_ENDPOINT'),
      region: 'auto',
      credentials: {
        accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
        secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
      },
    });
    const r2Bucket = Deno.env.get('R2_BUCKET_NAME')!;

    // Get all active companies with their plans
    const { data: companies, error: companiesError } = await supabase
      .from('cadenza_profiles')
      .select('company_id, id')
      .eq('role', 'owner')
      .eq('is_active', true);

    if (companiesError) {
      throw companiesError;
    }

    let totalArchived = 0;
    const results: { company_id: string; archived: number; errors: number }[] = [];

    // Process each company
    for (const company of companies || []) {
      try {
        // Get company's plan to determine hot storage days
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

        const features = plan?.features as { photo_hot_storage_days?: number } || {};
        const hotStorageDays = features.photo_hot_storage_days || 30;

        // Find photos older than hot storage threshold
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - hotStorageDays);

        const { data: photosToArchive, error: photosError } = await supabase
          .from('cadenza_report_photos')
          .select('id, company_id, service_job_id, file_path, thumb_path, created_at')
          .eq('company_id', company.company_id)
          .eq('storage_tier', 'hot')
          .lt('created_at', cutoffDate.toISOString())
          .limit(100); // Batch size per company

        if (photosError || !photosToArchive?.length) {
          continue;
        }

        let companyArchived = 0;
        let companyErrors = 0;

        // Archive each photo
        for (const photo of photosToArchive as ArchivePhotoRecord[]) {
          try {
            // Download from Supabase Storage
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('report-photos')
              .download(photo.file_path);

            if (downloadError) {
              console.error(`Failed to download ${photo.file_path}:`, downloadError);
              companyErrors++;
              continue;
            }

            // Generate R2 key
            const archiveKey = `${photo.company_id}/${new Date(photo.created_at).getFullYear()}/${photo.id}${photo.file_path.substring(photo.file_path.lastIndexOf('.'))}`;

            // Upload to R2
            const uploadCommand = new PutObjectCommand({
              Bucket: r2Bucket,
              Key: archiveKey,
              Body: await fileData.arrayBuffer(),
              ContentType: 'image/jpeg',
              Metadata: {
                company_id: photo.company_id,
                service_job_id: photo.service_job_id,
                original_path: photo.file_path,
                archived_at: new Date().toISOString(),
              },
            });

            await r2Client.send(uploadCommand);

            // Get file size
            const sizeBytes = fileData.size;

            // Update database record
            const { error: updateError } = await supabase
              .from('cadenza_report_photos')
              .update({
                storage_tier: 'archive',
                archive_key: archiveKey,
                archived_at: new Date().toISOString(),
                size_bytes: sizeBytes,
              })
              .eq('id', photo.id);

            if (updateError) {
              console.error(`Failed to update DB for ${photo.id}:`, updateError);
              companyErrors++;
              continue;
            }

            // Delete from Supabase Storage
            const { error: deleteError } = await supabase.storage
              .from('report-photos')
              .remove([photo.file_path]);

            if (deleteError) {
              console.warn(`Failed to delete from Supabase: ${photo.file_path}`, deleteError);
            }

            companyArchived++;
            totalArchived++;
          } catch (photoError) {
            console.error(`Error archiving photo ${photo.id}:`, photoError);
            companyErrors++;
          }
        }

        results.push({
          company_id: company.company_id,
          archived: companyArchived,
          errors: companyErrors,
        });
      } catch (companyError) {
        console.error(`Error processing company ${company.company_id}:`, companyError);
        results.push({
          company_id: company.company_id,
          archived: 0,
          errors: 1,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_archived: totalArchived,
        companies_processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Archive function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
