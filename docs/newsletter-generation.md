# Newsletter generation

The `/newsletter` page is generated from newsletter editions. Each edition is written by ChatGPT, Grok, or Gemini from passages in the engineering library, saved as a draft, and shown on the page only after an admin publishes it.

## How it works

1. An admin opens the admin portal on this computer (`http://127.0.0.1:3000/admin`) and chooses **Newsletter**.
2. The admin enters a topic and picks a model, then selects **Generate draft**.
3. The site searches the engineering library for that topic. This is the same search the AI Chat uses (`searchLibrary` in `lib/server/evidence-library.ts`). It reads `Engineering Docs - Copy` and the `Sites` packages, and skips credential and secret files.
4. The top matching passages (up to six) are sent to the model with instructions to use only those passages, keep values, units, revisions and status words as written, and return the edition as JSON with the ids of the passages it used.
5. The site keeps only citations that point to passages it actually sent. A reply with no valid citation is rejected and nothing is saved.
6. The draft is saved to `data/newsletter-editions.json` with status `Draft`.
7. The admin reads the draft and its sources, then selects **Publish to newsletter**. The first publish sets the edition date to that day.
8. `/newsletter` shows every published edition, newest first. **Move back to draft** removes an edition from the page and keeps its original date for when it is published again. **Delete** removes it from the file.

## What each edition field drives on the page

| Field | Where it appears |
| --- | --- |
| `title` | Lead story heading, issue list, log |
| `lead` | Lead story paragraph (newest edition only) |
| `summary` | Issue list line, after the category and date |
| `description` | Newsletter log row |
| `category` | Issue list and log. One of Research brief, Design reference, Engineering note, Product update |
| `date` | Header line, issue list, log |
| `quote` | Pull quote (from the newest edition that has one) |
| `citations` | Sources line under the log (newest edition) |
| `image` | Thumbnail on the right of that edition's issue-list row. The page header is the marketing image, `public/marketing/newsletter-header.png`. `alt` is read aloud by screen readers |
| `topic`, `model`, `created_at_utc`, `published_at_utc` | Admin portal only |

The page layout is `components/newsletter-page.tsx`. Styling is in `app/flexvision-home.css` under `.newsletter-doc`.

## Setup

Add the key for each model you want to use to `.env.local`, then restart the site.

| Model | Key | Notes |
| --- | --- | --- |
| ChatGPT | `OPENAI_API_KEY` | Model name from `OPENAI_MODEL`, default `gpt-6.1-sol` |
| Grok | `XAI_API_KEY` | Uses `grok-4.7`. The xAI team needs credits |
| Gemini | `GEMINI_API_KEY` | Model name from `GEMINI_MODEL`, default `gemini-3.8-flash`. Google's free tier works without credits but can return "high demand" (503) at busy times; try again later |

`.env.local` is ignored by git and is not deployed. Never paste keys into chat or commit them. If a key is exposed, revoke it at the provider and create a new one.

When a key is missing, the model list in the admin portal shows "(no key)". When the provider rejects a request, the admin portal shows the provider's message with any key text hidden.

## Comic images

**Folder path.** The admin portal pulls images from:

`C:\Users\myers\OneDrive\Desktop\Flex-Vision\Website Development\Newsletter\Comic images`

That is the `Newsletter\Comic images` folder next to the `AI ChatBot` folder. To use a different folder, set `NEWSLETTER_IMAGE_DIR` in `.env.local` to its full path and restart the site. JPG, PNG, WebP and GIF files up to 8 MB are listed, newest first.

**Pull.** Save the image into the folder, then press **Refresh folder** in the admin Newsletter module. The folder path is shown next to the button.

**Placement.** Choose the image in either place:

- **When generating.** Pick a **Comic image** and type an **Image description** before **Generate draft**. The draft is saved with the image attached.
- **On an existing edition.** Each edition card has its own **Comic image** picker, description, and **Place image** (or **Update image**) and **Remove image** buttons. The preview shows the image currently placed, or the one you picked.

Placing an image copies it to `public/newsletter/images/<edition id>-<file name>`, so it ships with the next deploy. The original stays in the folder. Replacing, removing, or deleting an edition removes the old copy. A blank description saves as "Comic illustration for <edition title>".

The newsletter header is `public/marketing/newsletter-header.png`. A comic image still shows as a thumbnail beside that edition in "In this issue" once the edition is published.

## Publishing to flexvision.pro

Generating only works on this computer. The engineering library and the admin session live here, and the generate endpoint answers only on `localhost` or `127.0.0.1`.

To put published editions on the live site:

1. Generate and publish editions locally.
2. Deploy (`vercel deploy --prod --yes`). The deployment includes `data/newsletter-editions.json`, so the live `/newsletter` shows the editions that were published at deploy time.

## Who can see `/newsletter`

Visitors need a profile session (sign in at `/profile`). A signed-in admin session can also open the page so the admin can preview editions after publishing.

## Files

| File | Purpose |
| --- | --- |
| `lib/server/newsletter.ts` | Read, generate, publish and delete editions |
| `app/v1/newsletter/editions/route.ts` | Admin API: `GET` list, `POST` generate, `PATCH` status or image, `DELETE` |
| `app/v1/newsletter/images/route.ts` | Admin API: list the comic image folder, or return one folder image for the preview |
| `lib/server/newsletter-images.ts` | Folder path, image listing, and copying placed images into `public/newsletter/images/` |
| `lib/server/newsletter-admin.ts` | Local-only check for generation, and the admin-session check for delivery |
| `lib/server/newsletter-mail.ts` | Profile-address counts, email preview, Resend send, unsubscribe hashes, and the monthly pull |
| `public/newsletter/images/` | Placed copies of comic images, deployed with the site |
| `data/newsletter-editions.json` | Edition store, deployed with the site |
| `components/newsletter-page.tsx` | Newsletter page template |
| `public/edit-page-content.html` | Admin portal, including the Newsletter module |
| `lib/server/direct-model.ts` | Direct OpenAI, xAI, and Google Gemini calls |

## API

All requests need the admin session cookie and must be sent to `localhost` or `127.0.0.1`. Other hosts get `404`, and requests without the admin session get `401`.

- `GET /v1/newsletter/editions` returns `{ editions, models }`. `models` shows which keys are set.
- `POST /v1/newsletter/editions` with `{ "topic": "...", "model": "chatgpt" | "grok" | "gemini", "image"?: "<file in folder>", "alt"?: "..." }` returns the new draft (`201`).
- `PATCH /v1/newsletter/editions` with `{ "id": "...", "status": "Draft" | "Published" }`.
- `PATCH /v1/newsletter/editions` with `{ "id": "...", "image": "<file in folder>" | null, "alt"?: "..." }` places, replaces, or removes the image.
- `GET /v1/newsletter/images` returns `{ folder, images: [{ file, size, modified_utc }] }`. Add `?file=<name>` to get the image itself.
- `DELETE /v1/newsletter/editions` with `{ "id": "..." }`.

Errors return `{ "error": { "message": "..." } }` with status `400`.

## Existing editions

The two editions that were typed into the page before this change (the field yield brief of November 10, 2026 and the wildflower palette of October 1, 2026) were moved into the data file as published, hand-written editions, so the page looks the same. They have no library citations recorded. Move either back to draft in the admin portal if it should not be public.

## Email to profile addresses

Published editions can be emailed from the admin Newsletter module. The audience is the profile entries already stored for sign-in. The page shows counts only: rows, eligible, unsubscribed, invalid, and duplicates. It does not list addresses.

The newsletter page is `https://www.flexvision.pro/newsletter`. Its layout is a banner, the issue title and teaser, up to three story highlights, a **View More Newsletter** link to the log, and a footer. Social links are not configured. The AI chatbot line stays “planned” until a destination is approved. A mailing address is not recorded on the site.

Email uses Resend, the same sender as password reset. The subject starts as `New newsletter is live: [issue title]` and can be edited before a send. Each message has a preferences link and an unsubscribe link. The unsubscribe token does not put the address in clear text. A stopped address is stored as a hash and stays out of later sends. Push is skipped because no push provider or opted-in devices are configured.

Publishing an edition does not send it. **Send to profile emails** asks for confirmation and submits one batch per edition. A second profile send is refused after Resend has accepted any message for that edition. **Send test to admin inbox** is separate and can be repeated. The status **Submitted** means Resend accepted the request. This screen does not receive delivery receipts.

The monthly pull is paused until an admin resumes it. The intended time is 1:00 PM `America/New_York` on the first day of the month. The host check is `0 18 * * *` UTC, which is 1:00 PM Eastern Standard Time and 2:00 PM Eastern Daylight Time. It emails the latest published edition that has not been submitted. The check runs only when `CRON_SECRET` is set on the host and the request carries that secret. Resume the pull only after that secret is set and this schedule is deployed.

## Not included yet

- **Generating on the live site.** The engineering library is not deployed.
- **Push notification delivery.** No push provider is configured.
- **Social links, mailing address, and an AI chatbot URL.** Those stay unset until real destinations are supplied.
