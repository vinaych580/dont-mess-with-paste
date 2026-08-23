(function () {
  const GLOBAL_DISABLED_KEY = "global_disabled";
  const DISABLED_PREFIX = "disabled_";
  const FORCE_PREFIX = "force_";

  const globalToggle = document.getElementById("globalToggle");
  const sitesBody = document.getElementById("sitesBody");
  const sitesTable = document.getElementById("sitesTable");
  const emptyState = document.getElementById("emptyState");
  const clearAllBtn = document.getElementById("clearAllBtn");

  function hostnamesFromStorage(items) {
    const hosts = new Set();
    for (const key of Object.keys(items)) {
      if (key.startsWith(DISABLED_PREFIX)) hosts.add(key.slice(DISABLED_PREFIX.length));
      if (key.startsWith(FORCE_PREFIX)) hosts.add(key.slice(FORCE_PREFIX.length));
    }
    return Array.from(hosts).sort();
  }

  function render() {
    chrome.storage.local.get(null, function (items) {
      if (chrome.runtime.lastError) return;

      globalToggle.checked = !items[GLOBAL_DISABLED_KEY];

      const hosts = hostnamesFromStorage(items);
      sitesBody.innerHTML = "";
      sitesTable.hidden = hosts.length === 0;
      emptyState.hidden = hosts.length !== 0;

      for (const host of hosts) {
        const disabledKey = DISABLED_PREFIX + host;
        const forceKey = FORCE_PREFIX + host;
        const enabled = !items[disabledKey];
        const forceMode = !!items[forceKey];

        const row = document.createElement("tr");

        const hostCell = document.createElement("td");
        hostCell.className = "host";
        hostCell.textContent = host;
        row.appendChild(hostCell);

        const enabledCell = document.createElement("td");
        const enabledInput = document.createElement("input");
        enabledInput.type = "checkbox";
        enabledInput.checked = enabled;
        enabledInput.addEventListener("change", function () {
          if (enabledInput.checked) {
            chrome.storage.local.remove(disabledKey);
          } else {
            chrome.storage.local.set({ [disabledKey]: true });
          }
        });
        enabledCell.appendChild(enabledInput);
        row.appendChild(enabledCell);

        const forceCell = document.createElement("td");
        const forceInput = document.createElement("input");
        forceInput.type = "checkbox";
        forceInput.checked = forceMode;
        forceInput.disabled = !enabled;
        forceInput.addEventListener("change", function () {
          if (forceInput.checked) {
            chrome.storage.local.set({ [forceKey]: true });
          } else {
            chrome.storage.local.remove(forceKey);
          }
        });
        forceCell.appendChild(forceInput);
        row.appendChild(forceCell);

        const actionsCell = document.createElement("td");
        actionsCell.className = "actions";
        const removeBtn = document.createElement("button");
        removeBtn.className = "remove-btn";
        removeBtn.type = "button";
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", function () {
          chrome.storage.local.remove([disabledKey, forceKey]);
        });
        actionsCell.appendChild(removeBtn);
        row.appendChild(actionsCell);

        sitesBody.appendChild(row);
      }
    });
  }

  globalToggle.addEventListener("change", function () {
    if (globalToggle.checked) {
      chrome.storage.local.remove(GLOBAL_DISABLED_KEY);
    } else {
      chrome.storage.local.set({ [GLOBAL_DISABLED_KEY]: true });
    }
  });

  clearAllBtn.addEventListener("click", function () {
    chrome.storage.local.get(null, function (items) {
      if (chrome.runtime.lastError) return;
      const toRemove = Object.keys(items).filter(
        (key) => key.startsWith(DISABLED_PREFIX) || key.startsWith(FORCE_PREFIX)
      );
      if (toRemove.length) chrome.storage.local.remove(toRemove);
    });
  });

  chrome.storage.onChanged.addListener(function (_changes, areaName) {
    if (areaName === "local") render();
  });

  render();
})();
