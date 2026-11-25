# Flex‑Print Lettering Studio

Standalone TKOW/Flex‑Vision workspace for Flex‑Print letters, numbers, word compositions, sticker sheets, garment placements, and output validation.

## Open the workspace

Unzip the package and open `index.html` in a current desktop or mobile browser. No installation or external account is required.

## Sticker image input

1. Open **Sticker sheets** and choose an image file (PNG, JPG, WEBP, or SVG, up to 1 MB).
2. Set artwork width in millimeters and optional rotation.
3. Select **Add image to sheet**, then drag the image to position it on the canvas.
4. Save the layout to keep its artwork and position in this browser.
5. Export the sheet as SVG or PNG. Embedded artwork is included in the SVG.

Drafts are stored in this browser's local storage. Records and image artwork are not uploaded to a server. Use the CSV registry exports for Excel-compatible data backups. Exported SVG dimensions are expressed in millimeters; check the imported size, cut paths, offsets, and material behavior in the target print-and-cut software before production.

## Workspace capabilities

- Editable glyph and word records with provisional or verified status.
- Sticker sheet layout controls and image placement.
- Garment placement guides, evidence fields, and validation checklists.
- SVG/PNG downloads and CSV registry exports.
- Unknown values retained where measurements or integration details have not been provided.

Cricut, Onshape, Arena, n8n, Supabase, Snowflake, Pinecone, and ChatGPT Library connections are not configured.

## Garment layout sizing

Open **Placement guides → Garment layout sizing** to record a pattern piece by size code (XS through 3X or Custom), flat panel width and length, chest/waist circumference, hem width, and sleeve/inseam length. The preview reflects the panel width-to-length ratio when both panel dimensions are entered. Values remain Unknown until supplied; the application does not assign standard garment measurements. Export the garment size registry as CSV for Excel.

## Cricut placement workflow

The sticker-sheet page includes four clickable stages: add artwork, place and size items, choose an output type, and check the result in Cricut Design Space. Select any item on the sheet to edit its X/Y position, width, height, and rotation in millimeters; drag items to reposition them, optionally snapping to a 5 mm grid. Duplicate, layer, and delete controls are included.

Choose PNG for full-color Print Then Cut artwork or SVG for vector cut lines. Raster art inside the sheet should use the PNG handoff. Cricut is not connected to this standalone workspace: upload the exported file to Design Space and confirm imported size, cut preview, and material settings there. Cricut's current instructions are linked in the app:

- https://help.cricut.com/hc/en-us/articles/360009556313-How-to-upload-images-into-Design-Space
- https://help.cricut.com/hc/en-us/articles/360009387274-How-to-Print-Then-Cut-in-Design-Space

## Apparel Graphics Studio

Open **Graphics studio** to preview Flex-Print artwork on an illustrative T-shirt, jersey front/back, or shorts view. Click Chest mark, Sleeves, Body pattern, or Hem band to select a placement zone. Choose a fade, all-over repeat, sleeve treatment, or wordmark-only preview; adjust pattern coverage and repeat scale, fade start, wordmark, color, and mm placement offsets. Enter measured panel width and height before exporting the scale-aware SVG. Save layouts and export the graphics registry as CSV for Excel.

The garment mockup is a communication aid, not a production pattern. Panel measurements and status stay provisional until entered and verified. A preview PNG is for review; use the dimensioned SVG panel export for artwork handoff and validate the result in the target print/cut application. No external design or manufacturing integrations are configured.
