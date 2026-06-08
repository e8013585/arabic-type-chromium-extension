# Arabic Type

Professional Arabic typography correction for every website. Fixes letter-spacing, injects beautiful Arabic fonts, and corrects rendering issues that cause disjointed Arabic text.

## Permissions Justification

### `storage`

Used to persist user preferences locally on your device: chosen font, line-height, font-size scale, force RTL toggle, fix diacritics toggle, per-site overrides, and disabled-sites list. All data stays in `chrome.storage.local` — never transmitted anywhere.

### `activeTab`

Used when the popup requests status from the currently active tab (e.g., "was Arabic text detected on this page?"). This is a popup-only, on-demand query — the extension does not read tab contents in the background.

### `scripting`

Used to send messages to content scripts and, in future, to programmatically inject scripts when needed. All execution is confined to the extension's own content script lifecycle.

### `tabs`

Used to:
- Query open tabs when broadcasting setting changes (so your font/line-height choice applies instantly to all open pages).
- Listen for tab navigation events so content scripts re-initialise on page changes (especially important for single-page apps).

No tab data is collected, logged, or transmitted.

## Host Permissions

### `<all_urls>`

Required so Arabic Type can detect and fix Arabic text on any website you visit. The extension only reads text content to apply typographic corrections — it does not collect, store, or send any page data.

### `https://fonts.googleapis.com/*` and `https://fonts.gstatic.com/*`

Required to load the selected Google Fonts on your behalf. When you choose a font in the popup, the extension injects a `<link>` element pointing to Google Fonts' servers to fetch the font files and stylesheet. These requests are subject to Google's privacy policy at fonts.google.com/privacy.

## Data Collection

Arabic Type collects **zero** data. No analytics, no telemetry, no user tracking. All settings are stored locally on your device using `chrome.storage.local` and are never transmitted.
