/**
 * Document store — ITAR-adjacent
 * Metadata: Amplify Data Document (authenticated)
 * Bytes: Amplify Storage documents/* (authenticated)
 */
import { uploadData, getUrl, remove } from 'aws-amplify/storage';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

export type DocKind =
  | 'spec'
  | 'drawing'
  | 'cad'
  | 'test-report'
  | 'photo'
  | 'analysis'
  | 'procedure'
  | 'other';

export type PlmDocument = {
  id: string;
  name: string;
  kind: DocKind;
  description?: string;
  mimeType?: string;
  sizeBytes?: number;
  storageKey?: string;
  fileName?: string;
  revision: string;
  status: string;
  classification?: string;
  linkedEntityIds: string[];
  createdAt: string;
  lastModified: string;
  modifiedBy?: string;
};

const client = () =>
  generateClient<Schema>({ authMode: 'userPool' });

function parseIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function rowToDoc(row: any): PlmDocument {
  return {
    id: row.id,
    name: row.name,
    kind: (row.kind as DocKind) || 'other',
    description: row.description || undefined,
    mimeType: row.mimeType || undefined,
    sizeBytes: row.sizeBytes ?? undefined,
    storageKey: row.storageKey || undefined,
    fileName: row.fileName || undefined,
    revision: row.revision || 'A',
    status: row.status || 'Draft',
    classification: row.classification || undefined,
    linkedEntityIds: parseIds(row.linkedEntityIdsJson),
    createdAt: row.createdAt,
    lastModified: row.lastModified,
    modifiedBy: row.modifiedBy || undefined,
  };
}

/** True when Cognito session is present (required for ITAR-adjacent ops). */
export async function isDocumentAuthReady(): Promise<boolean> {
  try {
    const session = await fetchAuthSession();
    return !!(session.tokens?.accessToken || session.tokens?.idToken);
  } catch {
    return false;
  }
}

export async function listDocumentsForEntity(entityId: string): Promise<PlmDocument[]> {
  const c = client();
  const res = await c.models.Document.list({ limit: 1000 });
  if (res.errors?.length) {
    console.error('[documentStore] list errors', res.errors);
    return [];
  }
  return (res.data || [])
    .map(rowToDoc)
    .filter((d) => d.linkedEntityIds.includes(entityId))
    .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
}

export async function getDocumentDownloadUrl(storageKey: string): Promise<string | null> {
  if (!storageKey) return null;
  try {
    const result = await getUrl({
      path: storageKey,
      options: { expiresIn: 3600 },
    });
    return result.url.toString();
  } catch (err) {
    console.error('[documentStore] getUrl failed', err);
    return null;
  }
}

export async function uploadAndAttachDocument(input: {
  file: File;
  entityId: string;
  kind: DocKind;
  name?: string;
  description?: string;
  classification?: string;
  modifiedBy?: string;
}): Promise<PlmDocument> {
  const ready = await isDocumentAuthReady();
  if (!ready) {
    throw new Error('Sign in required to upload documents (ITAR-adjacent).');
  }

  const id = `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const safeName = input.file.name.replace(/[^\w.\-()+ ]+/g, '_');
  const storageKey = `documents/${id}/${safeName}`;
  const now = new Date().toISOString();
  const by = input.modifiedBy ?? 'Zedekiah';

  await uploadData({
    path: storageKey,
    data: input.file,
    options: {
      contentType: input.file.type || 'application/octet-stream',
    },
  }).result;

  const c = client();
  const payload = {
    id,
    name: (input.name || input.file.name).trim(),
    kind: input.kind,
    description: input.description?.trim() || undefined,
    mimeType: input.file.type || undefined,
    sizeBytes: input.file.size,
    storageKey,
    fileName: input.file.name,
    revision: 'A',
    status: 'Draft',
    classification: input.classification || 'CUI',
    linkedEntityIdsJson: JSON.stringify([input.entityId]),
    createdAt: now,
    lastModified: now,
    modifiedBy: by,
  };

  const res = await c.models.Document.create(payload);
  if (res.errors?.length || !res.data) {
    // Best-effort cleanup of orphaned object
    try {
      await remove({ path: storageKey });
    } catch {
      /* ignore */
    }
    throw new Error(res.errors?.[0]?.message || 'Document create failed');
  }

  return rowToDoc(res.data);
}

export async function unlinkDocumentFromEntity(
  documentId: string,
  entityId: string,
  modifiedBy?: string
): Promise<PlmDocument | null> {
  const ready = await isDocumentAuthReady();
  if (!ready) throw new Error('Sign in required to modify documents.');

  const c = client();
  const existing = await c.models.Document.get({ id: documentId });
  if (!existing.data) return null;

  const doc = rowToDoc(existing.data);
  const linked = doc.linkedEntityIds.filter((id) => id !== entityId);
  const now = new Date().toISOString();

  const res = await c.models.Document.update({
    id: documentId,
    linkedEntityIdsJson: JSON.stringify(linked),
    lastModified: now,
    modifiedBy: modifiedBy ?? 'Zedekiah',
  });

  if (res.errors?.length || !res.data) {
    throw new Error(res.errors?.[0]?.message || 'Unlink failed');
  }
  return rowToDoc(res.data);
}