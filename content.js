/**
 * content.js
 * Arabic Type Extension — Phase 2: Document-Idle Processing
 *
 * ─────────────────────────────────────────────────────────────
 * TWO-PHASE APPROACH (see content-early.js for Phase 1 details):
 *
 * This file (Phase 2, document_idle) handles:
 *   1. Reading user settings from chrome.storage.local.
 *   2. Checking if the current site is in the exceptions list.
 *   3. Updating the Google Fonts <link> to match user's font choice.
 *   4. Injecting the full Strategy B global CSS (with font-family,
 *      line-height, per user settings).
 *   5. Walking the DOM (Strategy A) with TreeWalker to identify
 *      Arabic elements and apply the "at-arabic-fix" class.
 *   6. Setting up a MutationObserver for dynamic content.
 *   7. Listening for messages from popup.js for real-time updates.
 * ─────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  // ── Guard: prevent double execution ───────────────────────────────────────
  if (window.__AT_CONTENT_INJECTED) return;
  window.__AT_CONTENT_INJECTED = true;

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Arabic Unicode ranges:
   *   \u0600-\u06FF  Arabic block (primary — covers Arabic, Farsi, Urdu)
   *   \u0750-\u077F  Arabic Supplement
   *   \u08A0-\u08FF  Arabic Extended-A
   *   \uFB50-\uFDFF  Arabic Presentation Forms-A
   *   \uFE70-\uFEFF  Arabic Presentation Forms-B
   */
  var ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

  /**
   * Farsi/Persian-specific characters (within Arabic block):
   * ک \u06A9, گ \u06AF, پ \u067E, چ \u0686, ژ \u0698, ی \u06CC
   */
  var FARSI_SPECIFIC_REGEX = /[\u06A9\u06AF\u067E\u0686\u0698\u06CC]/;

  /**
   * Urdu-specific characters (within Arabic block):
   * ٹ \u0679, ڈ \u0688, ڑ \u0691, ں \u06BA, ہ \u06C1, ھ \u06BE, ے \u06D2
   */
  var URDU_SPECIFIC_REGEX = /[\u0679\u0688\u0691\u06BA\u06C1\u06BE\u06D2]/;

  /**
   * Block-level elements that warrant RTL direction enforcement
   * when >= 80% of their text is Arabic.
   */
  var BLOCK_ELEMENTS = {
    'DIV': true, 'P': true, 'LI': true, 'TD': true, 'TH': true,
    'H1': true, 'H2': true, 'H3': true, 'H4': true, 'H5': true, 'H6': true,
    'ARTICLE': true, 'SECTION': true, 'BLOCKQUOTE': true, 'ASIDE': true,
    'HEADER': true, 'FOOTER': true, 'MAIN': true, 'FIGCAPTION': true,
    'CAPTION': true, 'SUMMARY': true, 'DT': true, 'DD': true
  };

  /**
   * Elements to SKIP entirely during DOM walk (FILTER_REJECT).
   * Text inside these elements should not be processed.
   */
  var SKIP_ELEMENTS = {
    'SCRIPT': true, 'STYLE': true, 'NOSCRIPT': true, 'CODE': true,
    'PRE': true, 'TEXTAREA': true, 'INPUT': true, 'SELECT': true,
    'BUTTON': true, 'OPTION': true, 'OPTGROUP': true, 'SVG': true,
    'MATH': true, 'CANVAS': true, 'AUDIO': true, 'VIDEO': true,
    'LINK': true, 'META': true, 'TITLE': true
  };

  /** Detection thresholds */
  var ARABIC_MIN_CHARS = 3;
  var ARABIC_MIN_RATIO = 0.25; // 25% of non-whitespace chars
  var RTL_ENFORCE_RATIO = 0.80; // 80% Arabic → enforce RTL (if forceRTL on)

  /** Style element IDs (separate elements for surgical updates) */
  var STYLE_ID_FONT_IMPORT = 'at-font-import';
  var STYLE_ID_GLOBAL_FIX = 'at-global-fix';
  var STYLE_ID_ELEMENT_FIX = 'at-element-fix';

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  /** @type {object} Current resolved settings */
  var settings = {
    enabled: true,
    selectedFont: 'cairo',
    lineHeight: 1.8,
    fontSizeScale: 100,
    forceRTL: false,
    fixDiacritics: true,
    exceptions: [],
    siteOverrides: {}
  };

  /** Current hostname */
  var currentHost = location.hostname;

  /** Count of elements fixed on this page */
  var fixedElementCount = 0;

  /** Whether Arabic text was detected */
  var arabicDetected = false;

  /** Whether Arabic was detected via lang/dir attributes (global mode) */
  var globalModeActive = false;

  /** Whether the extension is disabled for this site */
  var siteDisabled = false;

  /** MutationObserver instance */
  var mutationObserver = null;

  /** Debounce timer for MutationObserver */
  var mutationDebounceTimer = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // SCRIPT DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Count Arabic characters in a string.
   * @param {string} text
   * @returns {number}
   */
  function countArabicChars (text) {
    var count = 0;
    for (var i = 0; i < text.length; i++) {
      if (ARABIC_REGEX.test(text[i])) count++;
    }
    return count;
  }

  /**
   * Count non-whitespace characters in a string.
   * @param {string} text
   * @returns {number}
   */
  function countNonWhitespace (text) {
    var count = 0;
    for (var i = 0; i < text.length; i++) {
      if (!/\s/.test(text[i])) count++;
    }
    return count;
  }

  /**
   * Determine whether a text string qualifies as "Arabic content"
   * based on the detection thresholds.
   * @param {string} text
   * @returns {boolean}
   */
  function isArabicText (text) {
    if (!text || !ARABIC_REGEX.test(text)) return false;
    var arabicCount = countArabicChars(text);
    if (arabicCount >= ARABIC_MIN_CHARS) return true;
    var nonWsCount = countNonWhitespace(text);
    if (nonWsCount === 0) return false;
    return (arabicCount / nonWsCount) >= ARABIC_MIN_RATIO;
  }

  /**
   * Check if text is predominantly Arabic (for RTL enforcement threshold).
   * @param {string} text
   * @returns {boolean}
   */
  function isPredominantlyArabic (text) {
    if (!text) return false;
    var arabicCount = countArabicChars(text);
    var nonWsCount = countNonWhitespace(text);
    if (nonWsCount === 0) return false;
    return (arabicCount / nonWsCount) >= RTL_ENFORCE_RATIO;
  }

  /**
   * Detect whether text contains Farsi-specific characters.
   * @param {string} text
   * @returns {boolean}
   */
  function hasFarsi (text) {
    return FARSI_SPECIFIC_REGEX.test(text);
  }

  /**
   * Detect whether text contains Urdu-specific characters.
   * @param {string} text
   * @returns {boolean}
   */
  function hasUrdu (text) {
    return URDU_SPECIFIC_REGEX.test(text);
  }

  /**
   * Detect the primary script of a text string.
   * @param {string} text
   * @returns {"arabic"|"farsi"|"urdu"|"mixed"|"none"}
   */
  function detectScript (text) {
    if (!text || !ARABIC_REGEX.test(text)) return 'none';

    var arabicCount = countArabicChars(text);
    var nonWsCount = countNonWhitespace(text);
    var arabicRatio = nonWsCount > 0 ? arabicCount / nonWsCount : 0;

    var hasAny = arabicCount > 0;
    if (!hasAny) return 'none';

    var isUrdu = hasUrdu(text);
    var isFarsi = hasFarsi(text);

    if (isUrdu) return 'urdu';
    if (isFarsi) return 'farsi';

    // If Arabic characters present but ratio is low, it's mixed
    if (arabicRatio < ARABIC_MIN_RATIO && arabicCount < ARABIC_MIN_CHARS) {
      return 'mixed';
    }

    return 'arabic';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Resolve effective settings for the current page, merging
   * per-site overrides over global settings.
   * @returns {object} Effective settings object.
   */
  function resolveEffectiveSettings () {
    var effective = {
      enabled: settings.enabled,
      selectedFont: settings.selectedFont,
      lineHeight: settings.lineHeight,
      fontSizeScale: settings.fontSizeScale,
      forceRTL: settings.forceRTL,
      fixDiacritics: settings.fixDiacritics
    };

    var overrides = settings.siteOverrides && settings.siteOverrides[currentHost];
    if (overrides) {
      if (overrides.fontId) effective.selectedFont = overrides.fontId;
      if (typeof overrides.lineHeight === 'number') effective.lineHeight = overrides.lineHeight;
      if (typeof overrides.fontSizeScale === 'number') effective.fontSizeScale = overrides.fontSizeScale;
      if (typeof overrides.forceRTL === 'boolean') effective.forceRTL = overrides.forceRTL;
    }

    return effective;
  }

  /**
   * Check if current site is in the exceptions list.
   * @returns {boolean}
   */
  function isSiteExcluded () {
    var exceptions = settings.exceptions || [];
    for (var i = 0; i < exceptions.length; i++) {
      if (exceptions[i] === currentHost) return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STYLE INJECTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get or create a <style> element with a given ID.
   * @param {string} id
   * @returns {HTMLStyleElement}
   */
  function getOrCreateStyle (id) {
    var existing = document.getElementById(id);
    if (existing && existing.tagName === 'STYLE') return existing;

    var style = document.createElement('style');
    style.id = id;
    style.setAttribute('data-at-injected', '1');
    (document.head || document.documentElement).appendChild(style);
    return style;
  }

  /**
   * Update or create the Google Fonts <link> element.
   * Uses <link> instead of @import for better CSP compatibility.
   * @param {object} font - Font descriptor from ARABIC_FONTS.
   */
  function updateFontLink (font) {
    var url = window.AT_buildFontUrl(font);
    var existing = document.querySelector('link[data-at-font-link]');

    if (existing) {
      // Update href in place if changed (avoids removing/re-adding)
      if (existing.href !== url) {
        existing.href = url;
      }
      return;
    }

    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute('data-at-font-link', '1');
    link.setAttribute('crossorigin', 'anonymous');
    (document.head || document.documentElement).appendChild(link);
  }

  /**
   * Inject Strategy B: global CSS targeting lang/dir attributes.
   * This covers statically declared Arabic sections that TreeWalker
   * might encounter after fonts are applied.
   * @param {object} effective - Effective settings.
   * @param {object} font - Current font descriptor.
   */
  function injectGlobalFixCSS (effective, font) {
    var lineHeight = effective.lineHeight;
    var fontFamily = font.cssFamily;
    var fontSizeScale = (effective.fontSizeScale / 100).toFixed(2);

    var diacriticsCSS = effective.fixDiacritics
      ? [
        '  text-underline-offset: 3px;',
        '  text-decoration-skip-ink: auto;'
      ].join('\n')
      : '';

    var rtlCSS = effective.forceRTL
      ? [
        '[lang="ar"], [lang="ar-SA"], [lang="ar-EG"], [lang="ar-AE"],',
        '[lang="ar-MA"], [lang="ar-IQ"], [lang="ar-SY"], [lang="ar-LB"],',
        '[lang="ar-JO"], [lang="fa"], [lang="fa-IR"],',
        '[lang="ur"], [lang="ur-PK"], [dir="rtl"] {',
        '  direction: rtl !important;',
        '  text-align: right !important;',
        '  unicode-bidi: embed !important;',
        '}'
      ].join('\n')
      : '';

    var css = [
      '/* Arabic Type Extension — Strategy B Global Fix */',
      '/* Targets elements with known Arabic lang/dir attributes */',
      '',
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
      '',
      '[lang="ar"], [lang="ar-SA"], [lang="ar-EG"], [lang="ar-AE"],',
      '[lang="ar-MA"], [lang="ar-IQ"], [lang="ar-SY"], [lang="ar-LB"],',
      '[lang="ar-JO"], [lang="fa"], [lang="fa-IR"],',
      '[lang="ur"], [lang="ur-PK"], [dir="rtl"] {',
      '  letter-spacing: 0 !important;',
      '  word-spacing: normal !important;',
      '  line-height: ' + lineHeight + ' !important;',
      '  font-family: ' + fontFamily + ' !important;',
      '  font-feature-settings: "liga" 1, "calt" 1, "kern" 1 !important;',
      '  font-variant-ligatures: common-ligatures contextual !important;',
      '  text-rendering: optimizeLegibility !important;',
      '  -webkit-font-smoothing: antialiased !important;',
      '  overflow-wrap: break-word !important;',
      '  word-break: normal !important;',
      diacriticsCSS,
      '}',
      '',
      rtlCSS
    ].join('\n');

    var style = getOrCreateStyle(STYLE_ID_GLOBAL_FIX);
    style.textContent = css;

    // Detect if page has Arabic via lang/dir (global mode)
    globalModeActive = !!(
      document.querySelector('[lang^="ar"]') ||
      document.querySelector('[lang="fa"]') ||
      document.querySelector('[lang^="fa-"]') ||
      document.querySelector('[lang="ur"]') ||
      document.querySelector('[lang^="ur-"]') ||
      document.querySelector('[dir="rtl"]')
    );
  }

  /**
   * Inject Strategy A: class-based CSS definitions.
   * Defines the rules for .at-arabic-fix and .at-arabic-rtl classes.
   * @param {object} effective - Effective settings.
   * @param {object} font - Current font descriptor.
   */
  function injectElementFixCSS (effective, font) {
    var lineHeight = effective.lineHeight;
    var fontFamily = font.cssFamily;
    var fontSizeScale = (effective.fontSizeScale / 100).toFixed(2);

    var diacriticsCSS = effective.fixDiacritics
      ? [
        '  text-underline-offset: 3px;',
        '  text-decoration-skip-ink: auto;'
      ].join('\n')
      : '';

    var css = [
      '/* Arabic Type Extension — Strategy A Element Fix */',
      '/* Applied to Arabic-detected elements via TreeWalker */',
      '',
      '.at-arabic-fix {',
      '  letter-spacing: 0 !important;',
      '  word-spacing: normal !important;',
      '  line-height: ' + lineHeight + ' !important;',
      '  font-family: ' + fontFamily + ' !important;',
      '  font-size: calc(1em * ' + fontSizeScale + ') !important;',
      '  text-rendering: optimizeLegibility !important;',
      '  -webkit-font-smoothing: antialiased !important;',
      '  font-feature-settings: "liga" 1, "calt" 1, "kern" 1 !important;',
      '  font-variant-ligatures: common-ligatures contextual !important;',
      '  overflow-wrap: break-word !important;',
      '  word-break: normal !important;',
      diacriticsCSS,
      '}',
      '',
      '.at-arabic-rtl {',
      '  direction: rtl !important;',
      '  text-align: right !important;',
      '  unicode-bidi: embed !important;',
      '}',
      '',
      '/* Ensure non-Arabic children within fixed blocks inherit cleanly */',
      '/* without triggering additional processing */',
      '.at-arabic-fix *:not(.at-arabic-fix):not(.at-arabic-rtl) {',
      '  /* Inherits letter-spacing: 0 and font-feature-settings from parent */',
      '  /* No additional overrides — let natural inheritance apply */',
      '}'
    ].join('\n');

    var style = getOrCreateStyle(STYLE_ID_ELEMENT_FIX);
    style.textContent = css;
  }

  /**
   * Remove all injected style elements and font link from the page.
   * Called when the extension is disabled (master toggle OFF) or
   * when the site is in the exceptions list.
   */
  function removeAllInjectedStyles () {
    var ids = [
      'at-early-global-fix',
      STYLE_ID_FONT_IMPORT,
      STYLE_ID_GLOBAL_FIX,
      STYLE_ID_ELEMENT_FIX
    ];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.parentNode.removeChild(el);
    });

    // Remove font link
    var fontLink = document.querySelector('link[data-at-font-link]');
    if (fontLink) fontLink.parentNode.removeChild(fontLink);

    // Remove classes from all processed elements
    var fixed = document.querySelectorAll('.at-arabic-fix');
    for (var i = 0; i < fixed.length; i++) {
      fixed[i].classList.remove('at-arabic-fix');
      fixed[i].classList.remove('at-arabic-rtl');
      fixed[i].removeAttribute('data-at-fixed');
    }

    fixedElementCount = 0;
    arabicDetected = false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY A: DOM WALKER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Apply Arabic fix classes to a single element.
   * @param {Element} element - The element to fix.
   * @param {string} text - The text content to analyse.
   * @param {object} effective - Effective settings.
   */
  function applyFixToElement (element, text, effective) {
    if (element.hasAttribute('data-at-fixed')) return;

    element.classList.add('at-arabic-fix');
    element.setAttribute('data-at-fixed', '1');
    fixedElementCount++;
    arabicDetected = true;

    // Enforce RTL only if:
    // 1. forceRTL setting is ON
    // 2. Element is block-level
    // 3. >= 80% of text is Arabic
    if (
      effective.forceRTL &&
      BLOCK_ELEMENTS[element.tagName] &&
      isPredominantlyArabic(text)
    ) {
      element.classList.add('at-arabic-rtl');
    }
  }

  /**
   * Create a NodeFilter function for TreeWalker.
   * Accepts TEXT nodes containing Arabic text above threshold.
   * Rejects nodes inside skip elements and already-processed elements.
   * @returns {object} NodeFilter object.
   */
  function createArabicNodeFilter () {
    return {
      acceptNode: function (node) {
        // Walk TEXT nodes
        if (node.nodeType !== Node.TEXT_NODE) {
          return NodeFilter.FILTER_SKIP;
        }

        var text = node.textContent;
        if (!text || !ARABIC_REGEX.test(text)) {
          return NodeFilter.FILTER_SKIP;
        }

        // Check parent is not a skip element
        var parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        // Skip elements that should never be processed
        if (SKIP_ELEMENTS[parent.tagName]) return NodeFilter.FILTER_REJECT;

        // Skip if already processed
        if (parent.hasAttribute('data-at-fixed')) return NodeFilter.FILTER_SKIP;

        // Skip if parent is inside an already-processed element
        // (avoid re-processing children of fixed blocks)
        var ancestor = parent.parentElement;
        while (ancestor) {
          if (ancestor.hasAttribute('data-at-fixed')) {
            return NodeFilter.FILTER_SKIP;
          }
          ancestor = ancestor.parentElement;
        }

        // Apply threshold check
        if (isArabicText(text)) {
          return NodeFilter.FILTER_ACCEPT;
        }

        return NodeFilter.FILTER_SKIP;
      }
    };
  }

  /**
   * Walk a subtree and apply fixes to Arabic text elements.
   * @param {Node} root - Root node to walk (default: document.body).
   * @param {object} effective - Effective settings.
   */
  function walkAndFix (root, effective) {
    if (!root) return;

    var walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      createArabicNodeFilter(),
      false
    );

    var node;
    while ((node = walker.nextNode()) !== null) {
      var parent = node.parentElement;
      if (!parent) continue;

      // Skip elements in the skip list (belt-and-suspenders check)
      if (SKIP_ELEMENTS[parent.tagName]) continue;

      var text = parent.textContent || '';
      applyFixToElement(parent, text, effective);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MUTATION OBSERVER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Process a set of added nodes from a MutationObserver callback.
   * @param {NodeList} addedNodes
   * @param {object} effective
   */
  function processAddedNodes (addedNodes, effective) {
    for (var i = 0; i < addedNodes.length; i++) {
      var node = addedNodes[i];
      if (node.nodeType === Node.ELEMENT_NODE) {
        walkAndFix(node, effective);
      } else if (node.nodeType === Node.TEXT_NODE) {
        if (node.parentElement && isArabicText(node.textContent)) {
          var parent = node.parentElement;
          if (!SKIP_ELEMENTS[parent.tagName]) {
            applyFixToElement(parent, parent.textContent || '', effective);
          }
        }
      }
    }
  }

  /**
   * Set up the MutationObserver to handle dynamic content.
   * Debounced at 200ms to batch rapid DOM changes (SPAs, etc.).
   * Also re-injects styles if they are removed by the page.
   */
  function setupMutationObserver (effective, font) {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }

    mutationObserver = new MutationObserver(function (mutations) {
      // Re-inject styles if they were removed by the page (SPA behavior)
      if (!document.getElementById(STYLE_ID_GLOBAL_FIX)) {
        injectGlobalFixCSS(effective, font);
      }
      if (!document.getElementById(STYLE_ID_ELEMENT_FIX)) {
        injectElementFixCSS(effective, font);
      }
      if (!document.querySelector('link[data-at-font-link]')) {
        updateFontLink(font);
      }

      // Debounce the DOM walk for added nodes
      if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
      mutationDebounceTimer = setTimeout(function () {
        var addedNodes = [];
        for (var i = 0; i < mutations.length; i++) {
          var mutation = mutations[i];
          if (mutation.type === 'childList') {
            for (var j = 0; j < mutation.addedNodes.length; j++) {
              addedNodes.push(mutation.addedNodes[j]);
            }
          }
        }
        if (addedNodes.length > 0) {
          processAddedNodes(addedNodes, effective);
        }
      }, 200);
    });

    var target = document.body || document.documentElement;
    mutationObserver.observe(target, {
      childList: true,
      subtree: true
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN INITIALISATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Full initialisation / re-initialisation.
   * Called once on document_idle, and again when settings change.
   */
  function init () {
    if (isSiteExcluded()) {
      siteDisabled = true;
      removeAllInjectedStyles();
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
      return;
    }
    siteDisabled = false;

    var effective = resolveEffectiveSettings();

    if (!effective.enabled) {
      removeAllInjectedStyles();
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
      return;
    }

    var font = window.AT_getFontById(effective.selectedFont) ||
               window.ARABIC_FONTS[0];

    // Update font link to user's chosen font
    updateFontLink(font);

    // Inject Strategy B: global lang/dir CSS
    injectGlobalFixCSS(effective, font);

    // Inject Strategy A: class definitions
    injectElementFixCSS(effective, font);

    // Walk existing DOM
    fixedElementCount = 0;
    arabicDetected = false;
    var body = document.body || document.documentElement;
    walkAndFix(body, effective);

    // Set up MutationObserver for dynamic content
    setupMutationObserver(effective, font);
  }

  /**
   * Apply updated settings without full re-init.
   * Called when popup sends a real-time update message.
   * @param {object} newSettings - Partial or full settings update.
   */
  function applySettingsUpdate (newSettings) {
    // Merge new values into current settings
    for (var key in newSettings) {
      if (Object.prototype.hasOwnProperty.call(newSettings, key)) {
        settings[key] = newSettings[key];
      }
    }
    // Re-run full init to apply changes
    init();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGE LISTENER (from popup.js and background.js)
  // ═══════════════════════════════════════════════════════════════════════════

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message || !message.action) return false;

    switch (message.action) {

      case 'init':
        // Sent by background.js on tabs.onUpdated — we re-read storage
        chrome.storage.local.get(null, function (data) {
          if (chrome.runtime.lastError) return;
          if (data) {
            for (var key in data) {
              if (Object.prototype.hasOwnProperty.call(data, key)) {
                settings[key] = data[key];
              }
            }
          }
          init();
        });
        break;

      case 'updateSettings':
        // Sent by popup.js for real-time updates
        if (message.settings) {
          applySettingsUpdate(message.settings);
        }
        sendResponse({ success: true });
        break;

      case 'getStatus':
        // Sent by popup.js / background.js to get current page status
        sendResponse({
          arabicDetected: arabicDetected,
          globalModeActive: globalModeActive,
          fixedElementCount: fixedElementCount,
          siteDisabled: siteDisabled,
          enabled: settings.enabled,
          currentHost: currentHost
        });
        break;

      case 'disable':
        settings.enabled = false;
        removeAllInjectedStyles();
        if (mutationObserver) {
          mutationObserver.disconnect();
          mutationObserver = null;
        }
        sendResponse({ success: true });
        break;

      case 'enable':
        settings.enabled = true;
        init();
        sendResponse({ success: true });
        break;

      default:
        break;
    }

    // Return false for non-async responses (Chrome MV3 requirement)
    return false;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOTSTRAP: Read settings from storage, then initialise
  // ═══════════════════════════════════════════════════════════════════════════

  chrome.storage.local.get(null, function (data) {
    if (chrome.runtime.lastError) {
      // Storage unavailable — run with defaults
      init();
      return;
    }

    if (data) {
      for (var key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          settings[key] = data[key];
        }
      }
    }

    init();
  });

})();
