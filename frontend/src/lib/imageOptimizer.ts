import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.avif']);

export interface OptimizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export interface OptimizedResult {
  buffer: Buffer;
  filename: string;
  isImage: boolean;
  sizeKb: string;
}

/**
 * Procesa un buffer de archivo. Si es imagen, la redimensiona (máximo 1600px por defecto)
 * y la comprime en formato WebP con excelente calidad y mínimo peso.
 */
export async function optimizeImageBuffer(
  inputBuffer: Buffer,
  originalFilename: string,
  options: OptimizeOptions = {}
): Promise<OptimizedResult> {
  const ext = path.extname(originalFilename).toLowerCase();

  // Si no es un formato de imagen soportado, devolver sin modificar
  if (!IMAGE_EXTENSIONS.has(ext)) {
    const sizeKb = (inputBuffer.length / 1024).toFixed(2);
    return {
      buffer: inputBuffer,
      filename: originalFilename,
      isImage: false,
      sizeKb,
    };
  }

  const maxWidth = options.maxWidth || 1600;
  const maxHeight = options.maxHeight || 1600;
  const quality = options.quality || 82;

  try {
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();

    let pipeline = image.rotate(); // Respeta orientación EXIF automáticamente

    // Redimensionar solo si excede los límites (evita resoluciones 4K innecesarias)
    if (
      metadata.width &&
      metadata.height &&
      (metadata.width > maxWidth || metadata.height > maxHeight)
    ) {
      pipeline = pipeline.resize({
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convertir a WebP con compresión de alta fidelidad
    const optimizedBuffer = await pipeline
      .webp({
        quality,
        effort: 4,
        lossless: false,
        alphaQuality: 90, // Mantiene nitidez en transparencias de logos
      })
      .toBuffer();

    const baseName = path.basename(originalFilename, ext);
    const newFilename = `${baseName}.webp`;
    const sizeKb = (optimizedBuffer.length / 1024).toFixed(2);

    return {
      buffer: optimizedBuffer,
      filename: newFilename,
      isImage: true,
      sizeKb,
    };
  } catch (error) {
    console.warn('Advertencia: Sharp no pudo optimizar la imagen, guardando original:', error);
    const sizeKb = (inputBuffer.length / 1024).toFixed(2);
    return {
      buffer: inputBuffer,
      filename: originalFilename,
      isImage: false,
      sizeKb,
    };
  }
}

/**
 * Optimiza y guarda un archivo en disco de forma segura.
 */
export async function optimizeAndSaveFile(
  inputBuffer: Buffer,
  originalFilename: string,
  destDir: string,
  options: OptimizeOptions = {}
): Promise<{ filename: string; filePath: string; sizeKb: string }> {
  fs.mkdirSync(destDir, { recursive: true });

  const safeOriginalName = originalFilename.replace(/\.\./g, '').replace(/[\/\\]/g, '');
  const { buffer, filename, sizeKb } = await optimizeImageBuffer(inputBuffer, safeOriginalName, options);

  const filePath = path.join(destDir, filename);
  fs.writeFileSync(filePath, buffer);

  return {
    filename,
    filePath,
    sizeKb,
  };
}
