# VPL paste fix — design

## Goal

Make paste work in Moodle VPL's code editor when the teacher has turned on
"restricted editor", for Chrome and Firefox. Two hard rules, from the ways
other extensions failed:

- Copy must keep working (Don't F\*\*k With Paste breaks it).
- Pasted text must arrive exactly as copied: no added spaces or re-indentation
  (Blend and Run adds them).

## How VPL blocks paste

Observed in the site's VPL bundle (Ace 1.4.12, `restrictededitor: true`):

```js
var prevOnPaste = editor.onPaste;
editor.onPaste = function (s) {
  fileManager.restrictedEdit ? editor.insert(fileManager.getClipboard())
                             : prevOnPaste.call(editor, s);
};
editor.on("copy", function (t) { fileManager.setClipboard(t.text); });
$(tid).on("paste", "*", fileManager.restrictedPaste); // return false
```

The real clipboard is discarded and replaced with whatever was last copied
inside the editor. Drag-and-drop is also cancelled. Copy and cut are not
blocked; Ace implements copy itself by writing `clipboardData` from its own
model. Its hidden textarea holds only the current line, which is why an
extension that swallows copy events ends up copying a single line.

## Design

One content script, `paste-fix.js`, declared in `manifest.json` with
`world: "MAIN"` (the Ace editor object lives on the page's
`.ace_editor` element as `env.editor`, invisible to an isolated-world script),
`run_at: document_start`, matching `*://*/mod/vpl/*`.

It registers a capture-phase `paste` listener on `window`, which runs before
Ace's textarea listener and VPL's handler. When the paste target is inside an
`.ace_editor` whose editor is not read-only and the clipboard has plain text,
it cancels the event and runs `editor.execCommand("paste", { text, event })`.
That is the command a normal Ace paste runs, so the result is identical to an
unrestricted paste. Anything else (pastes outside Ace, read-only files, empty
clipboard) is left alone.

Not touched: copy, cut, selection, drag-and-drop, any other page.

No popup, options page, background script or permissions beyond the content
script match. Firefox needs `browser_specific_settings.gecko` (id, min version
140 for `data_collection_permissions`); the Chrome package strips it.

## Testing

`test/vpl-harness.html` loads Ace 1.4.12 (Java mode, autocompletion, as VPL
does) and a verbatim replica of VPL's blocking code, with and without
`paste-fix.js`. In-page checks:

1. Without the fix, pasting inserts the local clipboard, not the real one
   (proves the harness reproduces the block).
2. Multi-line, tab- and space-indented Java with CRLF endings pastes
   character-for-character identical (line endings normalised).
3. Pasting into the middle of an indented block inserts only the pasted text.
4. Copying a multi-line selection puts the whole selection on the clipboard.
5. Pasting into a read-only editor changes nothing.
6. Pasting into a normal input outside Ace is not intercepted.

Final check by the user on the real site in both browsers.
