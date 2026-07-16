import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

export const AVATAR_UPLOAD_DIR = join(process.cwd(), 'uploads', 'avatars');
export const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });

export const avatarUploadOptions = {
  storage: diskStorage({
    destination: AVATAR_UPLOAD_DIR,
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: AVATAR_MAX_SIZE_BYTES },
  fileFilter: (_req: unknown, file: { mimetype: string }, callback: (error: Error | null, accept: boolean) => void) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      callback(new BadRequestException('Format file harus JPEG, PNG, atau WEBP'), false);
      return;
    }
    callback(null, true);
  },
};

// Sisi aman: pastikan folder ada juga saat dipanggil ulang (mis. setelah cleanup manual).
export const ensureAvatarUploadDir = () => {
  if (!existsSync(AVATAR_UPLOAD_DIR)) mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
};
