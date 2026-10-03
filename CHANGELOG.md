# Changelog

## Unreleased
- Automated tests: the VPL harness now runs in Chromium and Firefox on every
  push, and the Firefox build is checked with `web-ext lint`.
- Added a license, a privacy section and an issue form for reporting pages
  where paste still doesn't work.

## 2.0.0 (2026-09-23)
- Rebuilt as a focused fix for Moodle VPL's restricted code editor. Paste goes
  through the Ace editor's own paste command, so text arrives exactly as
  copied, and copy is left untouched.
- Removed the popup, options page, background script, Force Mode and all
  permissions, including access to every site. It now runs only on VPL pages.
- Works in Chrome, other Chromium browsers and Firefox 140 or later.

## 1.3.0 (2026-08-25)
- Options page with per-site settings, popup with a block counter, on-page
  notices, a floating paste helper, an Alt+Shift+F Force Mode shortcut and a
  "Copy selection anyway" menu item.
- Fixed the Firefox build missing its options page, and added the
  data-collection disclosure that addons.mozilla.org requires.

## 1.1.0 and 1.2.0 (up to 2026-04-28)
- Early versions that force-enabled copy, paste, cut and text selection on
  every site.
