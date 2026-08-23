// Service worker for "Don't Mess With Paste"
// Handles global + per-site enable/disable and force-mode state, the
// per-tab blocked-attempt badge counter, the "Copy anyway" context menu,
// and the Force Mode keyboard shortcut.

const GLOBAL_DISABLED_KEY = "global_disabled";
const COPY_ANYWAY_MENU_ID = "dmwp-copy-anyway";

// tabId -> number of block attempts neutralized on that tab's current page.
// Intentionally in-memory only: counts are meaningless across navigations/restarts.
const blockedCounts = new Map();

function setBadge(tabId, text, color) {
  chrome.action.setBadgeText({ tabId: tabId, text: text });
  if (color) {
    chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: color });
  }
}

function renderCountBadge(tabId) {
  const count = blockedCounts.get(tabId) || 0;
  setBadge(tabId, count > 0 ? String(count) : "", "#4caf50");
}

function flashBadge(tabId, text, color) {
  setBadge(tabId, text, color);
  setTimeout(() => renderCountBadge(tabId), 1200);
}

function parseHostname(tab) {
  if (!tab) return "";
  const candidates = [tab.url, tab.pendingUrl];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return new URL(candidate).hostname;
    } catch (_) {}
  }
  return "";
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message && message.type === "checkEnabled") {
    const hostname = message.hostname;
    const disabledKey = hostname ? "disabled_" + hostname : "";
    const forceKey = hostname ? "force_" + hostname : "";
    const keys = [GLOBAL_DISABLED_KEY];

    if (disabledKey) keys.push(disabledKey);
    if (forceKey) keys.push(forceKey);

    chrome.storage.local.get(keys, function (result) {
      const globalDisabled = !!result[GLOBAL_DISABLED_KEY];
      const siteEnabled = hostname ? !result[disabledKey] : false;
      const enabled = !globalDisabled && siteEnabled;

      sendResponse({
        enabled: enabled,
        forceMode: enabled && !!result[forceKey],
        globalDisabled: globalDisabled
      });
    });

    return true; // keep channel open for async response
  }

  if (message && message.type === "resetCount") {
    const tabId = sender.tab && sender.tab.id;
    if (typeof tabId === "number") {
      blockedCounts.set(tabId, 0);
      renderCountBadge(tabId);
    }
    return false;
  }

  if (message && message.type === "blockedAttempt") {
    const tabId = sender.tab && sender.tab.id;
    if (typeof tabId === "number") {
      blockedCounts.set(tabId, (blockedCounts.get(tabId) || 0) + 1);
      renderCountBadge(tabId);
    }
    return false;
  }

  if (message && message.type === "getCount") {
    const tabId = message.tabId;
    sendResponse({ count: (typeof tabId === "number" && blockedCounts.get(tabId)) || 0 });
    return false;
  }
});

chrome.tabs.onRemoved.addListener(function (tabId) {
  blockedCounts.delete(tabId);
});

// "Copy selection anyway" context menu: last-resort fallback that force-copies
// the current selection straight to the clipboard, bypassing all site JS.
chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.create({
    id: COPY_ANYWAY_MENU_ID,
    title: "Copy selection anyway",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId !== COPY_ANYWAY_MENU_ID || !tab || typeof tab.id !== "number") return;

  chrome.tabs.sendMessage(tab.id, { type: "copySelectionAnyway" }, function (response) {
    if (chrome.runtime.lastError) return;
    if (response && response.ok) {
      flashBadge(tab.id, "✓", "#4caf50");
    } else {
      flashBadge(tab.id, "!", "#f44336");
    }
  });
});

// Force Mode keyboard shortcut.
chrome.commands.onCommand.addListener(function (command) {
  if (command !== "toggle-force-mode") return;

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];
    if (!tab || typeof tab.id !== "number") return;

    const hostname = parseHostname(tab);
    if (!hostname) return;

    const forceKey = "force_" + hostname;
    chrome.storage.local.get([forceKey], function (result) {
      const nextForceMode = !result[forceKey];
      const write = nextForceMode
        ? chrome.storage.local.set({ [forceKey]: true })
        : chrome.storage.local.remove(forceKey);

      Promise.resolve(write).then(function () {
        flashBadge(tab.id, nextForceMode ? "ON" : "OFF", nextForceMode ? "#4caf50" : "#888");
        chrome.tabs.reload(tab.id);
      });
    });
  });
});
