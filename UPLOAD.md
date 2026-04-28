# Upload Guide (Chrome + Firefox)

## Build Upload ZIPs
Run:

```powershell
.\pack-extension.ps1
```

This creates:
- `dist/dont-mess-with-paste-chrome-<version>.zip`
- `dist/dont-mess-with-paste-firefox-<version>.zip`

Packaging behavior:
- Chrome ZIP strips `browser_specific_settings` and keeps MV3 `background.service_worker`.
- Firefox ZIP switches to `background.scripts` and includes Gecko data consent metadata.

## Why This Is Store-Friendly
- Uses static content scripts with explicit `<all_urls>` host access.
- Keeps permissions minimal: `activeTab`, `storage`.
- Handles restricted/internal pages gracefully in popup UI.
- `Force copy/paste/cut` is opt-in and scoped per-site.

## Pre-Upload Checklist
1. Load unpacked extension and test normal mode on a site that blocks paste.
2. Test `Force copy/paste/cut` only on stubborn sites.
3. Open popup on browser-internal pages (`chrome://` / `about:`) and confirm it shows unavailable state without errors.
4. Upload the correct ZIP per store.
