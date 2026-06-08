/**
 * content-early.js
 * Arabic Type Extension — Phase 1: Document-Start Injection
 *
 * ─────────────────────────────────────────────────────────────
 * TWO-PHASE APPROACH:
 *
 * Phase 1 (this file, document_start):
 *   Inject critical CSS fixes (letter-spacing: 0, font-feature-settings,
 *   etc.) and the Google Fonts <link> element as early as possible —
 *   before the page's own CSS loads. This prevents the "flash of
 *   disjointed Arabic text" that would occur if we waited for idle.
 *
 *   Limitations at document_start:
 *   - chrome.storage is NOT reliably readable here (async API would
 *     return results after the page renders anyway).
 *   - Therefore, this phase uses SAFE HARDCODED DEFAULTS only:
 *       letter-spacing: 0     (always safe, never harmful)
 *       font-feature-settings (always beneficial)
 *       font-variant-ligatures (always beneficial)
 *   - Font family and line-height are applied in Phase 2.
 *
 * Phase 2 (content.js, document_idle):
 *   Read user settings from chrome.storage.local, walk the DOM with
 *   TreeWalker, apply per-element classes, inject font <link>, and
 *   apply font-family + line-height overrides.
 * ─────────────────────────────────────────────────────────────
 *
 * IMPORTANT: This file must remain minimal and synchronous.
 * No storage reads. No DOM walking. No heavy computation.
 */

(function () {
  'use strict';

  // ── Guard: only run once ───────────────────────────────────────────────────
  if (window.__AT_EARLY_INJECTED) return;
  window.__AT_EARLY_INJECTED = true;

  // ── Default font (used for early font link; will be updated by content.js) ─
  // We cannot read storage at document_start reliably.
  // We load Cairo as the default early font. content.js will correct this
  // to the user's actual selection at document_idle.
  var DEFAULT_FONT_ID = 'cairo';

  // ── Inject Google Fonts <link> early ──────────────────────────────────────
  // We need window.ARABIC_FONTS which is loaded by fonts.js (also document_start,
  // listed before this file in manifest content_scripts).
  function injectFontLink (fontId) {
    var fonts = window.ARABIC_FONTS;
    if (!fonts) return; // fonts.js not yet available (should not happen)

    var font = window.AT_getFontById(fontId) || fonts[0];
    var url = window.AT_buildFontUrl(font);

    // Check for existing link to avoid duplicates
    var existing = document.querySelector('link[data-at-font-link]');
    if (existing) {
      if (existing.href !== url) existing.href = url;
      return;
    }

    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute('data-at-font-link', '1');
    link.setAttribute('crossorigin', 'anonymous');

    // At document_start, document.head may not yet exist.
    // Use document.documentElement as fallback.
    var parent = document.head || document.documentElement;
    if (parent) {
      parent.appendChild(link);
    } else {
      // Last resort: wait for <head> via DOMContentLoaded listener
      document.addEventListener('DOMContentLoaded', function () {
        (document.head || document.documentElement).appendChild(link);
      }, { once: true });
    }
  }

  // ── Inject Phase-1 global CSS fixes ───────────────────────────────────────
  // These rules apply to any element with a known Arabic lang/dir attribute
  // and fix the most critical typographic problem (letter-spacing) immediately.
  // They do NOT include font-family or line-height — those require user
  // settings and are injected by content.js (Phase 2).
  function injectEarlyGlobalCSS () {
    var styleId = 'at-early-global-fix';
    if (document.getElementById(styleId)) return;

    var css = [
      /* Critical: zero letter-spacing on all Arabic language regions */
      '[lang="ar"] *, [lang="ar-SA"] *, [lang="ar-EG"] *,',
      '[lang="ar-AE"] *, [lang="ar-MA"] *, [lang="ar-IQ"] *,',
      '[lang="ar-SY"] *, [lang="ar-LB"] *, [lang="ar-JO"] *,',
      '[lang="fa"] *, [lang="fa-IR"] *,',
      '[lang="ur"] *, [lang="ur-PK"] *,',
      '[dir="rtl"] * {',
      '  letter-spacing: 0 !important;',
      '  word-spacing: normal !important;',
      '  font-feature-settings: "liga" 1, "calt" 1, "kern" 1 !important;',
      '  font-variant-ligatures: common-ligatures contextual !important;',
      '  text-rendering: optimizeLegibility !important;',
      '  -webkit-font-smoothing: antialiased !important;',
      '}',
      /* Also fix the container elements themselves */
      '[lang="ar"], [lang="ar-SA"], [lang="ar-EG"], [lang="ar-AE"],',
      '[lang="ar-MA"], [lang="ar-IQ"], [lang="ar-SY"], [lang="ar-LB"],',
      '[lang="ar-JO"], [lang="fa"], [lang="fa-IR"],',
      '[lang="ur"], [lang="ur-PK"], [dir="rtl"] {',
      '  letter-spacing: 0 !important;',
      '  word-spacing: normal !important;',
      '  font-feature-settings: "liga" 1, "calt" 1, "kern" 1 !important;',
      '  font-variant-ligatures: common-ligatures contextual !important;',
      '  text-rendering: optimizeLegibility !important;',
      '  -webkit-font-smoothing: antialiased !important;',
      '  overflow-wrap: break-word !important;',
      '  word-break: normal !important;',
      '}'
    ].join('\n');

    var style = document.createElement('style');
    style.id = styleId;
    style.setAttribute('data-at-injected', '1');
    style.textContent = css;

    var parent = document.head || document.documentElement;
    if (parent) {
      parent.appendChild(style);
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        (document.head || document.documentElement).appendChild(style);
      }, { once: true });
    }
  }

  // ── Run Phase 1 ───────────────────────────────────────────────────────────
  injectEarlyGlobalCSS();
  injectFontLink(DEFAULT_FONT_ID);

  // ── Expose flag for content.js to detect early injection state ────────────
  window.__AT_EARLY_FONT_ID = DEFAULT_FONT_ID;

})();
