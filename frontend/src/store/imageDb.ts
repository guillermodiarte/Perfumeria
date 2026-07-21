/**
 * imageDb.ts
 * Stores product images in IndexedDB so they don't bloat localStorage.
 * Keys are stable IDs (e.g. "prod-{productId}-img-{index}").
 */

const DB_NAME = 'lyg-images';
const STORE_NAME = 'images';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveImage(key: string, base64: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(base64, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadImage(key: string): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteImage(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteImagesForProduct(productId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const prefix = `prod-${productId}-`;
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        if ((cursor.key as string).startsWith(prefix)) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Save an array of base64 images for a product, returns the stable key array */
export async function saveProductImages(productId: string, base64Array: string[]): Promise<string[]> {
  const keys: string[] = [];
  for (let i = 0; i < base64Array.length; i++) {
    const key = `prod-${productId}-img-${i}`;
    await saveImage(key, base64Array[i]);
    keys.push(key);
  }
  return keys;
}

/** Load all images for a product given previously stored keys */
export async function loadProductImages(keys: string[]): Promise<string[]> {
  const results = await Promise.all(keys.map(k => loadImage(k)));
  return results.filter(Boolean) as string[];
}
