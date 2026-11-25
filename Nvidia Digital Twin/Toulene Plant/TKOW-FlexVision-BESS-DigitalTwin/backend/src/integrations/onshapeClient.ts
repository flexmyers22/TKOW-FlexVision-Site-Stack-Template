import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
loadEnv({ path: join(ROOT, '.env') });

const TARGET_FILE = join(ROOT, 'digital_twin', 'cad', 'onshape-target.json');

export type OnshapeConfig = {
  baseUrl: string;
  accessKey: string;
  secretKey: string;
};

export type CadTarget = {
  documentId: string;
  workspaceId: string;
  elementId: string;
  label?: string;
};

export type TranslationStatus = {
  id: string;
  requestState: string;
  failureReason?: string | null;
  resultExternalDataIds?: string[] | null;
  resultElementIds?: string[] | null;
  href?: string;
};

export function getOnshapeConfig(): OnshapeConfig {
  const accessKey = process.env.ONSHAPE_ACCESS_KEY?.trim() ?? '';
  const secretKey = process.env.ONSHAPE_SECRET_KEY?.trim() ?? '';
  const baseUrl = (process.env.ONSHAPE_BASE_URL ?? 'https://cad.onshape.com').replace(/\/$/, '');

  if (!accessKey || !secretKey) {
    throw new Error(
      'Onshape credentials missing. Set ONSHAPE_ACCESS_KEY and ONSHAPE_SECRET_KEY in .env'
    );
  }

  return { baseUrl, accessKey, secretKey };
}

/** Resolve CAD target from env, falling back to digital_twin/cad/onshape-target.json. */
export function getCadTargetFromEnv(): CadTarget {
  let fileTarget: Partial<CadTarget> & { label?: string } = {};
  try {
    fileTarget = JSON.parse(readFileSync(TARGET_FILE, 'utf8')) as typeof fileTarget;
  } catch {
    // optional file
  }

  const documentId =
    process.env.ONSHAPE_DOCUMENT_ID?.trim() || fileTarget.documentId || '';
  const workspaceId =
    process.env.ONSHAPE_WORKSPACE_ID?.trim() || fileTarget.workspaceId || '';
  const elementId = process.env.ONSHAPE_ELEMENT_ID?.trim() || fileTarget.elementId || '';
  const label = process.env.ONSHAPE_CAD_LABEL?.trim() || fileTarget.label || undefined;

  if (!documentId || !workspaceId || !elementId) {
    throw new Error(
      'Set ONSHAPE_DOCUMENT_ID / WORKSPACE_ID / ELEMENT_ID in .env or digital_twin/cad/onshape-target.json'
    );
  }
  return { documentId, workspaceId, elementId, label };
}

function createNonce(length = 25): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/** HMAC Authorization header per Onshape API key docs. */
export function createOnshapeAuthorization(
  method: string,
  fullUrl: string,
  contentType: string,
  accessKey: string,
  secretKey: string,
  nonce = createNonce(),
  authDate = new Date().toUTCString()
): { authorization: string; nonce: string; authDate: string } {
  const url = new URL(fullUrl);
  const urlPath = url.pathname;
  const urlQuery = url.search.startsWith('?') ? url.search.slice(1) : url.search;

  const payload = (
    `${method}\n${nonce}\n${authDate}\n${contentType}\n${urlPath}\n${urlQuery}\n`
  ).toLowerCase();

  const hmac = createHmac('sha256', secretKey).update(payload).digest('base64');
  const authorization = `On ${accessKey}:HmacSHA256:${hmac}`;

  return { authorization, nonce, authDate };
}

type FetchOptions = {
  body?: unknown;
  contentType?: string;
  accept?: string;
  responseType?: 'json' | 'binary';
};

async function signedFetch(
  method: string,
  fullUrl: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { accessKey, secretKey } = getOnshapeConfig();
  const contentType = options.body ? (options.contentType ?? 'application/json') : '';
  const { authorization, nonce, authDate } = createOnshapeAuthorization(
    method,
    fullUrl,
    contentType,
    accessKey,
    secretKey
  );

  const headers: Record<string, string> = {
    Accept: options.accept ?? (options.responseType === 'binary' ? '*/*' : 'application/json'),
    Authorization: authorization,
    Date: authDate,
    'On-Nonce': nonce,
  };
  if (contentType) headers['Content-Type'] = contentType;

  let response = await fetch(fullUrl, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: 'manual',
  });

  // Onshape export/download often 307s to a signed blob URL — re-sign redirect.
  let hops = 0;
  while ((response.status === 307 || response.status === 302) && hops < 5) {
    hops += 1;
    const location = response.headers.get('location');
    if (!location) throw new Error(`Onshape ${response.status} without Location header`);
    const redirectAuth = createOnshapeAuthorization(
      method,
      location,
      contentType,
      accessKey,
      secretKey
    );
    response = await fetch(location, {
      method,
      headers: {
        Accept: headers.Accept,
        Authorization: redirectAuth.authorization,
        Date: redirectAuth.authDate,
        'On-Nonce': redirectAuth.nonce,
        ...(contentType ? { 'Content-Type': contentType } : {}),
      },
      redirect: 'manual',
    });
  }

  return response;
}

export async function onshapeRequest<T = unknown>(
  method: string,
  pathAndQuery: string,
  options: FetchOptions = {}
): Promise<T> {
  const { baseUrl } = getOnshapeConfig();
  const fullUrl = `${baseUrl}${pathAndQuery.startsWith('/') ? '' : '/'}${pathAndQuery}`;
  const response = await signedFetch(method, fullUrl, { ...options, responseType: 'json' });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Onshape ${response.status}: ${text.slice(0, 400)}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function onshapeBinary(
  method: string,
  pathAndQuery: string,
  options: FetchOptions = {}
): Promise<{ buffer: Buffer; contentType: string | null }> {
  const { baseUrl } = getOnshapeConfig();
  const fullUrl = `${baseUrl}${pathAndQuery.startsWith('/') ? '' : '/'}${pathAndQuery}`;
  const response = await signedFetch(method, fullUrl, {
    ...options,
    responseType: 'binary',
    accept: options.accept ?? '*/*',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Onshape binary ${response.status}: ${text.slice(0, 400)}`);
  }

  const ab = await response.arrayBuffer();
  return {
    buffer: Buffer.from(ab),
    contentType: response.headers.get('content-type'),
  };
}

export async function listOnshapeDocuments(limit = 20) {
  return onshapeRequest<{ items?: Array<Record<string, unknown>> }>(
    'GET',
    `/api/documents?limit=${limit}`
  );
}

export async function listDocumentElements(documentId: string, workspaceId: string) {
  return onshapeRequest<Array<Record<string, unknown>>>(
    'GET',
    `/api/documents/d/${documentId}/w/${workspaceId}/elements`
  );
}

export async function pingOnshape() {
  const docs = await listOnshapeDocuments(5);
  return {
    ok: true,
    baseUrl: getOnshapeConfig().baseUrl,
    documentCount: Array.isArray(docs.items) ? docs.items.length : undefined,
    sample: docs,
  };
}

/** Synchronous Part Studio STL export. */
export async function exportPartStudioStl(target: CadTarget): Promise<Buffer> {
  const { documentId, workspaceId, elementId } = target;
  const path =
    `/api/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/stl` +
    `?mode=binary&grouping=true&scale=1&units=meter`;
  const { buffer } = await onshapeBinary('GET', path);
  return buffer;
}

/**
 * Asynchronous Part Studio GLTF export (storeInDocument=false),
 * then download via external data id.
 */
export async function exportPartStudioGltf(
  target: CadTarget,
  options: { pollMs?: number; timeoutMs?: number } = {}
): Promise<Buffer> {
  const { documentId, workspaceId, elementId } = target;
  const pollMs = options.pollMs ?? 1500;
  const timeoutMs = options.timeoutMs ?? 120_000;

  // Prefer sync GLTF when available (faster, fewer parameter edge cases).
  try {
    const syncPath = `/api/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/gltf`;
    const { buffer } = await onshapeBinary('GET', syncPath, {
      accept: 'model/gltf+json, model/gltf-binary, */*',
    });
    if (buffer.length > 0) return buffer;
  } catch {
    // fall through to async translation
  }

  const started = await onshapeRequest<TranslationStatus>(
    'POST',
    `/api/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/translations`,
    {
      body: {
        formatName: 'GLTF',
        storeInDocument: false,
        resolveForeignData: true,
        includeExportIds: false,
        destinationName: 'export',
        yAxisIsUp: true,
        useGltfCompression: false,
        meshParams: {
          resolution: 'medium',
          angularTolerance: 0.1,
          distanceTolerance: 0.001,
          maximumChordLength: 10,
          unit: 'meter',
        },
      },
    }
  );

  const translationId = started.id;
  if (!translationId) {
    throw new Error(`Onshape translation did not return an id: ${JSON.stringify(started)}`);
  }

  const deadline = Date.now() + timeoutMs;
  let status: TranslationStatus = started;
  while (Date.now() < deadline) {
    status = await onshapeRequest<TranslationStatus>('GET', `/api/translations/${translationId}`);
    const state = (status.requestState ?? '').toUpperCase();
    if (state === 'DONE') break;
    if (state === 'FAILED') {
      throw new Error(`Onshape GLTF translation failed: ${status.failureReason ?? 'unknown'}`);
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  if ((status.requestState ?? '').toUpperCase() !== 'DONE') {
    throw new Error(`Onshape GLTF translation timed out after ${timeoutMs}ms`);
  }

  const fid = status.resultExternalDataIds?.[0];
  if (!fid) {
    throw new Error(
      `Onshape GLTF done but no resultExternalDataIds: ${JSON.stringify(status)}`
    );
  }

  const { buffer } = await onshapeBinary(
    'GET',
    `/api/documents/d/${documentId}/externaldata/${fid}`
  );
  return buffer;
}
