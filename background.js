/**
 * background.js
 * Arabic Type Extension — Manifest V3 Service Worker
 *
 * Responsibilities:
 *   1. Set default settings on first install.
 *   2. On tab navigation complete: send "init" message to content.js.
 *   3. Relay status requests between popup.js and content.js.
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

var DEFAULT_SETTINGS = {
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

// ═══════════════════════════════════════════════════════════════════════════
// INSTALL / UPDATE HANDLER
// ═══════════════════════════════════════════════════════════════════════════

chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === 'install') {
    // First install: set all defaults
    chrome.storage.local.set(DEFAULT_SETTINGS, function () {
      if (chrome.runtime.lastError) {
        console.error('[Arabic Type] Failed to set defaults:', chrome.runtime.lastError);
      }
    });
  } else if (details.reason === 'update') {
    // Extension update: merge any new default keys without overwriting
    // existing user preferences
    chrome.storage.local.get(null, function (existing) {
      if (chrome.runtime.lastError) return;

      var updates = {};
      for (var key in DEFAULT_SETTINGS) {
        if (
          Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key) &&
          !Object.prototype.hasOwnProperty.call(existing, key)
        ) {
          updates[key] = DEFAULT_SETTINGS[key];
        }
      }

      if (Object.keys(updates).length > 0) {
        chrome.storage.local.set(updates);
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TAB NAVIGATION HANDLER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * When a tab completes loading, send an "init" message to content.js
 * so it can re-read settings and re-apply fixes to the new page.
 *
 * Note: content.js also reads storage independently on load; this
 * message is a belt-and-suspenders trigger for SPAs and navigations.
 */
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
  if (tab.url.startsWith('about:') || tab.url.startsWith('file://')) return;

  // Send init signal to content.js running in this tab
  chrome.tabs.sendMessage(tabId, { action: 'init' }, function (response) {
    // Suppress "Could not establish connection" errors — these are expected
    // when the tab has no content script (e.g. PDF viewer, devtools pages).
    if (chrome.runtime.lastError) {
      // Silently ignore — not all pages run content scripts.
      void chrome.runtime.lastError;
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE RELAY HANDLER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Relay messages between popup.js and content.js.
 *
 * Messages handled:
 *   { action: "getStatus", tabId: number }
 *     → Forwarded to content.js in the specified tab.
 *     → Response relayed back to popup.js.
 *
 *   { action: "getSettings" }
 *     → Returns current settings from storage directly.
 *
 *   { action: "saveSettings", settings: object }
 *     → Saves settings to storage.
 *     → Broadcasts "updateSettings" to all relevant tabs.
 */
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || !message.action) return false;

  switch (message.action) {

    case 'getStatus': {
      var tabId = message.tabId;
      if (!tabId) {
        sendResponse({ error: 'No tabId provided' });
        return false;
      }

      chrome.tabs.sendMessage(tabId, { action: 'getStatus' }, function (response) {
        if (chrome.runtime.lastError) {
          sendResponse({
            arabicDetected: false,
            globalModeActive: false,
            fixedElementCount: 0,
            siteDisabled: false,
            error: 'Content script not available'
          });
          return;
        }
        sendResponse(response || {});
      });

      return true; // Keep channel open for async response
    }

    case 'getSettings': {
      chrome.storage.local.get(null, function (data) {
        if (chrome.runtime.lastError) {
          sendResponse({ error: 'Storage unavailable' });
          return;
        }
        // Merge with defaults to ensure all keys present
        var merged = {};
        for (var dk in DEFAULT_SETTINGS) {
          if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, dk)) {
            merged[dk] = Object.prototype.hasOwnProperty.call(data, dk)
              ? data[dk]
              : DEFAULT_SETTINGS[dk];
          }
        }
        sendResponse(merged);
      });
      return true;
    }

    case 'saveSettings': {
      var newSettings = message.settings;
      if (!newSettings) {
        sendResponse({ error: 'No settings provided' });
        return false;
      }

      chrome.storage.local.set(newSettings, function () {
        if (chrome.runtime.lastError) {
          sendResponse({ error: 'Failed to save settings' });
          return;
        }

        // Broadcast update to all open tabs with content scripts
        chrome.tabs.query({}, function (tabs) {
          tabs.forEach(function (tab) {
            if (!tab.url) return;
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
            if (tab.url.startsWith('about:')) return;

            chrome.tabs.sendMessage(
              tab.id,
              { action: 'updateSettings', settings: newSettings },
              function () {
                // Suppress errors for tabs without content scripts
                if (chrome.runtime.lastError) {
                  void chrome.runtime.lastError;
                }
              }
            );
          });
        });

        sendResponse({ success: true });
      });
      return true;
    }

    default:
      return false;
  }
});
