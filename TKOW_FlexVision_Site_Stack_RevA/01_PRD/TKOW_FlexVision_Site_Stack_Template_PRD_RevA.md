# Flex-Vision site stack template

Product Requirements Document | Revision A | November 13, 2026

Owner: Jaylin Myers, Flex-Vision LLC

## 1. Product outcome and scope

Define the Flex-Vision public site as a reusable stack template. A new instance keeps the same layers, routes, local records, and production host pattern. The template is the current Next.js application, not the earlier FlutterFlow chat proposal in `TKOW_Engineering_AI_Chat_RevA`.

The template serves a public homepage, a side-swipe collection lookbook, profile entry, and an admin portal. Engineering chat, the document library, MATLAB, Onshape, credentials, and the piggybank ledger stay attached routes. They are not required for the lookbook and admin slice to be considered present.

In scope: page shell, collection lookbook fed by the MM Collection Rev A workspace, admin garment-registry upload, admin and profile CSV records, forgot-password replacement of the admin password, admin sign-out to the homepage, and a Vercel production deploy.

Out of scope for this template: ERP writes, purchasing, machine actuation, production firmware, and treating local CSV rows as a hosted database. Collection image uploads and the admin password file remain on the machine that runs the admin. They are not part of the production filesystem.

## 2. Current state

Observed in this workspace on November 13, 2026:

- The app is Next.js 16.4.3 with React 19, TypeScript, and the package name `tkow-engineering-ai-chat`.
- Production is the Vercel project `tkow-engineering-ai-chat` on team `flexvision8511 projects`, aliased to `https://www.flexvision.pro`.
- The homepage, `/collection`, `/admin/sign-in`, and `/admin/forgot-password` responded on that production deploy.
- The lookbook route returned the Rev A workspace spreads plus registry rows stored with the deployment.
- `.data` is gitignored. The admin password CSV is local. Production sign-in does not receive that file.
- `POST /v1/collection/image` accepts a garment image only from localhost. A production request is rejected.

This PRD records that state. It does not claim the admin password, garment uploads, or `.data` writes persist on Vercel.

## 3. Users and success

Owner: decides the public copy, the collection roster, and who may use the admin email.

Visitor: reads the homepage and swipes the collection. No account is required for those pages.

Profile holder: enters an email and password. The record is appended to the profile CSV. The admin email is not stored as a profile row.

Administrator: signs in with the admin email and the password in the admin CSV, uses the garment registry, and signs out to the homepage.

A template instance is acceptable when:

- `/` renders the Flex-Vision shell.
- `/collection` swipes the Rev A lookbook spreads in order, and a garment-registry row appears as a later page.
- `/admin` is closed until the admin cookie is present, then shows the registry, page-content editor, error log, and Sign out.
- Sign out clears the admin cookie and lands on `/`.
- Forgot password replaces the password in both admin CSV copies when the email matches the admin entry.
- Production deploy does not publish `.env*` or `.data`.

## 4. Stack layers

| Layer | Template choice | Record |
| --- | --- | --- |
| Application | Next.js App Router, React client pages where the screen is interactive | `app/`, `components/` |
| Style | Shared homepage stylesheet | `app/flexvision-home.css` |
| Public files | Logos, uploaded lookbook images, admin HTML | `public/` |
| Lookbook source | MM Collection Rev A workspace: spreads, assets, garment registry CSV | `Sites/MM_Collection_Lookbook_Site_Workspace_RevA` |
| Local records | Profile rows, admin entry, collection additions | `.data/` |
| Gate | Request check for admin and profile cookies | `proxy.ts` |
| Host | Vercel production, Next.js build | project `tkow-engineering-ai-chat` |

Package scripts are `dev`, `build`, and `start`. The template does not add a second frontend or a hosted database for these records.

## 5. Template surfaces

Homepage (`/`): brand bar, services, partner slot, workflow panel, and the link into AI chat. Newsletter, collection, and AI chat keep their own routes.

Collection (`/collection`): one spread at a time. Previous, Next, horizontal swipe, wheel, and arrow keys move between spreads. A page change may pulse the device haptic API. Spreads come from the Rev A sequence. Extra images on a spread are selectable frames. Registry uploads are appended after the workspace spreads. A hash of the garment id opens that page.

Admin sign-in (`/admin/sign-in`): email and password, then Google or Microsoft when those providers are configured. Otherwise a matching password sets the admin cookie. Forgot password links to `/admin/forgot-password`.

Admin portal (`/admin`, served from `public/edit-page-content.html`): page-content editor stored in this browser, error log for this browser session, and the garment registry. The registry form takes garment name, category, colorway, and one image. Submit creates a row and a lookbook page. Sign out is the control at the end of the top bar.

Profile (`/profile`) and profile forgot-password (`/forgot-password`): profile entry uses its own CSV. Profile recovery does not send mail. Admin recovery is the separate admin form and does write the new password.

## 6. Functional requirements

FR-01 Shell: every public page uses the Flex-Vision bar with Services, Collection, AI Chat, and Profile. Collection marks itself current.

FR-02 Lookbook source: read the Rev A spread list and images from the workspace folder. Do not redraw supplied artwork. Unknown construction, materials, and claims stay Proposed, TBD, or Unknown.

FR-03 Lookbook motion: one spread fills the stage. Side swipe, Previous, Next, and arrow keys change the spread. The visible index matches the scroll position.

FR-04 Registry row: an admin image upload writes a garment id, name, category, colorway, status `Proposed`, and image path. The admin table lists that row. The lookbook appends it and links the row to `/collection#<garment id>`.

FR-05 Registry limits: title at most 120 characters, colorway at most 80, image PNG, JPEG, WebP, or GIF, under 8 MB. Category is one of Emblem, Apparel, Flex-Print, Accessory.

FR-06 Admin record: one admin entry, columns `UUID,EMAIL,Password,created_at_utc`. Keep the same bytes in `.data/admin_entry.csv` and `.data/admin-profile/admin_entry.csv`, with JSON beside the folder copy. Sign-in compares a hash of the submitted password with a hash of the stored password.

FR-07 Profile record: profile rows stay in `.data/profile/profile_entry.csv` and `.data/profile/profile_entry.json`. The admin email cannot be saved as a profile row.

FR-08 Admin gate: `/admin` and `/edit-page-content.html` redirect to `/admin/sign-in` when the admin cookie is missing or invalid. `/ai-chat` and `/newsletter` redirect to `/profile` without the profile cookie.

FR-09 Forgot admin password: the form requires the admin email, a new password of at least 8 characters, and a matching confirmation. A mismatch does not write. A match replaces the password in both CSV copies and the JSON record. It does not sign the browser in.

FR-10 Sign out: `POST /v1/admin/sign-out` clears the admin cookie and redirects to `/` with status 303. Profile access is unchanged.

FR-11 Local writes: garment image bytes and `.data` updates run where the Node process can write the project disk. Production documents that those writes are local. The live site shows workspace spreads and any registry rows that were included in the deploy.

FR-12 Secrets: `.env*` (except `.env.example`) and `.data` are not deployed. The admin password is not written into source files.

## 7. Routes in the template

| Path | Role |
| --- | --- |
| `/` | Homepage |
| `/collection` | Lookbook |
| `/admin/sign-in` | Admin password |
| `/admin/forgot-password` | Replace admin password |
| `/admin` | Registry and page tools |
| `/profile` | Profile entry |
| `/forgot-password` | Profile recovery placeholder |
| `/ai-chat` | Engineering chat |
| `/newsletter` | Newsletter |
| `POST /v1/admin/entry` | Check admin email and password |
| `POST /v1/admin/forgot-password` | Replace admin password |
| `POST /v1/admin/sign-out` | Clear admin cookie and go home |
| `GET /v1/collection/lookbook` | Spreads plus registry rows |
| `GET /v1/collection/asset` | Workspace image by file name |
| `GET, POST /v1/collection/image` | List or save a registry image |
| `POST /v1/profile/entry` | Read or append a profile row |

Chat, library, meetings, MATLAB, Onshape, credentials, and piggybank routes may ship with the template. A new instance may leave their provider keys unset. Those screens then report the missing configuration instead of inventing a result.

## 8. Records

Admin entry, both CSV locations, one data row:

`UUID,EMAIL,Password,created_at_utc`

Profile entry, `.data/profile/profile_entry.csv`:

`UUID,EMAIL,Password,created_at_utc`

Collection addition, used as a lookbook page: title, category, image path under `/lookbook/`, fit `contain`, garment id, colorway, status `Proposed`, source `garment-registry`.

Lookbook workspace garment registry remains the Excel-oriented master for the Rev A roster. Admin uploads are additional rows. They do not rewrite the workspace CSV.

## 9. Deployment

Deploy the working tree to the linked Vercel project with a production target. The production alias is `https://www.flexvision.pro`.

Confirm after deploy: homepage HTML, `/collection` status 200, `/admin/sign-in` status 200, `/admin/forgot-password` status 200, and `GET /v1/collection/lookbook` returning the workspace spreads.

Do not treat a successful deploy as proof that admin sign-in or garment upload works on the host. Those depend on local `.data` and localhost writes.

## 10. Acceptance

1. Open `/collection`. The first spread is the Rev A cover. Next moves one spread. The counter matches the spread.
2. Sign in to `/admin`. The registry table is visible. Sign out returns to `/`. A following request to `/admin` returns to sign-in.
3. From forgot password, a mismatched confirmation does not change the CSV. A matching confirmation changes both admin CSV files and the JSON record. The new password then matches sign-in on that machine.
4. Upload a garment image on localhost. A row appears in the admin table and as the last lookbook page.
5. Production homepage and collection load on `https://www.flexvision.pro`. The admin password file is still only under local `.data`.

## 11. Open limits

The admin password and garment uploads need a hosted store before they can be changed on production. This template does not select that store.

Profile forgot-password still does not send mail.

OAuth appears only when Google or Microsoft client credentials are set. Without them, admin and profile entry finish on the password check.

Lookbook artwork remains concept reference until a registry status says otherwise.
