# TKOW Excel-backed multi-LLM workflow (n8n)

## Files
- `TKOW_n8n_Multi_LLM_Workflow.json`: import into n8n.
- `TKOW_Multi_LLM_Registry_API_Key_Vault.xlsx`: registry template copied from the existing workbook.
- `bridge.py`: Python 3.10+ bridge reads Excel on each request and calls supported provider APIs.

## Setup
1. Keep the workbook and bridge on the same trusted backend machine. **Do not enter raw keys in the Excel `API Key Vault` plaintext column**; store keys in backend environment variables named in `Providers` / `API Key Vault`.
2. In `Model Catalog`, enter real, verified `Actual API Model ID` and matching `Provider ID`; change `API ID Status` to `Verified` and `Enabled` to `Yes`. Screenshot labels are not guaranteed API identifiers.
3. Set a strong `TKOW_BRIDGE_TOKEN` and provider keys (`OPENAI_API_KEY`, `OPENROUTER_API_KEY`, etc.) in your server secret store. Start `python bridge.py`. It listens on localhost port 8787.
4. Import JSON into n8n. If n8n runs in Docker, `host.docker.internal` may require `extra_hosts: ["host.docker.internal:host-gateway"]` on Linux; adjust the two HTTP Request URLs for your deployment. Set `TKOW_BRIDGE_TOKEN` in n8n's server environment or use n8n credentials and change Authorization header expressions. n8n may restrict `$env` access; use credential-backed headers if so.
5. Activate workflow and call GET `/webhook/tkow/models` for model search or POST `/webhook/tkow/chat` with JSON `{ "model":"internal_slug", "messages":[{"role":"user","content":"Hello"}] }`. Protect n8n webhooks with authentication/reverse proxy before exposing publicly.

## Important limitations
- OpenAI-compatible `/chat/completions` is wired for `openai`, `openrouter`, `xai`, and `github_models`. Anthropic uses `/v1/messages`. Google Gemini uses `generateContent`. Fireflies is not a chat model. Cursor-only labels stay disabled until a live model ID is verified.
- No models are enabled by default; no live account access or credentials are supplied.
- Workbook is **not** an encrypted vault. The bridge deliberately ignores the plaintext `API Key (optional; plaintext)` column. Never share a filled-in workbook containing secrets.
- The bridge reads the Excel file on every call. Add production auth, rate limits, logging/redaction, timeout/retry policy, and deployment hardening before external use.
- No document/image upload or CAD processing is included in this initial routing workflow.
