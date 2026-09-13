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
