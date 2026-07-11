// =============================================================================
// EduDrive — S3-Compatible Storage Service
// =============================================================================
// Abstracts file upload/download/delete operations against any S3-compatible
// storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO).
//
// Configuration is done via environment variables:
//   S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET
//
// PLUGIN DEVELOPERS: Import this service to handle any file storage needs.
// Example: const { uploadFile } = await import('../services/storage.service.js');
// =============================================================================

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

// --- S3 Client Setup ---------------------------------------------------------

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'auto',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
});

const BUCKET = process.env.S3_BUCKET || 'edudrive-files';

// --- Public API --------------------------------------------------------------

/**
 * Upload a file to S3-compatible storage.
 *
 * @param {Buffer} fileBuffer - The file contents
 * @param {string} originalName - Original filename (for extension extraction)
 * @param {string} mimeType - MIME type of the file
 * @param {string} ownerId - UUID of the file owner (used in storage path)
 * @returns {Promise<{storageKey: string, size: number}>} Storage key and file size
 */
export async function uploadFile(fileBuffer, originalName, mimeType, ownerId) {
  // Generate a unique storage key: owner_id/uuid.extension
  const extension = originalName.split('.').pop() || 'bin';
  const storageKey = `${ownerId}/${uuidv4()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: storageKey,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);

  return {
    storageKey,
    size: fileBuffer.length,
  };
}

/**
 * Generate a pre-signed download URL for a file.
 * The URL is valid for 1 hour by default.
 *
 * @param {string} storageKey - The S3 key of the file
 * @param {number} [expiresIn=3600] - URL expiry in seconds (default: 1 hour)
 * @returns {Promise<string>} Pre-signed download URL
 */
export async function getDownloadUrl(storageKey, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: storageKey,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Get a readable stream for a file from S3-compatible storage.
 *
 * @param {string} storageKey - The S3 key of the file
 * @returns {Promise<ReadableStream>} File body stream
 */
export async function getFileStream(storageKey) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: storageKey,
  });

  const response = await s3Client.send(command);
  return response.Body;
}

/**
 * Delete a file from S3-compatible storage.
 *
 * @param {string} storageKey - The S3 key of the file to delete
 * @returns {Promise<void>}
 */
export async function deleteFile(storageKey) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: storageKey,
  });

  await s3Client.send(command);
}
