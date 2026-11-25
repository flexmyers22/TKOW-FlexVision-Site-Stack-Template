import { listDocumentElements, listOnshapeDocuments, onshapeBinary } from './onshapeClient.js';

async function tryStl(did: string, wid: string, eid: string) {
  try {
    const path =
      `/api/partstudios/d/${did}/w/${wid}/e/${eid}/stl` +
      `?mode=binary&grouping=true&scale=1&units=meter`;
    const { buffer } = await onshapeBinary('GET', path);
    return { ok: true as const, bytes: buffer.length };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const docs = await listOnshapeDocuments(20);
  for (const doc of docs.items ?? []) {
    const did = String(doc.id);
    const name = String(doc.name);
    const ws = doc.defaultWorkspace as { id?: string } | undefined;
    const wid = ws?.id;
    if (!wid) continue;
    const elements = await listDocumentElements(did, wid);
    for (const el of elements) {
      const type = String(el.elementType ?? el.type ?? '');
      if (type !== 'PARTSTUDIO') continue;
      const eid = String(el.id);
      const result = await tryStl(did, wid, eid);
      console.log(
        JSON.stringify({
          document: name,
          did,
          wid,
          element: el.name,
          eid,
          ...result,
        })
      );
      if (result.ok) return;
    }
  }
  console.error('No Part Studio with exportable geometry found');
  process.exitCode = 1;
}

void main();
