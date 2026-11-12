# VSC · The Historical Jesus: Sources & Evidence

A static website listing ancient texts, archaeological finds, manuscripts and recent news that relate to the historical Jesus.

## Files
| File | What it is |
|---|---|
| `data/entries.json` | All evidence entries (edit this to add or change content) |
| `data/news.json` | The "In the News" articles |
| `images/` | Artifact photos and the VSC logo (`vsc-logo.svg`) |
| `index.html` | Page layout, intro text and further reading list |
| `assets/app.js` | Search, filters, and rendering |
| `styles.css` | Styling (light and dark mode) |
| `_headers` | Security headers for Cloudflare Pages / Netlify |
| `.pages.yml` | Configuration for the Pages CMS web editor |

## Preview locally
The page loads its content from JSON files, so double-clicking `index.html` won't work. Run a local server instead:

    cd ~/jesus-history-site
    python3 -m http.server 8000

Then open http://localhost:8000

## Editing content
**Option 1: web editor (no coding).** Put the site on GitHub, then sign in at https://app.pagescms.org with your GitHub account and open the repository. You'll get forms for "Evidence entries" and "News articles", including image upload. When you save, the change is committed to GitHub and your host republishes the site automatically.

**Option 2: edit the files directly.** Open `data/entries.json` or `data/news.json` in any text editor, copy an existing `{ ... }` block, and change the text. Each entry has these fields:
- `section`: one of `Non-Christian Writers`, `Archaeology`, `Manuscripts`, `Earliest Christian Texts`
- `badge`: one of `Widely accepted`, `Debated`, `Context`
- `image`: a path like `/images/my-photo.jpg`, or `""` for no image

## Security
- There is no server code, database, login, or forms on the live site.
- A strict Content Security Policy allows only this site's own scripts, styles, and images. There are no third-party scripts, trackers, fonts, or CDNs.
- All content is inserted as plain text, so even a bad edit to the JSON can't inject code. Links are restricted to http(s).
- The editor (Pages CMS) runs on its own site and uses your GitHub login, so the live site has no admin page to attack. Turn on two-factor authentication on GitHub.

## Image credits
Photos come from Wikimedia Commons. Each card shows its author and license and links to the source page. Some are CC BY-SA, so keep the credits when you reuse them.

## Publishing (free, HTTPS included)
1. Create a GitHub repository and upload this folder.
2. In **Cloudflare Pages** (or Netlify), choose "Connect to Git" and select the repository. There is no build command, and the output directory is `/`.
3. Every edit you save, whether through Pages CMS or on GitHub, republishes the site automatically.
