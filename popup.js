(function () {
  const GLOBAL_DISABLED_KEY = "global_disabled";

  const globalToggle = document.getElementById("globalToggle");
  const toggle = document.getElementById("toggle");
  const forceToggle = document.getElementById("forceToggle");
  const dot = document.getElementById("statusDot");
  const text = document.getElementById("statusText");
  const blockedCount = document.getElementById("blockedCount");
  const manageSitesLink = document.getElementById("manageSitesLink");

  let tabId = null;
  let initialized = false;
  let globalEnabled = true;
  let siteAvailable = false;
  let siteEnabled = false;
  let siteForceMode = false;
  let unavailableMessage = "Unavailable on this page";
  let disabledKey = "";
  let forceKey = "";

  function updateUI() {
    globalToggle.checked = globalEnabled;
    globalToggle.disabled = false;

    if (!globalEnabled) {
      dot.classList.add("off");
      text.textContent = "Stopped on all sites";
      toggle.disabled = true;
      forceToggle.disabled = true;
      return;
    }

    if (!siteAvailable) {
      toggle.checked = false;
      toggle.disabled = true;
      forceToggle.checked = false;
      forceToggle.disabled = true;
      dot.classList.add("off");
      text.textContent = unavailableMessage;
      return;
    }

    toggle.checked = siteEnabled;
    toggle.disabled = false;
    forceToggle.checked = siteForceMode;
    forceToggle.disabled = !siteEnabled;
    dot.classList.toggle("off", !siteEnabled);
    text.textContent = siteEnabled ? "Active on this site" : "Disabled on this site";
  }

  function setUnavailable(message) {
    siteAvailable = false;
    unavailableMessage = message;
    updateUI();
  }

  function reloadActiveTab() {
    if (tabId == null) return;
    chrome.tabs.reload(tabId);
  }

  function loadBlockedCount() {
    if (tabId == null) {
      blockedCount.textContent = "";
      return;
    }
    chrome.runtime.sendMessage({ type: "getCount", tabId: tabId }, function (response) {
      if (chrome.runtime.lastError || !response) return;
      blockedCount.textContent = response.count > 0
        ? "Blocked " + response.count + " attempt" + (response.count === 1 ? "" : "s") + " on this page"
        : "No blocking attempts seen on this page";
    });
  }

  manageSitesLink.addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
  });

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

  function initForHostname(hostname) {
    if (initialized) return;
    initialized = true;
    siteAvailable = true;

    disabledKey = "disabled_" + hostname;
    forceKey = "force_" + hostname;

    chrome.storage.local.get([disabledKey, forceKey], function (result) {
      if (chrome.runtime.lastError) {
        setUnavailable("Storage not available on this page");
        return;
      }

      siteEnabled = !result[disabledKey];
      siteForceMode = !!result[forceKey];
      updateUI();
    });
  }

  globalToggle.addEventListener("change", function () {
    globalEnabled = globalToggle.checked;
    if (globalEnabled) {
      chrome.storage.local.remove(GLOBAL_DISABLED_KEY);
    } else {
      chrome.storage.local.set({ [GLOBAL_DISABLED_KEY]: true });
    }
    updateUI();
    reloadActiveTab();
  });

  toggle.addEventListener("change", function () {
    if (!siteAvailable || !disabledKey) return;

    siteEnabled = toggle.checked;
    if (siteEnabled) {
      chrome.storage.local.remove(disabledKey);
    } else {
      chrome.storage.local.set({ [disabledKey]: true });
    }
    updateUI();
    reloadActiveTab();
  });

  forceToggle.addEventListener("change", function () {
    if (!siteAvailable || !forceKey || forceToggle.disabled) return;

    siteForceMode = forceToggle.checked;
    if (siteForceMode) {
      chrome.storage.local.set({ [forceKey]: true });
    } else {
      chrome.storage.local.remove(forceKey);
    }
    updateUI();
    reloadActiveTab();
  });

  chrome.storage.local.get([GLOBAL_DISABLED_KEY], function (result) {
    if (!chrome.runtime.lastError) {
      globalEnabled = !result[GLOBAL_DISABLED_KEY];
      updateUI();
    }

    // Get current tab hostname, with fallback via content script for Firefox/permission-limited tabs.
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (chrome.runtime.lastError || !tabs[0]) {
        setUnavailable("Unable to access this tab");
        return;
      }

      tabId = tabs[0].id;
      loadBlockedCount();
      const directHostname = parseHostname(tabs[0]);
      if (directHostname) {
        initForHostname(directHostname);
        return;
      }

      if (tabId == null) {
        setUnavailable("Unavailable on this page");
        return;
      }

      chrome.tabs.sendMessage(tabId, { type: "getHostname" }, function (response) {
        if (chrome.runtime.lastError || !response || !response.hostname) {
          setUnavailable("Unavailable on browser/internal pages");
          return;
        }

        initForHostname(response.hostname);
      });
    });
  });
})();
