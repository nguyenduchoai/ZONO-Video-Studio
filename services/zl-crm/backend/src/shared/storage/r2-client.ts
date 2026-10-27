/**
 * r2-client.ts — Cloudflare R2 storage for chat attachments (thay MinIO từ 2026-08-13).
 *
 * Bucket `zalocrm-media` có lifecycle rule xoá object sau 3 ngày (đặt phía Cloudflare,
 * không phải cron trong app) nên KHÔNG được cache lâu hơn 3 ngày ở edge — URL sẽ trỏ
 * vào object đã bị xoá. Vì vậy Cache-Control = 3 ngày, không dùng immutable 1 năm.
 *
 * URL trả về là `${s3PublicUrl}/${key}` — KHÔNG chèn tên bucket vào path: custom domain
 * crmcdn.shinsulab.com đã trỏ thẳng vào gốc bucket. (Bản MinIO cũ chèn thêm bucket trong
 * khi S3_PUBLIC_URL đã chứa sẵn tên bucket → URL lặp 2 lần, mọi ảnh 404.)
 */
import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { config } from '../../config/index.js';

export const s3Client = new S3Client({
  region: config.s3Region,
  endpoint: config.s3Endpoint,
  credentials: {
    accessKeyId: config.s3AccessKey,
    secretAccessKey: config.s3SecretKey,
  },
  forcePathStyle: true,
});

const BUCKET = config.s3Bucket;
const PUBLIC_BASE = config.s3PublicUrl.replace(/\/+$/, '');

/** Đúng 3 ngày — khớp lifecycle rule của bucket. */
const CACHE_MAX_AGE = 3 * 24 * 60 * 60;

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  mimeType: string;
}

export function publicUrlForKey(key: string): string {
  return `${PUBLIC_BASE}/${key}`;
}

export async function uploadBuffer(buffer: Buffer, mimeType: string, originalName?: string): Promise<UploadResult> {
  const ext = originalName ? extname(originalName) : mimeToExt(mimeType);
  const key = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${ext}`;
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    ContentLength: buffer.length,
    CacheControl: `public, max-age=${CACHE_MAX_AGE}`,
  }));
  return {
    key,
    url: publicUrlForKey(key),
    size: buffer.length,
    mimeType,
  };
}

function mimeToExt(mime: string): string {
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  if (mime === 'video/mp4') return '.mp4';
  if (mime === 'video/quicktime') return '.mov';
  if (mime === 'video/webm') return '.webm';
  return '';
}

/** R2 bucket được tạo sẵn ngoài app — chỉ kiểm tra tồn tại, không tự tạo. */
export async function ensureBucket(): Promise<void> {
  await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
}
