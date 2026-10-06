import path from 'path';
import fs from 'fs';

export function getUploadDir(): string {
  if (process.env.UPLOAD_DIR) {
    return process.env.UPLOAD_DIR;
  }

  // If running from frontend directory, root uploads is '../uploads'
  const cwd = process.cwd();
  const rootUploads = path.join(cwd, 'uploads');
  const parentUploads = path.join(cwd, '..', 'uploads');

  if (fs.existsSync(parentUploads)) {
    return path.resolve(parentUploads);
  }

  // Otherwise use local uploads
  if (!fs.existsSync(rootUploads)) {
    fs.mkdirSync(rootUploads, { recursive: true });
  }
  return path.resolve(rootUploads);
}

export function getAllUploadDirs(): string[] {
  const dirs: string[] = [];
  const primary = getUploadDir();
  if (primary && fs.existsSync(primary)) {
    dirs.push(path.resolve(primary));
  }

  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'public', 'uploads'),
    path.resolve(cwd, '..', 'uploads'),
    path.resolve(cwd, 'uploads'),
    path.join(cwd, 'frontend', 'public', 'uploads'),
    path.resolve(cwd, '..', 'frontend', 'public', 'uploads'),
    '/app/uploads',
    '/app/public/uploads',
  ];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      const resolved = path.resolve(c);
      if (!dirs.includes(resolved)) {
        dirs.push(resolved);
      }
    }
  }
  return dirs;
}

