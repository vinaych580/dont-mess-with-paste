# Don't Mess With Paste

Makes paste work in Moodle VPL's code editor when "restricted editor" is on,
in Chrome and Firefox. Text is pasted exactly as copied, and copy is left alone.

## Download

| Browser | Download |
|---------|----------|
| Chrome  | [dont-mess-with-paste-chrome-2.0.0.zip](https://github.com/vinaych580/dont-mess-with-paste/raw/master/dist/dont-mess-with-paste-chrome-2.0.0.zip) |
| Firefox | [dont-mess-with-paste-firefox-2.0.0.zip](https://github.com/vinaych580/dont-mess-with-paste/raw/master/dist/dont-mess-with-paste-firefox-2.0.0.zip) |

### Install in Chrome
1. Unzip the Chrome download into a folder you'll keep.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the unzipped folder.
4. Reload any VPL page that was already open.

### Install in Firefox (140 or later)
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and choose the Firefox zip (or the
   `manifest.json` inside it once unzipped).
3. Reload any VPL page that was already open.

Firefox removes temporary add-ons when it restarts, so repeat these steps after
a restart until the add-on is signed on addons.mozilla.org.

## How it works

VPL replaces the Ace editor's paste with one that discards the real clipboard.
`paste-fix.js` catches the paste first and runs Ace's own paste command with
the real clipboard text. See
[the design spec](docs/superpowers/specs/2026-09-23-vpl-paste-fix-design.md).

No build step: the files are plain JavaScript.

## Development

Load the project folder itself as an unpacked extension (Chrome) or its
`manifest.json` as a temporary add-on (Firefox).

Package with `.\pack-extension.ps1`, which writes
`dist/dont-mess-with-paste-{chrome,firefox}-<version>.zip`. Delete the previous
version's zips and update the download links above when the version changes.

Test by serving the project root (`python -m http.server 8765`) and opening
`http://localhost:8765/test/vpl-harness.html`, and `?fix=0` for the unfixed
control. Every line should read PASS.
