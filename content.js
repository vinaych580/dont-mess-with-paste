(function () {
  "use strict";

  const BLOCKED_EVENTS = ["copy", "paste", "cut", "selectstart", "contextmenu", "dragstart"];
  const FORCED_EVENTS = ["keydown", "keyup", "keypress", "beforeinput", "mousedown"];

  let runtimeEnabled = false;
  let runtimeForceMode = false;

  function isClipboardShortcut(event) {
    if (event.ctrlKey || event.metaKey) {
      const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
      if (key === "c" || key === "v" || key === "x" || key === "insert") return true;
    }
    if (event.shiftKey) {
      const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
      if (key === "insert" || key === "delete") return true;
    }
    return false;
  }

  // Install force-mode event guards immediately at document_start so we win listener order.
  // The handler is inert until runtimeEnabled/runtimeForceMode are set by activate().
  const shouldGuardNow = function (event) {
    if (!runtimeEnabled || !runtimeForceMode) return false;

    if (BLOCKED_EVENTS.includes(event.type)) {
      return true;
    }

    if (
      event.type === "keydown" ||
      event.type === "keyup" ||
      event.type === "keypress"
    ) {
      return isClipboardShortcut(event);
    }

    if (event.type === "beforeinput") {
      const inputType = typeof event.inputType === "string" ? event.inputType : "";
      return inputType === "insertFromPaste" || inputType === "deleteByCut";
    }

    return false;
  };

  const earlyGuard = function (event) {
    if (!shouldGuardNow(event)) return;
    event.stopImmediatePropagation();
    event.stopPropagation();
  };

  for (const evt of BLOCKED_EVENTS.concat(FORCED_EVENTS)) {
    window.addEventListener(evt, earlyGuard, true);
  }

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (message && message.type === "getHostname") {
      sendResponse({ hostname: location.hostname });
    }
  });

  // Check if the extension is disabled for this site before doing anything.
  // If background messaging is unavailable, fall back to direct storage reads.
  const GLOBAL_DISABLED_KEY = "global_disabled";
  const hostname = location.hostname;
  let activated = false;

  function activateOnce(forceMode) {
    if (activated) return;
    activated = true;
    runtimeEnabled = true;
    runtimeForceMode = !!forceMode;
    activate(forceMode);
  }

  function loadStateFromStorage() {
    if (!hostname) return;

    const disabledKey = "disabled_" + hostname;
    const forceKey = "force_" + hostname;
    chrome.storage.local.get([GLOBAL_DISABLED_KEY, disabledKey, forceKey], function (result) {
      if (chrome.runtime.lastError || result[GLOBAL_DISABLED_KEY] || result[disabledKey]) return;
      activateOnce(!!result[forceKey]);
    });
  }

  // Read local storage immediately to reduce startup races against page scripts.
  loadStateFromStorage();

  chrome.runtime.sendMessage({ type: "checkEnabled", hostname: hostname }, function (response) {
    if (
      chrome.runtime.lastError ||
      !response ||
      typeof response.enabled !== "boolean"
    ) {
      return;
    }

    if (response.globalDisabled) return;
    if (!response.enabled) return;
    activateOnce(!!response.forceMode);
  });

  function activate(forceMode) {
    // 1. Inject CSS to re-enable text selection
    const style = document.createElement("style");
    style.textContent = `
      * { 
        user-select: text !important; 
        -webkit-user-select: text !important; 
        -moz-user-select: text !important;
        -ms-user-select: text !important;
      }
      input, textarea, [contenteditable] {
        user-select: auto !important;
        -webkit-user-select: auto !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);

    // 2. Remove inline event handler attributes from elements
    function cleanElement(el) {
      if (!el) return;
      const allToClean = BLOCKED_EVENTS.concat(["mousedown"]);
      for (const evt of allToClean) {
        const prop = "on" + evt;
        if (typeof el.removeAttribute === "function") {
          el.removeAttribute(prop);
        }
        try {
          if (el[prop] !== null) {
            // For mousedown, only clear if it's an attribute-based handler we just removed
            // or if it's explicitly set. But we'll be cautious.
            if (evt !== "mousedown" || el.hasAttribute(prop)) {
              el[prop] = null;
            }
          }
        } catch (_) {}
      }
    }

    function cleanAllElements(root = document) {
      cleanElement(window);
      cleanElement(document);
      
      const walker = document.createTreeWalker(
        root === document ? document.documentElement : root,
        NodeFilter.SHOW_ELEMENT,
        null,
        false
      );

      let node;
      if (root !== document && root.nodeType === Node.ELEMENT_NODE) {
        cleanElement(root);
      }
      
      while (node = walker.nextNode()) {
        cleanElement(node);
        if (node.shadowRoot) {
          cleanAllElements(node.shadowRoot);
        }
      }
    }

    // Run cleanup once DOM is ready, and again after full load
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => cleanAllElements(document));
    } else {
      cleanAllElements(document);
    }
    window.addEventListener("load", () => cleanAllElements(document));

    // Watch for dynamically added elements and attribute changes
    const observerOptions = { childList: true, subtree: true, attributes: true, attributeFilter: BLOCKED_EVENTS.map(e => "on" + e) };
    function observeRoot(root) {
      const observer = new MutationObserver(function (mutations) {
        for (const mutation of mutations) {
          if (mutation.type === "attributes") {
            cleanElement(mutation.target);
          } else {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                cleanElement(node);
                for (const child of node.querySelectorAll("*")) {
                  cleanElement(child);
                  if (child.shadowRoot) observeRoot(child.shadowRoot);
                }
                if (node.shadowRoot) observeRoot(node.shadowRoot);
              }
            }
          }
        }
      });
      observer.observe(root, observerOptions);
    }
    if (document.documentElement) {
      observeRoot(document.documentElement);
    }

    // 3. Force-mode listener guards are installed eagerly at document_start.

    // 4. Inject a page-level script to intercept addEventListener and property assignments
    const script = document.createElement("script");
    script.textContent = `(function() {
      var blockedEvents = ${JSON.stringify(BLOCKED_EVENTS)};
      var forceMode = ${forceMode ? "true" : "false"};
      var originalAddEventListener = EventTarget.prototype.addEventListener;
      var originalRemoveEventListener = EventTarget.prototype.removeEventListener;
      var originalAttachShadow = Element.prototype.attachShadow;
      var wrappedFunctionListeners = new WeakMap();
      var wrappedObjectListeners = new WeakMap();

      function shouldWrapType(type) {
        if (blockedEvents.includes(type)) return true;
        if (!forceMode) return false;
        return (
          type === "keydown" ||
          type === "keyup" ||
          type === "keypress" ||
          type === "beforeinput"
        );
      }

      function isClipboardShortcut(event) {
        if (event.ctrlKey || event.metaKey) {
          var key = typeof event.key === "string" ? event.key.toLowerCase() : "";
          if (key === "c" || key === "v" || key === "x" || key === "insert") return true;
        }
        if (event.shiftKey) {
          var key = typeof event.key === "string" ? event.key.toLowerCase() : "";
          if (key === "insert" || key === "delete") return true;
        }
        return false;
      }

      function shouldIgnorePreventDefault(event) {
        if (blockedEvents.includes(event.type)) {
           if (event.type === "mousedown" && event.button !== 2) return false;
           return true;
        }
        if (!forceMode) return false;

        if (
          event.type === "keydown" ||
          event.type === "keyup" ||
          event.type === "keypress"
        ) {
          return isClipboardShortcut(event);
        }

        if (event.type === "beforeinput") {
          var inputType = typeof event.inputType === "string" ? event.inputType : "";
          return inputType === "insertFromPaste" || inputType === "deleteByCut";
        }

        return false;
      }

      function getWrappedFunction(type, listener) {
        var byType = wrappedFunctionListeners.get(listener);
        if (!byType) {
          byType = new Map();
          wrappedFunctionListeners.set(listener, byType);
        }

        var wrapped = byType.get(type);
        if (wrapped) return wrapped;

        wrapped = function(event) {
          var origPreventDefault = event.preventDefault;
          if (shouldIgnorePreventDefault(event)) {
            event.preventDefault = function() {};
          }
          try {
            return listener.apply(this, arguments);
          } finally {
            event.preventDefault = origPreventDefault;
          }
        };
        byType.set(type, wrapped);
        return wrapped;
      }

      function getWrappedObject(type, listener) {
        var byType = wrappedObjectListeners.get(listener);
        if (!byType) {
          byType = new Map();
          wrappedObjectListeners.set(listener, byType);
        }

        var wrapped = byType.get(type);
        if (wrapped) return wrapped;

        wrapped = {
          handleEvent: function(event) {
            var origPreventDefault = event.preventDefault;
            if (shouldIgnorePreventDefault(event)) {
              event.preventDefault = function() {};
            }
            try {
              return listener.handleEvent.apply(listener, arguments);
            } finally {
              event.preventDefault = origPreventDefault;
            }
          }
        };
        byType.set(type, wrapped);
        return wrapped;
      }

      EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (shouldWrapType(type) && typeof listener === "function") {
          return originalAddEventListener.call(this, type, getWrappedFunction(type, listener), options);
        }

        if (shouldWrapType(type) && listener && typeof listener.handleEvent === "function") {
          return originalAddEventListener.call(this, type, getWrappedObject(type, listener), options);
        }

        return originalAddEventListener.call(this, type, listener, options);
      };

      EventTarget.prototype.removeEventListener = function(type, listener, options) {
        if (shouldWrapType(type) && typeof listener === "function") {
          var byTypeFn = wrappedFunctionListeners.get(listener);
          var wrappedFn = byTypeFn && byTypeFn.get(type);
          return originalRemoveEventListener.call(this, type, wrappedFn || listener, options);
        }

        if (shouldWrapType(type) && listener && typeof listener.handleEvent === "function") {
          var byTypeObj = wrappedObjectListeners.get(listener);
          var wrappedObj = byTypeObj && byTypeObj.get(type);
          return originalRemoveEventListener.call(this, type, wrappedObj || listener, options);
        }

        return originalRemoveEventListener.call(this, type, listener, options);
      };
      
      Element.prototype.attachShadow = function() {
        var shadow = originalAttachShadow.apply(this, arguments);
        // Ensure our cleanup logic can reach into newly created shadow roots
        // This is a bit tricky from the page context, but we rely on the 
        // MutationObserver in the content script to handle the elements themselves.
        return shadow;
      };

      var protectedEvents = blockedEvents.slice();
      if (forceMode) {
        protectedEvents.push("keydown", "keyup", "keypress", "beforeinput", "mousedown");
      }

      function neutralize(obj, events) {
        for (var i = 0; i < events.length; i++) {
          (function(eventName) {
            var prop = "on" + eventName;
            var privateProp = "__dmwp_" + prop;
            
            // We use a getter/setter to intercept assignments like element.oncopy = function...
            Object.defineProperty(obj, prop, {
              get: function() {
                return this[privateProp] || null;
              },
              set: function(fn) {
                if (typeof fn === "function") {
                  // Wrap the site's function so it can't call preventDefault()
                  this[privateProp] = getWrappedFunction(eventName, fn);
                } else {
                  this[privateProp] = null;
                }
              },
              configurable: true
            });
          })(events[i]);
        }
      }

      neutralize(document, protectedEvents);
      neutralize(window, protectedEvents);
      neutralize(HTMLElement.prototype, blockedEvents);
    })();`;
    (document.head || document.documentElement).appendChild(script);
    script.remove();

  }
})();
