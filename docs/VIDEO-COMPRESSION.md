# Video Upload and Compression Strategy

## Overview

Video upload is a Pro plan feature (plan_pro_month). Maximum video duration is 60 seconds per service report. Videos are compressed server-side after upload to reduce storage costs while maintaining visual quality.

## Client-Side (Technician App)

### Video Capture

Use `expo-image-picker` or `expo-camera` to record videos up to 60 seconds:

```typescript
import * as ImagePicker from 'expo-image-picker';

const result = await ImagePicker.launchCameraAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Videos,
  allowsEditing: false,
  videoMaxDuration: 60, // Enforce 60s limit
  videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
});

if (!result.canceled && result.assets[0]) {
  const video = result.assets[0];
  // Check plan allows video before uploading
  await uploadVideo(video.uri, video.duration);
}
```

### Plan Enforcement

Before upload, check if the user's plan allows video:

```typescript
// In API route or mobile app
const limits = await getUserPlanLimits(supabase, userId);

if (!limits.video_per_service) {
  throw new Error('Video upload requires Pro plan');
}

if (videoDuration > limits.max_video_seconds) {
  throw new Error(`Video exceeds ${limits.max_video_seconds}s limit`);
}
```

### Upload Flow

1. Check plan limits (video_per_service, max_video_seconds)
2. Upload raw video to Supabase Storage bucket `report-videos-raw`
3. Insert record into `cadenza_report_videos` table with `status: 'pending'`
4. Server-side compression job picks it up and processes

## Server-Side Compression

### Approach: Vercel Function + FFmpeg Layer

Since Supabase Edge Functions (Deno) cannot easily run FFmpeg, we use a **Vercel Serverless Function** with FFmpeg included via a Lambda Layer or npm package.

### Option 1: @ffmpeg/ffmpeg (WebAssembly - Slow but Portable)

```typescript
// admin-portal/src/app/api/videos/compress/route.ts
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

export async function POST(request: NextRequest) {
  // Download raw video from Supabase Storage
  // Run FFmpeg to compress with H.264 CRF 25
  // Upload compressed video to report-videos bucket
  // Update database record with new path and status: 'ready'
}
```

**Pros**: No native binaries, works on any platform  
**Cons**: Very slow (10x slower than native FFmpeg), high memory usage

### Option 2: Fluent-FFmpeg + Static Binary (Recommended)

Use a pre-compiled static FFmpeg binary (available via npm packages like `ffmpeg-static`) in a Vercel Function:

```typescript
// admin-portal/src/app/api/videos/compress/route.ts
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

ffmpeg.setFfmpegPath(ffmpegStatic);

export async function POST(request: NextRequest) {
  const { videoId } = await request.json();
  
  // Download from Supabase Storage
  const { data } = await supabase.storage
    .from('report-videos-raw')
    .download(rawPath);

  // Save to /tmp
  const inputPath = `/tmp/${videoId}-raw.mp4`;
  const outputPath = `/tmp/${videoId}-compressed.mp4`;
  await fs.writeFile(inputPath, Buffer.from(await data.arrayBuffer()));

  // Compress with FFmpeg
  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .outputOptions([
        '-crf 25',        // Constant Rate Factor (18-28, lower = better quality)
        '-preset fast',   // Encoding speed preset
        '-movflags +faststart', // Web streaming optimization
      ])
      .audioCodec('aac')
      .audioBitrate('128k')
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });

  // Upload compressed video
  const compressed = await fs.readFile(outputPath);
  await supabase.storage
    .from('report-videos')
    .upload(`${company_id}/${videoId}.mp4`, compressed, {
      contentType: 'video/mp4',
    });

  // Update database
  await supabase
    .from('cadenza_report_videos')
    .update({ status: 'ready', file_path: `...`, size_bytes: compressed.length })
    .eq('id', videoId);

  return NextResponse.json({ success: true });
}
```

**Pros**: Fast native performance, widely used  
**Cons**: Requires FFmpeg binary (adds ~50MB to deployment), may hit Vercel 50MB size limit (use external layer or Docker)

### Option 3: External Processing Service

Offload to a dedicated video processing service:
- **Cloudflare Stream**: Upload → automatic transcoding → HLS delivery
- **Mux**: Similar to Cloudflare Stream, optimized for video APIs
- **AWS MediaConvert**: More control, pay-per-minute transcoding

**Pros**: No infrastructure management, optimized CDN delivery  
**Cons**: Additional cost per video, vendor lock-in

### Option 4: Vercel Queue + Long-Duration Function

For larger video processing needs:

```typescript
// Use Vercel Queues to defer compression to a long-duration function
import { queue } from '@vercel/functions';

// Enqueue job after upload
await queue('video-compression').enqueue({ videoId, userId });

// Worker function (can run up to 30 minutes on Pro/Enterprise)
export async function POST(request: NextRequest) {
  const { videoId } = await request.json();
  // Process with FFmpeg as in Option 2
}
```

**Pros**: Handles long videos without timeout, decouples upload from compression  
**Cons**: Requires Vercel Pro plan ($20/mo), more complex setup

## Recommended Solution

**Start with Option 2 (Fluent-FFmpeg + Static Binary)** for MVP:
- Install `fluent-ffmpeg` and `ffmpeg-static` in admin-portal
- Create `/api/videos/compress` route
- Trigger compression via webhook or immediate API call after upload
- If deployment size exceeds 50MB, switch to Option 4 with Vercel Queue

**Future**: Migrate to Cloudflare Stream or Mux for production scale if video volume grows significantly.

## Database Schema

Add `cadenza_report_videos` table:

```sql
CREATE TABLE cadenza_report_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES cadenza_companies(id),
  service_job_id uuid NOT NULL REFERENCES cadenza_service_jobs(id),
  created_by uuid NOT NULL REFERENCES cadenza_profiles(id),
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  raw_path text,
  file_path text,
  thumb_path text, -- Video thumbnail
  duration_seconds int,
  size_bytes bigint,
  width int,
  height int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_company FOREIGN KEY (company_id) REFERENCES cadenza_companies(id) ON DELETE CASCADE
);

CREATE INDEX idx_report_videos_job ON cadenza_report_videos(service_job_id);
CREATE INDEX idx_report_videos_status ON cadenza_report_videos(status) WHERE status IN ('pending', 'processing');
```

## Environment Variables

Add to `.env.local` (admin-portal):

```bash
# Video compression (if using FFmpeg approach)
FFMPEG_PATH=/usr/bin/ffmpeg  # Or path to ffmpeg-static binary

# Cloudflare Stream (if using external service)
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_STREAM_API_TOKEN=xxx
```

## Cost Estimate

### Storage
- Supabase Storage: ~$0.021/GB/month
- Cloudflare R2 (archive): ~$0.015/GB/month
- Average compressed video (60s, 1080p, H.264 CRF 25): ~5-10 MB

### Bandwidth
- Cloudflare Stream: $1/1000 minutes viewed
- Self-hosted (Supabase): Included in plan, then $0.09/GB

### Processing
- Vercel Functions: Free up to 100 GB-hours/month, then $0.18/GB-hour
- Cloudflare Stream: $5/1000 minutes uploaded

For 100 videos/month: ~$2-5/month (self-hosted) vs ~$10/month (Cloudflare Stream)

## Testing

1. Mock compression locally:
   ```bash
   ffmpeg -i input.mp4 -c:v libx264 -crf 25 -preset fast -movflags +faststart -c:a aac -b:a 128k output.mp4
   ```

2. Test Vercel function locally with `vercel dev`

3. Upload test video via mobile app and verify:
   - Upload succeeds
   - Compression job runs
   - Compressed video is playable
   - Database record updated correctly

## Monitoring

- Track compression job failures in `cadenza_report_videos` table (status = 'failed')
- Alert on pending videos older than 10 minutes (stuck jobs)
- Monitor Vercel function duration and errors

## Future Enhancements

- Generate multiple resolutions (480p, 720p, 1080p) for adaptive streaming
- Support other codecs (H.265/HEVC for better compression)
- Add video preview/thumbnails in admin dashboard
- Implement video watermarking with company logo
