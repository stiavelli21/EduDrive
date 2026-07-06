// =============================================================================
// EduDrive — Nodes Routes
// =============================================================================
// Maps HTTP endpoints to nodes controller functions.
// All routes require authentication.
//
// File upload uses multer middleware with memory storage and size limit.
//
// PLUGIN DEVELOPERS: To add new node-related endpoints, add them here
// and create corresponding controller functions.
// =============================================================================

import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  validate,
  createFolderSchema,
  createQuickLinkSchema,
  updateNodeSchema,
} from '../utils/validation.js';
import {
  listRootNodes,
  getNode,
  listChildren,
  createFolder,
  uploadFileHandler,
  createQuickLink,
  updateNode,
  deleteNode,
} from '../controllers/nodes.controller.js';

const router = Router();

// --- Multer Setup (file upload handling) ------------------------------------
const maxFileSize = (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 50) * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize },
  fileFilter: (_req, file, cb) => {
    // Allow common document types — extend this list as needed
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/markdown',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type "${file.mimetype}" is not allowed`), false);
    }
  },
});

// All routes require authentication
router.use(authenticate);

// --- Routes -----------------------------------------------------------------

// List root nodes (query ?shared=true for shared-with-me)
router.get('/', listRootNodes);

// Get single node details
router.get('/:id', getNode);

// List children of a folder
router.get('/:id/children', listChildren);

// Create a new folder
router.post('/folder', validate(createFolderSchema), createFolder);

// Upload a file (multipart/form-data)
router.post('/upload', upload.single('file'), uploadFileHandler);

// ⭐ Create a QuickLink (the innovative feature!)
router.post('/quicklink', validate(createQuickLinkSchema), createQuickLink);

// Rename or move a node
router.put('/:id', validate(updateNodeSchema), updateNode);

// Delete a node
router.delete('/:id', deleteNode);

export default router;
