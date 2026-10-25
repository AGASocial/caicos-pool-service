/**
 * POST /api/videos/compress
 * Compress uploaded video with visually lossless quality
 * Triggered automatically after video upload or manually for retry
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

ffmpeg.setFfmpegPath(ffmpegPath.path);

const TMP_DIR = '/tmp/cadenza-videos';

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await createAuthenticatedRouteClient();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { videoId } = await request.json();
    if (!videoId) {
      return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
    }

    const client = supabase as unknown as CadenzaSupabaseClient;

    // Get video record
    const { data: video, error: fetchError } = await client
      .from('cadenza_report_videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (fetchError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Verify user belongs to same company
    const { data: profile } = await client
      .from('cadenza_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile || profile.company_id !== video.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update status to processing
    await client
      .from('cadenza_report_videos')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', videoId);

    // Create temp directory
    if (!existsSync(TMP_DIR)) {
      await mkdir(TMP_DIR, { recursive: true });
    }

    const inputPath = path.join(TMP_DIR, `${videoId}-input.mp4`);
    const outputPath = path.join(TMP_DIR, `${videoId}-output.mp4`);

    try {
      // Download raw video from Supabase Storage
      const { data: rawVideo, error: downloadError } = await supabase.storage
        .from('report-videos-raw')
        .download(video.raw_path);

      if (downloadError || !rawVideo) {
        throw new Error(`Download failed: ${downloadError?.message}`);
      }

      // Write to temp file
      const buffer = Buffer.from(await rawVideo.arrayBuffer());
      await writeFile(inputPath, buffer);

      // Compress with FFmpeg (visually lossless quality)
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .videoCodec('libx264')
          .outputOptions([
            '-crf 23',           // Constant Rate Factor (visually lossless)
            '-preset medium',    // Balanced speed/compression
            '-movflags +faststart', // Web streaming optimization
            '-pix_fmt yuv420p',  // Compatibility
          ])
          .audioCodec('aac')
          .audioBitrate('128k')
          .on('end', () => resolve())
          .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
          .save(outputPath);
      });

      // Read compressed video
      const { readFile } = await import('fs/promises');
      const compressed = await readFile(outputPath);

      // Upload compressed video
      const compressedPath = `${video.company_id}/${videoId}.mp4`;
      const { error: uploadError } = await supabase.storage
        .from('report-videos')
        .upload(compressedPath, compressed, {
          contentType: 'video/mp4',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Update database
      await client
        .from('cadenza_report_videos')
        .update({
          status: 'ready',
          file_path: compressedPath,
          compressed_size_bytes: compressed.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', videoId);

      // Cleanup temp files
      await unlink(inputPath).catch(() => {});
      await unlink(outputPath).catch(() => {});

      return NextResponse.json({ success: true, videoId });
    } catch (compressionError) {
      // Update status to failed
      await client
        .from('cadenza_report_videos')
        .update({
          status: 'failed',
          error_message: compressionError instanceof Error ? compressionError.message : 'Compression failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', videoId);

      // Cleanup temp files
      await unlink(inputPath).catch(() => {});
      await unlink(outputPath).catch(() => {});

      throw compressionError;
    }
  } catch (error) {
    console.error('Video compression error:', error);
    return NextResponse.json(
      { error: 'Failed to compress video' },
      { status: 500 }
    );
  }
}
