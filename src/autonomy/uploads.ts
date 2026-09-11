import { createHash, randomUUID } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const MAX_UPLOAD_BYTES = Number(process.env.MICROFIXD_MAX_UPLOAD_BYTES || 20 * 1024 * 1024); // 20MB default

export type StoredUpload = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storedPath: string;
  createdAt: string;
};

/**
 * UploadStore: accepts photos, zips, OBD2 diagnostic exports, or any other
 * file dropped into the chat box, and writes them to a directory-confined
 * location on disk -- same containment pattern as SandboxWorkspace, kept
 * separate because uploads are arbitrary binary data, not code candidates.
 *
 * Persistence caveat, stated plainly: this is a local disk directory. On a
 * platform without a persistent volume (the default on most PaaS free
 * tiers), uploaded files do not survive a redeploy or restart. The
 * UsageEvent logged for each upload DOES survive (it's in the durable
 * store), so the record that an upload happened outlives the file itself
 * unless a persistent volume or object storage is configured.
 */
export class UploadStore {
  private readonly root: string;

  constructor(rootDirectory = process.env.MICROFIXD_UPLOADS_DIR || './.microfixd/uploads') {
    this.root = resolve(rootDirectory);
  }

  private assertContained(target: string): void {
    if (!target.startsWith(this.root + sep) && target !== this.root) {
      throw new Error('Upload target escaped the confined uploads directory.');
    }
  }

  async save(filename: string, mimeType: string, base64Content: string): Promise<StoredUpload> {
    await mkdir(this.root, { recursive: true });

    const buffer = Buffer.from(base64Content, 'base64');
    if (buffer.length === 0) throw new Error('Upload content decoded to zero bytes.');
    if (buffer.length > MAX_UPLOAD_BYTES) throw new Error(`Upload exceeds the ${MAX_UPLOAD_BYTES}-byte limit (MICROFIXD_MAX_UPLOAD_BYTES).`);

    const safeName = (filename || 'upload')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '_')
      .replace(/^[._-]+/, '')
      .slice(0, 120) || 'upload';
    const id = randomUUID();
    const targetName = `${id}-${safeName}`;
    const target = resolve(this.root, targetName);
    this.assertContained(target);

    await writeFile(target, buffer, { mode: 0o600 });
    const info = await stat(target);

    return {
      id,
      filename: safeName,
      mimeType: (mimeType || 'application/octet-stream').slice(0, 200),
      sizeBytes: info.size,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      storedPath: targetName,
      createdAt: new Date().toISOString(),
    };
  }
}
