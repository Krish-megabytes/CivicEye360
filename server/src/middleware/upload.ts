import multer from 'multer';
import { env } from '../config/env.js';
import { ALLOWED_IMAGE_TYPES } from '../domain/constants.js';
import { unprocessable } from '../lib/errors.js';

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.uploads.maxBytes,
    files: 1,
    fields: 8,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      callback(unprocessable('Only JPEG, PNG or WebP images are accepted.'));
      return;
    }
    callback(null, true);
  },
}).single('file');
