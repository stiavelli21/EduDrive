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

import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const LOCAL_STORAGE_DIRS = [
  path.resolve(process.cwd(), 'local_storage'),
  path.resolve(process.cwd(), 'backend', 'local_storage'),
  path.resolve(__dirname, '../../local_storage'),
  path.resolve(__dirname, '../../../local_storage'),
];

function getNormalizedKeys(storageKey) {
  if (!storageKey) return [];
  // Strip file:/// prefix if present
  let cleanKey = storageKey;
  if (cleanKey.startsWith('file:///')) {
    cleanKey = cleanKey.replace(/^file:\/\/\//i, '');
    // On Windows, if the path doesn't start with a drive letter after file:///, we might need to handle it.
    // But usually file:///C:/... becomes C:/... which is an absolute path.
  }
  
  cleanKey = cleanKey.replace(/^(\.[/\\])?(backend[/\\])?(local_storage[/\\])?/, '').replace(/^[/\\]+/, '');
  const normalizedSlash = cleanKey.replace(/\\/g, '/');
  const normalizedBackslash = cleanKey.replace(/\//g, '\\');
  const baseName = path.basename(normalizedSlash);
  
  // Se la stringa originale aveva file:///, aggiungiamo anche la versione decodificata con decodeURI
  let decodedUri = storageKey;
  try {
    if (storageKey.startsWith('file:///')) {
      decodedUri = decodeURI(storageKey.replace(/^file:\/\/\//i, ''));
    }
  } catch(e) {}
  
  return [...new Set([storageKey, cleanKey, normalizedSlash, normalizedBackslash, baseName, decodedUri])].filter(Boolean);
}

function searchFileRecursively(dir, filename, maxDepth) {
  if (maxDepth < 0) return null;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && entry.name === filename) {
        return fullPath;
      } else if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        const found = searchFileRecursively(fullPath, filename, maxDepth - 1);
        if (found) return found;
      }
    }
  } catch (_) {}
  return null;
}

function findLocalFile(storageKey) {
  if (!storageKey) return null;
  const keysToCheck = getNormalizedKeys(storageKey);

  for (const k of keysToCheck) {
    if (path.isAbsolute(k) && fs.existsSync(k)) return k;
    if (fs.existsSync(k)) return k;
    const resCwd = path.resolve(process.cwd(), k);
    if (fs.existsSync(resCwd)) return resCwd;
  }

  for (const dir of LOCAL_STORAGE_DIRS) {
    for (const k of keysToCheck) {
      if (path.isAbsolute(k)) continue;
      const fullPath = path.join(dir, k);
      if (fs.existsSync(fullPath)) return fullPath;
    }
  }

  const targetName = path.basename(storageKey.replace(/\\/g, '/'));
  if (targetName && targetName !== '.' && targetName !== '..') {
    for (const dir of LOCAL_STORAGE_DIRS) {
      if (!fs.existsSync(dir)) continue;
      const found = searchFileRecursively(dir, targetName, 3);
      if (found) return found;
    }
  }

  return null;
}

function getLocalFilePath(storageKey) {
  const existing = findLocalFile(storageKey);
  if (existing) return existing;
  const clean = storageKey ? storageKey.replace(/^(\.[/\\])?(backend[/\\])?(local_storage[/\\])?/, '').replace(/^[/\\]+/, '') : storageKey;
  return path.join(path.resolve(__dirname, '../../local_storage'), clean || storageKey);
}

// --- Public API --------------------------------------------------------------

/**
 * Upload a file to S3-compatible storage or local device disk.
 *
 * @param {Buffer} fileBuffer - The file contents
 * @param {string} originalName - Original filename (for extension extraction)
 * @param {string} mimeType - MIME type of the file
 * @param {string} ownerId - UUID of the file owner (used in storage path)
 * @param {string} [storageLocation='cloud'] - 'cloud' or 'local'
 * @returns {Promise<{storageKey: string, size: number}>} Storage key and file size
 */
export async function uploadFile(fileBuffer, originalName, mimeType, ownerId, storageLocation = 'cloud') {
  const ext = path.extname(originalName).slice(1) || 'bin';
  const storageKey = `${ownerId}/${uuidv4()}.${ext}`;

  if (storageLocation === 'local') {
    const fullPath = getLocalFilePath(storageKey);
    await fsPromises.mkdir(path.dirname(fullPath), { recursive: true });
    await fsPromises.writeFile(fullPath, fileBuffer);
    return {
      storageKey,
      size: fileBuffer.length,
    };
  }

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
 * Generate a pre-signed download URL or local endpoint path for a file.
 *
 * @param {string} storageKey - The key of the file
 * @param {number} [expiresIn=3600] - URL expiry in seconds
 * @param {string} [storageLocation='cloud'] - 'cloud' or 'local'
 * @param {string} [nodeId] - Optional node UUID for local content route
 * @returns {Promise<string>} Pre-signed or local download URL
 */
export async function getDownloadUrl(storageKey, expiresIn = 3600, storageLocation = 'cloud', nodeId = null) {
  if (storageLocation === 'local') {
    if (nodeId) {
      return `/api/nodes/${nodeId}/content`;
    }
    return `/api/nodes/local-download?key=${encodeURIComponent(storageKey)}`;
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: storageKey,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Get a readable stream for a file from S3 or local disk.
 *
 * @param {string} storageKey - The key of the file
 * @param {string} [storageLocation='cloud'] - 'cloud' or 'local'
 * @returns {Promise<ReadableStream|fs.ReadStream>} File body stream
 */
export async function getFileStream(storageKey, storageLocation = 'cloud') {
  const localFile = findLocalFile(storageKey);
  if (localFile) {
    return fs.createReadStream(localFile);
  }

  // Fast-fail per file locali: se la locazione è locale (o siamo in LOCAL_MODE)
  // e il file non è stato trovato sul disco, non ha senso provare a scaricarlo da S3.
  if (storageLocation === 'local' || process.env.LOCAL_MODE === 'true') {
    throw new Error(`File locale non trovato sul dispositivo: ${storageKey}`);
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
    });
    const response = await s3Client.send(command);
    return response.Body;
  } catch (err) {
    const keysToCheck = getNormalizedKeys(storageKey);
    for (const k of keysToCheck) {
      if (k === storageKey) continue;
      try {
        const cmd = new GetObjectCommand({
          Bucket: BUCKET,
          Key: k,
        });
        const resp = await s3Client.send(cmd);
        return resp.Body;
      } catch (_) {}
    }

    if (storageLocation === 'local' || process.env.LOCAL_MODE === 'true') {
      throw new Error(`File locale o in cloud non trovato sul dispositivo: ${storageKey}`);
    }
    throw err;
  }
}

/**
 * Delete a file from S3 or local disk.
 *
 * @param {string} storageKey - The key of the file to delete
 * @param {string} [storageLocation='cloud'] - 'cloud' or 'local'
 * @returns {Promise<void>}
 */
export async function deleteFile(storageKey, storageLocation = 'cloud') {
  if (storageLocation === 'local' || process.env.LOCAL_MODE === 'true') {
    const localFile = findLocalFile(storageKey);
    if (localFile) {
      try {
        await fsPromises.unlink(localFile);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.warn('Errore durante la rimozione file locale:', err.message);
        }
      }
      return;
    }
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: storageKey }));
    } catch (_) {}
    return;
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
    });
    await s3Client.send(command);
  } catch (err) {
    const localFile = findLocalFile(storageKey);
    if (localFile) {
      try { await fsPromises.unlink(localFile); } catch (_) {}
    }
  }
}
