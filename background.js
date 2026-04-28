// Service worker for "Don't Mess With Paste"
// Handles global + per-site enable/disable and force-mode state.

const GLOBAL_DISABLED_KEY = "global_disabled";

chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
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
});
