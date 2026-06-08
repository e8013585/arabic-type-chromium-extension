/**
 * popup.js
 * Arabic Type Extension — Popup Controller
 *
 * Responsibilities:
 *   1. Detect UI language; apply dir="rtl" for Arabic/Farsi/Urdu UI.
 *   2. Localise all text nodes via chrome.i18n.getMessage().
 *   3. Load and render font picker cards from window.ARABIC_FONTS.
 *   4. Read settings from storage and apply them to all controls.
 *   5. On control change: save settings, send real-time update to content.js.
 *   6. Render status row based on page content detection.
 *   7. Handle master toggle, site exceptions, per-site overrides.
 *
 * STRICT RULES:
 *   - No innerHTML with dynamic content. Use createElement + textContent.
 *   - All user-visible strings via chrome.i18n.getMessage().
 *   - Font preview text set via textContent (trusted static Arabic strings).
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // i18n HELPER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Shorthand for chrome.i18n.getMessage.
   * Returns the message string, or the key itself if not found
   * (prevents blank UI in case of missing translations).
   * @param {string} key
   * @param {string|string[]} [substitutions]
   * @returns {string}
   */
  function t (key, substitutions) {
    var msg = chrome.i18n.getMessage(key, substitutions);
    return msg || key;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RTL DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  var RTL_UI_LANGUAGES = ['ar', 'fa', 'ur', 'he', 'yi', 'dv'];

  /**
   * Apply RTL layout to popup body if UI language is RTL.
   */
  function applyRTLIfNeeded () {
    var lang = chrome.i18n.getUILanguage() || 'en';
    var langBase = lang.split('-')[0].toLowerCase();
    if (RTL_UI_LANGUAGES.indexOf(langBase) !== -1) {
      document.body.setAttribute('dir', 'rtl');
      document.documentElement.setAttribute('lang', lang);
    } else {
      document.body.setAttribute('dir', 'ltr');
      document.documentElement.setAttribute('lang', lang);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  var currentSettings = {
    enabled: true,
    selectedFont: 'cairo',
    lineHeight: 1.8,
    fontSizeScale: 100,
    forceRTL: false,
    fixDiacritics: true,
    scriptFilter: 'all',
    exceptions: [],
    siteOverrides: {}
  };

  var currentTabId = null;
  var currentHost = '';
  var pageStatus = null; // Response from content.js getStatus

  // Whether the per-site font override is enabled for current host
  var siteOverrideActive = false;

  // ═══════════════════════════════════════════════════════════════════════════
  // ELEMENT REFERENCES
  // ═══════════════════════════════════════════════════════════════════════════

  function el (id) { return document.getElementById(id); }

  var els = {
    extensionName:          el('at-extension-name'),
    versionBadge:           el('at-version-badge'),
    masterToggle:           el('at-master-toggle'),
    masterToggleLabel:      el('at-master-toggle-label'),
    statusRow:              el('at-status-row'),
    statusDot:              el('at-status-dot'),
    statusText:             el('at-status-text'),
    siteDisabledBanner:     el('at-site-disabled-banner'),
    siteDisabledText:       el('at-site-disabled-text'),
    mainContent:            el('at-main-content'),
    tabAll:                 el('at-tab-all'),
    tabArabic:              el('at-tab-arabic'),
    tabFarsiUrdu:           el('at-tab-farsi-urdu'),
    fontPickerLabel:        el('at-font-picker-label'),
    fontList:               el('at-font-list'),
    typographyLabel:        el('at-typography-label'),
    lineHeightLabel:        el('at-line-height-label'),
    lineHeightValue:        el('at-line-height-value'),
    lineHeightSlider:       el('at-line-height-slider'),
    fontSizeLabel:          el('at-font-size-label'),
    fontSizeValue:          el('at-font-size-value'),
    fontSizeSlider:         el('at-font-size-slider'),
    letterSpacingLabel:     el('at-letter-spacing-label'),
    letterSpacingFixed:     el('at-letter-spacing-fixed'),
    letterSpacingNote:      el('at-letter-spacing-note'),
    forceRTLLabel:          el('at-force-rtl-label'),
    forceRTLDescription:    el('at-force-rtl-description'),
    forceRTLToggle:         el('at-force-rtl-toggle'),
    diacriticsLabel:        el('at-diacritics-label'),
    diacriticsDescription:  el('at-diacritics-description'),
    diacriticsToggle:       el('at-diacritics-toggle'),
    siteSectionLabel:       el('at-site-section-label'),
    disableSiteLabel:       el('at-disable-site-label'),
    currentHostname:        el('at-current-hostname'),
    disableSiteToggle:      el('at-disable-site-toggle'),
    siteFontOverrideLabel:  el('at-site-font-override-label'),
    siteFontOverrideDesc:   el('at-site-font-override-description'),
    siteFontOverrideToggle: el('at-site-font-override-toggle'),
    siteFontPicker:         el('at-site-font-picker'),
    siteFontPickerLabel:    el('at-site-font-picker-label'),
    siteFontList:           el('at-site-font-list'),
    exceptionsLabel:        el('at-exceptions-label'),
    exceptionsList:         el('at-exceptions-list'),
    exceptionsEmpty:        el('at-exceptions-empty'),
    fontSourceNote:         el('at-font-source-note'),
    fontPrivacyNote:        el('at-font-privacy-note')
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCALISATION: Set all text content
  // ═══════════════════════════════════════════════════════════════════════════

  function localiseUI () {
    // Header
    els.extensionName.textContent = t('extensionName');
    els.extensionName.style.fontFamily = "'Cairo', sans-serif";

    var manifest = chrome.runtime.getManifest();
    els.versionBadge.textContent = 'v' + manifest.version;

    els.masterToggleLabel.textContent = t('masterToggleLabel');

    // Tabs
    els.tabAll.textContent = t('filterTabAll');
    els.tabArabic.textContent = t('filterTabArabic');
    els.tabFarsiUrdu.textContent = t('filterTabFarsiUrdu');

    // Font section
    els.fontPickerLabel.textContent = t('fontPickerLabel');

    // Typography
    els.typographyLabel.textContent = t('typographyLabel');
    els.lineHeightLabel.textContent = t('lineHeightLabel');
    els.fontSizeLabel.textContent = t('fontSizeLabel');
    els.letterSpacingLabel.textContent = t('letterSpacingLabel');
    els.letterSpacingFixed.textContent = t('letterSpacingFixed');
    els.letterSpacingNote.textContent = t('letterSpacingNote');
    els.forceRTLLabel.textContent = t('forceRTLLabel');
    els.forceRTLDescription.textContent = t('forceRTLDescription');
    els.diacriticsLabel.textContent = t('diacriticsLabel');
    els.diacriticsDescription.textContent = t('diacriticsDescription');

    // Site section
    els.siteSectionLabel.textContent = t('siteSectionLabel');
    els.disableSiteLabel.textContent = t('disableSiteLabel');
    els.siteFontOverrideLabel.textContent = t('siteFontOverrideLabel');
    els.siteFontOverrideDesc.textContent = t('siteFontOverrideDescription');
    els.siteFontPickerLabel.textContent = t('siteFontPickerLabel');
    els.exceptionsLabel.textContent = t('exceptionsLabel');
    els.exceptionsEmpty.textContent = t('exceptionsEmpty');

    // Footer
    els.fontSourceNote.textContent = t('fontSourceNote');
    els.fontPrivacyNote.textContent = t('fontPrivacyNote');

    // ARIA labels for master toggle
    var masterToggleEl = els.masterToggle.parentElement;
    if (masterToggleEl) {
      masterToggleEl.setAttribute('aria-label', t('masterToggleAriaLabel'));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SLIDER HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update slider's CSS custom property for the filled-track gradient.
   * @param {HTMLInputElement} slider
   */
  function updateSliderTrack (slider) {
    var min = parseFloat(slider.min);
    var max = parseFloat(slider.max);
    var val = parseFloat(slider.value);
    var pct = ((val - min) / (max - min)) * 100;
    slider.style.setProperty('--at-slider-pct', pct.toFixed(1) + '%');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS ROW
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update the status row based on page detection results.
   * @param {object|null} status - Response from content.js getStatus.
   */
  function updateStatusRow (status) {
    els.statusDot.className = 'at-status-dot';

    if (!status || status.error) {
      els.statusDot.classList.add('at-status-none');
      els.statusText.textContent = t('statusContentScriptUnavailable');
      return;
    }

    if (status.siteDisabled) {
      // Shown via banner — status row shows neutral
      els.statusDot.classList.add('at-status-none');
      els.statusText.textContent = t('statusSiteDisabled');
      return;
    }

    if (!status.enabled) {
      els.statusDot.classList.add('at-status-none');
      els.statusText.textContent = t('statusExtensionOff');
      return;
    }

    if (status.arabicDetected) {
      els.statusDot.classList.add('at-status-arabic');
      els.statusText.textContent = t('statusArabicDetected', [
        String(status.fixedElementCount || 0)
      ]);
    } else if (status.globalModeActive) {
      els.statusDot.classList.add('at-status-global');
      els.statusText.textContent = t('statusGlobalMode');
    } else {
      els.statusDot.classList.add('at-status-none');
      els.statusText.textContent = t('statusNoArabic');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FONT CARDS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Map script style id to CSS badge class.
   * @param {string} style
   * @returns {string}
   */
  function scriptStyleToBadgeClass (style) {
    var map = {
      naskh: 'at-badge-naskh',
      kufi: 'at-badge-kufi',
      ruqah: 'at-badge-ruqah',
      modern: 'at-badge-modern',
      nastaliq: 'at-badge-nastaliq',
      display: 'at-badge-display'
    };
    return map[style] || 'at-badge-modern';
  }

  /**
   * Map bestFor array items to i18n keys.
   * @param {string} item
   * @returns {string}
   */
  function bestForToKey (item) {
    var map = {
      ui: 'bestForUI',
      body: 'bestForBody',
      headlines: 'bestForHeadlines',
      quran: 'bestForQuran',
      display: 'bestForDisplay'
    };
    return map[item] || item;
  }

  /**
   * Filter fonts based on the current scriptFilter setting.
   * @param {string} filter - "all" | "arabic" | "farsi_urdu"
   * @returns {Array}
   */
  function filterFonts (filter) {
    var fonts = window.ARABIC_FONTS || [];
    if (filter === 'farsi_urdu') {
      return fonts.filter(function (f) {
        return f.supportsUrdu || f.supportsFarsi;
      });
    }
    // "arabic" and "all" both show everything
    // ("arabic" filter is a conceptual filter — all fonts support Arabic)
    return fonts;
  }

  /**
   * Create a single font card element.
   * @param {object} font - Font descriptor.
   * @param {string} selectedFontId - Currently selected font id.
   * @param {boolean} isCompact - Whether this is the compact per-site picker.
   * @returns {HTMLElement}
   */
  function createFontCard (font, selectedFontId, isCompact) {
    var card = document.createElement('div');
    card.className = 'at-font-card';
    card.setAttribute('role', 'option');
    card.setAttribute('data-font-id', font.id);
    card.setAttribute('tabindex', '0');

    if (font.id === selectedFontId) {
      card.classList.add('at-font-selected');
      card.setAttribute('aria-selected', 'true');
    } else {
      card.setAttribute('aria-selected', 'false');
    }

    // ── Card Header ─────────────────────────────────────────────────────────
    var header = document.createElement('div');
    header.className = 'at-font-card-header';

    var nameEl = document.createElement('span');
    nameEl.className = 'at-font-name';
    // Render the font name in its own font (proper nouns, not translated)
    nameEl.style.fontFamily = font.cssFamily;
    nameEl.textContent = font.googleFontName;

    var checkmark = document.createElement('span');
    checkmark.className = 'at-font-selected-checkmark';
    checkmark.setAttribute('aria-hidden', 'true');

    header.appendChild(nameEl);
    header.appendChild(checkmark);
    card.appendChild(header);

    // ── Badges ──────────────────────────────────────────────────────────────
    var badges = document.createElement('div');
    badges.className = 'at-font-badges';

    // Script style badge
    var styleBadge = document.createElement('span');
    styleBadge.className = 'at-badge ' + scriptStyleToBadgeClass(font.scriptStyle);
    styleBadge.textContent = t(font.scriptStyleKey);
    badges.appendChild(styleBadge);

    // Best-for chips (skip in compact mode to save space)
    if (!isCompact) {
      font.bestFor.forEach(function (item) {
        var chip = document.createElement('span');
        chip.className = 'at-chip';
        chip.textContent = t(bestForToKey(item));
        badges.appendChild(chip);
      });

      // Language support tags
      if (font.supportsUrdu || font.supportsFarsi) {
        var langSupport = document.createElement('span');
        langSupport.className = 'at-lang-support';

        if (font.supportsFarsi) {
          var faTag = document.createElement('span');
          faTag.className = 'at-lang-tag';
          faTag.textContent = t('langFarsi');
          langSupport.appendChild(faTag);
        }
        if (font.supportsUrdu) {
          var urTag = document.createElement('span');
          urTag.className = 'at-lang-tag';
          urTag.textContent = t('langUrdu');
          langSupport.appendChild(urTag);
        }
        badges.appendChild(langSupport);
      }
    }

    card.appendChild(badges);

    // ── Preview Text ─────────────────────────────────────────────────────────
    var preview = document.createElement('div');
    preview.className = 'at-font-preview';
    preview.style.fontFamily = font.cssFamily;
    preview.setAttribute('dir', 'rtl');
    preview.setAttribute('lang', 'ar');
    preview.setAttribute('aria-label', t('fontPreviewAriaLabel', [font.googleFontName]));
    // previewText is a trusted static Arabic string from fonts.js
    preview.textContent = font.previewText;

    if (isCompact) {
      preview.style.fontSize = '14px';
    }

    card.appendChild(preview);

    return card;
  }

  /**
   * Render the main font picker list.
   * @param {string} filter - Current script filter.
   * @param {string} selectedFontId - Currently selected font id.
   */
  function renderFontList (filter, selectedFontId) {
    var fonts = filterFonts(filter);
    var list = els.fontList;

    // Clear existing cards
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    fonts.forEach(function (font) {
      var card = createFontCard(font, selectedFontId, false);
      card.addEventListener('click', function () {
        onFontSelected(font.id, false);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFontSelected(font.id, false);
        }
      });
      list.appendChild(card);
    });
  }

  /**
   * Render the per-site secondary font picker.
   * @param {string} filter - Current script filter.
   * @param {string} selectedFontId - Per-site selected font id.
   */
  function renderSiteFontList (filter, selectedFontId) {
    var fonts = filterFonts(filter);
    var list = els.siteFontList;

    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    fonts.forEach(function (font) {
      var card = createFontCard(font, selectedFontId, true);
      card.addEventListener('click', function () {
        onFontSelected(font.id, true);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFontSelected(font.id, true);
        }
      });
      list.appendChild(card);
    });
  }

  /**
   * Update selected state of font cards without re-rendering.
   * @param {HTMLElement} listEl - The font list container.
   * @param {string} selectedFontId
   */
  function updateSelectedCard (listEl, selectedFontId) {
    var cards = listEl.querySelectorAll('.at-font-card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var fontId = card.getAttribute('data-font-id');
      if (fontId === selectedFontId) {
        card.classList.add('at-font-selected');
        card.setAttribute('aria-selected', 'true');
      } else {
        card.classList.remove('at-font-selected');
        card.setAttribute('aria-selected', 'false');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXCEPTIONS LIST
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Render the exceptions list.
   * @param {string[]} exceptions
   */
  function renderExceptionsList (exceptions) {
    var list = els.exceptionsList;

    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    if (!exceptions || exceptions.length === 0) {
      els.exceptionsEmpty.classList.remove('at-hidden');
      return;
    }

    els.exceptionsEmpty.classList.add('at-hidden');

    exceptions.forEach(function (hostname) {
      var item = document.createElement('li');
      item.className = 'at-exception-item';

      var hostnameEl = document.createElement('span');
      hostnameEl.className = 'at-exception-hostname';
      hostnameEl.textContent = hostname;

      var removeBtn = document.createElement('button');
      removeBtn.className = 'at-exception-remove';
      removeBtn.setAttribute('aria-label', t('removeExceptionAriaLabel', [hostname]));
      removeBtn.textContent = '\u00D7'; // ×

      removeBtn.addEventListener('click', function () {
        onRemoveException(hostname);
      });

      item.appendChild(hostnameEl);
      item.appendChild(removeBtn);
      list.appendChild(item);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // APPLY SETTINGS TO UI CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Apply current settings to all popup controls (without triggering
   * change events — this is for initial population only).
   */
  function applySettingsToUI () {
    var s = currentSettings;

    // Master toggle
    els.masterToggle.checked = !!s.enabled;

    // Script filter tabs
    updateActiveTab(s.scriptFilter || 'all');

    // Font list
    renderFontList(s.scriptFilter || 'all', s.selectedFont);

    // Line height
    els.lineHeightSlider.value = s.lineHeight;
    els.lineHeightValue.textContent = parseFloat(s.lineHeight).toFixed(1);
    updateSliderTrack(els.lineHeightSlider);

    // Font size scale
    els.fontSizeSlider.value = s.fontSizeScale;
    els.fontSizeValue.textContent = s.fontSizeScale + '%';
    updateSliderTrack(els.fontSizeSlider);

    // Force RTL
    els.forceRTLToggle.checked = !!s.forceRTL;

    // Fix diacritics
    els.diacriticsToggle.checked = (typeof s.fixDiacritics === 'boolean') ? s.fixDiacritics : true;

    // Current hostname
    els.currentHostname.textContent = currentHost || t('unknownHost');

    // Disable site toggle
    var isExcluded = isHostExcluded(currentHost, s.exceptions);
    els.disableSiteToggle.checked = isExcluded;

    // Show/hide disabled banner
    if (isExcluded) {
      els.siteDisabledBanner.classList.remove('at-hidden');
      els.siteDisabledText.textContent = t('siteBannerText', [currentHost]);
    } else {
      els.siteDisabledBanner.classList.add('at-hidden');
    }

    // Per-site font override
    var override = s.siteOverrides && s.siteOverrides[currentHost];
    siteOverrideActive = !!(override && override.fontId);
    els.siteFontOverrideToggle.checked = siteOverrideActive;

    if (siteOverrideActive) {
      els.siteFontPicker.classList.remove('at-hidden');
      renderSiteFontList(s.scriptFilter || 'all', override.fontId || s.selectedFont);
    } else {
      els.siteFontPicker.classList.add('at-hidden');
    }

    // Exceptions list
    renderExceptionsList(s.exceptions || []);

    // Disable main content if master toggle is off
    updateMainContentVisibility();
  }

  /**
   * Update the active tab highlight.
   * @param {string} filter
   */
  function updateActiveTab (filter) {
    var tabs = [els.tabAll, els.tabArabic, els.tabFarsiUrdu];
    var filterMap = {
      all: els.tabAll,
      arabic: els.tabArabic,
      farsi_urdu: els.tabFarsiUrdu
    };

    tabs.forEach(function (tab) {
      tab.classList.remove('at-tab-active');
      tab.setAttribute('aria-selected', 'false');
    });

    var activeTab = filterMap[filter] || els.tabAll;
    activeTab.classList.add('at-tab-active');
    activeTab.setAttribute('aria-selected', 'true');
  }

  /**
   * Show or dim main content based on master toggle state.
   */
  function updateMainContentVisibility () {
    if (!currentSettings.enabled) {
      els.mainContent.style.opacity = '0.4';
      els.mainContent.style.pointerEvents = 'none';
    } else {
      els.mainContent.style.opacity = '';
      els.mainContent.style.pointerEvents = '';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if a hostname is in the exceptions list.
   * @param {string} hostname
   * @param {string[]} exceptions
   * @returns {boolean}
   */
  function isHostExcluded (hostname, exceptions) {
    if (!hostname || !exceptions) return false;
    for (var i = 0; i < exceptions.length; i++) {
      if (exceptions[i] === hostname) return true;
    }
    return false;
  }

  /**
   * Send settings to background.js for saving and broadcast.
   * @param {object} updates - Partial settings to merge and save.
   */
  function saveAndBroadcast (updates) {
    // Merge into currentSettings
    for (var key in updates) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        currentSettings[key] = updates[key];
      }
    }

    // Save via background.js
    chrome.runtime.sendMessage({
      action: 'saveSettings',
      settings: updates
    }, function (response) {
      if (chrome.runtime.lastError) {
        // Fallback: save directly to storage
        chrome.storage.local.set(updates);
      }
    });

    // Also send directly to current tab's content.js for real-time update
    if (currentTabId) {
      chrome.tabs.sendMessage(currentTabId, {
        action: 'updateSettings',
        settings: updates
      }, function () {
        if (chrome.runtime.lastError) {
          void chrome.runtime.lastError;
        }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Master toggle change.
   */
  function onMasterToggleChange () {
    var enabled = els.masterToggle.checked;
    saveAndBroadcast({ enabled: enabled });
    updateMainContentVisibility();
  }

  /**
   * Script filter tab clicked.
   * @param {string} filter
   */
  function onFilterTabClick (filter) {
    updateActiveTab(filter);
    renderFontList(filter, currentSettings.selectedFont);
    if (siteOverrideActive) {
      var override = currentSettings.siteOverrides[currentHost] || {};
      renderSiteFontList(filter, override.fontId || currentSettings.selectedFont);
    }
    saveAndBroadcast({ scriptFilter: filter });
  }

  /**
   * Font card selected.
   * @param {string} fontId
   * @param {boolean} isSiteOverride - Whether this is the per-site picker.
   */
  function onFontSelected (fontId, isSiteOverride) {
    if (isSiteOverride) {
      // Update per-site override
      var overrides = currentSettings.siteOverrides || {};
      if (!overrides[currentHost]) overrides[currentHost] = {};
      overrides[currentHost].fontId = fontId;

      updateSelectedCard(els.siteFontList, fontId);
      saveAndBroadcast({ siteOverrides: overrides });
    } else {
      // Update global font
      updateSelectedCard(els.fontList, fontId);
      saveAndBroadcast({ selectedFont: fontId });
    }
  }

  /**
   * Line height slider change.
   */
  function onLineHeightChange () {
    var val = parseFloat(els.lineHeightSlider.value);
    els.lineHeightValue.textContent = val.toFixed(1);
    updateSliderTrack(els.lineHeightSlider);
    saveAndBroadcast({ lineHeight: val });
  }

  /**
   * Font size scale slider change.
   */
  function onFontSizeChange () {
    var val = parseInt(els.fontSizeSlider.value, 10);
    els.fontSizeValue.textContent = val + '%';
    updateSliderTrack(els.fontSizeSlider);
    saveAndBroadcast({ fontSizeScale: val });
  }

  /**
   * Force RTL toggle change.
   */
  function onForceRTLChange () {
    saveAndBroadcast({ forceRTL: els.forceRTLToggle.checked });
  }

  /**
   * Fix diacritics toggle change.
   */
  function onDiacriticsChange () {
    saveAndBroadcast({ fixDiacritics: els.diacriticsToggle.checked });
  }

  /**
   * Disable on this site toggle change.
   */
  function onDisableSiteChange () {
    var exceptions = (currentSettings.exceptions || []).slice();
    var isChecked = els.disableSiteToggle.checked;

    if (isChecked) {
      // Add to exceptions if not already there
      if (currentHost && exceptions.indexOf(currentHost) === -1) {
        exceptions.push(currentHost);
      }
      els.siteDisabledBanner.classList.remove('at-hidden');
      els.siteDisabledText.textContent = t('siteBannerText', [currentHost]);
    } else {
      // Remove from exceptions
      exceptions = exceptions.filter(function (h) { return h !== currentHost; });
      els.siteDisabledBanner.classList.add('at-hidden');
    }

    renderExceptionsList(exceptions);
    saveAndBroadcast({ exceptions: exceptions });
  }

  /**
   * Remove a single exception.
   * @param {string} hostname
   */
  function onRemoveException (hostname) {
    var exceptions = (currentSettings.exceptions || []).filter(function (h) {
      return h !== hostname;
    });

    // If removing current host, uncheck the toggle
    if (hostname === currentHost) {
      els.disableSiteToggle.checked = false;
      els.siteDisabledBanner.classList.add('at-hidden');
    }

    renderExceptionsList(exceptions);
    saveAndBroadcast({ exceptions: exceptions });
  }

  /**
   * Per-site font override toggle change.
   */
  function onSiteFontOverrideChange () {
    siteOverrideActive = els.siteFontOverrideToggle.checked;

    if (siteOverrideActive) {
      els.siteFontPicker.classList.remove('at-hidden');
      var overrides = currentSettings.siteOverrides || {};
      var currentOverride = overrides[currentHost] || {};
      var siteFont = currentOverride.fontId || currentSettings.selectedFont;
      renderSiteFontList(currentSettings.scriptFilter || 'all', siteFont);

      // If no override exists yet, create one with current global font
      if (!currentOverride.fontId) {
        if (!overrides[currentHost]) overrides[currentHost] = {};
        overrides[currentHost].fontId = currentSettings.selectedFont;
        saveAndBroadcast({ siteOverrides: overrides });
      }
    } else {
      els.siteFontPicker.classList.add('at-hidden');

      // Remove per-site override entirely
      var existingOverrides = currentSettings.siteOverrides || {};
      if (existingOverrides[currentHost]) {
        delete existingOverrides[currentHost];
        saveAndBroadcast({ siteOverrides: existingOverrides });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT BINDING
  // ═══════════════════════════════════════════════════════════════════════════

  function bindEvents () {
    // Master toggle
    els.masterToggle.addEventListener('change', onMasterToggleChange);

    // Script filter tabs
    els.tabAll.addEventListener('click', function () { onFilterTabClick('all'); });
    els.tabArabic.addEventListener('click', function () { onFilterTabClick('arabic'); });
    els.tabFarsiUrdu.addEventListener('click', function () { onFilterTabClick('farsi_urdu'); });

    // Sliders
    els.lineHeightSlider.addEventListener('input', onLineHeightChange);
    els.fontSizeSlider.addEventListener('input', onFontSizeChange);

    // Toggles
    els.forceRTLToggle.addEventListener('change', onForceRTLChange);
    els.diacriticsToggle.addEventListener('change', onDiacriticsChange);
    els.disableSiteToggle.addEventListener('change', onDisableSiteChange);
    els.siteFontOverrideToggle.addEventListener('change', onSiteFontOverrideChange);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALISATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Query the active tab, then load settings and page status.
   */
  function init () {
    applyRTLIfNeeded();
    localiseUI();
    bindEvents();

    // Get current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
        updateStatusRow(null);
        return;
      }

      var tab = tabs[0];
      currentTabId = tab.id;

      try {
        var url = new URL(tab.url);
        currentHost = url.hostname;
      } catch (e) {
        currentHost = '';
      }

      // Load settings from background
      chrome.runtime.sendMessage({ action: 'getSettings' }, function (settings) {
        if (chrome.runtime.lastError || !settings) {
          // Fallback to storage directly
          chrome.storage.local.get(null, function (data) {
            if (data) {
              for (var k in data) {
                if (Object.prototype.hasOwnProperty.call(data, k)) {
                  currentSettings[k] = data[k];
                }
              }
            }
            applySettingsToUI();
            queryPageStatus();
          });
          return;
        }

        for (var key in settings) {
          if (Object.prototype.hasOwnProperty.call(settings, key)) {
            currentSettings[key] = settings[key];
          }
        }
        applySettingsToUI();
        queryPageStatus();
      });
    });
  }

  /**
   * Query the content.js on the active tab for page status.
   */
  function queryPageStatus () {
    if (!currentTabId) {
      updateStatusRow(null);
      return;
    }

    chrome.runtime.sendMessage(
      { action: 'getStatus', tabId: currentTabId },
      function (response) {
        if (chrome.runtime.lastError) {
          updateStatusRow(null);
          return;
        }
        pageStatus = response;
        updateStatusRow(response);
      }
    );
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

})();
