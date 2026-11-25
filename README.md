# TKOW Engineering AI Chat

Next.js frontend for the TKOW Engineering AI Chat pilot. The UI follows the supplied PRD and proposed `/v1` API contract. It does not include or simulate an engineering backend.

## Run locally

1. Install Node.js and pnpm.
2. Copy `.env.example` to `.env.local`.
3. Set `AI_GATEWAY_API_KEY` to a Vercel AI Gateway key. Leave `NEXT_PUBLIC_API_BASE_URL` blank to use the chat route in this app, or set it to another authenticated API origin.
4. Run `pnpm install`, then `pnpm dev` and open the local URL printed by Next.js.

`POST /v1/chat` answers through the AI Gateway when `AI_GATEWAY_API_KEY` is set. If that key is absent and `TKOW_BRIDGE_URL` plus `TKOW_BRIDGE_TOKEN` are set, chat uses the local bridge in `n8n/tkow-multi-llm`. Open Connect Onshape to authorize the FeatureScript MCP on the gateway path. `GET /v1/meetings` waits for `FIREFLIES_API_KEY` and does not replace the chat model. The microphone button sends the recording to Fireflies with `POST /v1/meetings/audio`; the brief still arrives by email and the site does not keep the audio. `GET /v1/library` lists the initial engineering-document library, and chat cites matching passages from that library. The model selected in chat is the only model called for that request. Zip files in that folder download from `GET /v1/library/download`. MATLAB picture area and live tracking call `MATLAB_URL` after `tkowVisionServer` is running. Uploads, BOM, code, and CAD jobs still require those `/v1` routes.

The backend must enforce authentication, tenant/project membership, source authorization, and upload validation. The frontend sends the project ID as a request parameter, not as proof of access. `NEXT_PUBLIC_*` values are public and must never contain API keys, storage credentials, Pinecone credentials, or model secrets.

## Implemented API flows

- Chat: `POST /v1/chat`; renders only server-returned answers, citations, assumptions, unresolved inputs, and trace IDs.
- Upload: SHA-256 → `POST /v1/uploads/initiate` → PUT to the returned private upload URL with required headers → `POST /v1/documents/{id}/complete` → bounded status polling with `GET /v1/documents/{id}`.
- BOM, code, and CAD: `POST /v1/generations` → `GET /v1/jobs/{id}` polling. The UI wires job cancellation, retry, and expiring artifact download routes.
- Error states surface API messages/codes/trace IDs where provided. Missing project/API configuration is reported instead of falling back to canned responses.

The current contract does not define source-list, job-list, or analytics routes. The Library and job views therefore show only records created during the current page session, and Analytics explains the missing endpoint rather than inventing data. The PRD describes these backend requirements and integration constraints in `TKOW_Engineering_AI_Chat_RevA/01_PRD/TKOW_Engineering_AI_Chat_PRD_RevA.md`.
