# Upload Guide (Chrome + Firefox)

## Build Upload ZIPs
Run:

```powershell
.\pack-extension.ps1
```

This creates:
- `dist/dont-mess-with-paste-chrome-<version>.zip`
- `dist/dont-mess-with-paste-firefox-<version>.zip`

The Chrome ZIP strips `browser_specific_settings`; the Firefox ZIP keeps it for
the Gecko id and the AMO data-collection disclosure (`none`).

## Pre-Upload Checklist
1. Run `test/vpl-harness.html` (see README): all PASS.
2. Load the unpacked extension and, on a VPL restricted editor, check that
   Ctrl+V and right-click paste insert text exactly as copied, and that copy
   from the editor still gives the full selection.
3. Upload the correct ZIP per store.
