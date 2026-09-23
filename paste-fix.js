// Makes paste work in Moodle VPL's restricted code editor.
//
// VPL blocks paste by replacing each Ace editor's onPaste with one that throws
// the clipboard away and inserts only text previously copied inside the
// editor. We catch the paste on window in the capture phase, before Ace's
// textarea listener and VPL's handler see it, and hand the real clipboard text
// to Ace's own "paste" command -- the same path an unrestricted paste takes,
// so the text lands exactly as copied.
//
// Copy and cut are deliberately left alone: VPL never blocks them, and Ace
// implements copy itself. Interfering there is what breaks copy.
(function () {
  "use strict";

  function aceEditorFor(target) {
    var el = target && target.nodeType === 1 ? target : target && target.parentElement;
    var container = el && el.closest(".ace_editor");
    return container && container.env && container.env.editor;
  }

  window.addEventListener("paste", function (event) {
    var editor = aceEditorFor(event.target);
    if (!editor || editor.getReadOnly()) return;

    var text = event.clipboardData && event.clipboardData.getData("text/plain");
    if (!text) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    editor.execCommand("paste", { text: text, event: event });
  }, true);
})();
