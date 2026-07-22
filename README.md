# Airtasker Lead Generation Mind Map Website

A standalone HTML, CSS, and JavaScript visual editor for the Airtasker lead-generation playbook.

## Full workspace

The white editing canvas is **5000 × 3600 pixels**. The original mind map is centred inside a
1800 × 1350 content region, leaving substantial white space in every direction.

- Click **Fit** to centre the mind map.
- Drag blank white canvas space to pan.
- Use the mouse wheel to zoom.
- Move components far beyond the original layout.
- Connector lines recalculate automatically.

## Editing

1. Click **Unlock Editing**.
2. Use a component's **Drag** handle to move it.
3. Use the bottom-right corner handle to resize it.
4. Click headings, paragraphs, list items, and labels to edit text.
5. Click **Save** to store the layout in the current browser.
6. Use **Export JSON** for a portable backup.
7. Use **Import JSON** to restore it elsewhere.

## Files

- `index.html`
- `styles.css`
- `app.js`

No build command or external dependency is required.

## Deploy

Upload the files directly to Netlify, Vercel, GitHub Pages, cPanel, or any static web host.

## Storage limitation

Browser saving uses `localStorage`, which is specific to that browser and device. Use JSON
export/import for portability. Shared multi-user storage requires a backend such as Supabase,
Firebase, or a custom API.
