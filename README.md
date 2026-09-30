# Pulse Sports Blog

A modern, responsive sports blog built as a static website so it is easy to host on Afrihost.

## How to update content

Open the site and click **Admin** (top right) to sign in. The admin studio opens with separate News, Transfers, Fixtures, Results, Site and Publish tabs. From there you can:

- add new news, transfer, fixture, and result items
- edit or delete existing items without touching the JSON by hand
- attach match images from your computer
- keep a draft saved in the browser while you work
- download the updated JSON when you are ready to publish

If you prefer editing the data file directly, open [data/blog-data.json](data/blog-data.json) and edit the arrays for:

- `news` for sports news stories
- `transfers` for transfer updates
- `fixtures` for upcoming matches
- `results` for completed matches

Each item can also include an optional `image` field. The built-in editor can attach an image from your browser and store it inside the JSON export.

### Example structure

```json
{
  "title": "New story title",
  "category": "Match Report",
  "date": "Today",
  "summary": "Short description for the card"
}
```

## Uploading to Afrihost

1. Upload all files in this folder to your public_html directory.
2. Make sure the `data` folder is uploaded too.
3. Upload `.htaccess` so HTML and JSON are always revalidated.
4. Bump the query version in `index.html` when you deploy JS changes:

```html
<script src="script.js?v=9"></script>
```

5. Visit your domain to see the site.

### Image uploads on a static site

This site does not upload images directly to Afrihost from the browser.
Instead, the editor converts the selected image into data stored inside the JSON file.
That means you must export the updated JSON and upload it with your site content.

The editor also keeps a draft in your browser so you do not lose work while switching between entries.

### Why visitors can see old content

Browsers can cache old files, and local editor drafts in one browser can override server data.
This project now uses server-first loading for visitors and only uses local drafts for authenticated admins.

## Local preview

Run a simple local server from this folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
