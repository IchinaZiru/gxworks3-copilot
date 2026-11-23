# Stage B: Windows CSV file-dialog automation

## 0. Prerequisites
- Keep the current working `gxworks3-import` skill as-is. The user has patched its converter to preserve empty LB/LW point cells and set both communication-period columns; **do not replace it from an older ZIP**.
- `tools/gx-file-dialog.exe` must exist in the workspace. AutoHotkey does not need to be installed on the machine running the helper.
- AutoHotkey v2 64-bit and Ahk2Exe are needed only to rebuild the EXE from `scripts/file_dialog.ahk`.
- VS Code is open at workspace `gxworks3-copilot`, Node.js is working, GX Works3 is open with the offline copied project, and Computer Use is enabled.
- This new skill is placed in `.github/skills/gxworks3-file-dialog/`.
- The helper only works in a **single** visible GX Works3 process with a Japanese standard file picker caption `インポート` or `エクスポート`, class `#32770`, running in the same process as GX Works3.

## 1. Static path check (does not start GUI automation)
Run from the workspace root:

```powershell
node .github/skills/gxworks3-file-dialog/scripts/watch_dialog.js export output/ahk_first_test.csv fill --dry-run
```

Expected: `DRY-RUN: Path validation succeeded` and the absolute path to `tools/gx-file-dialog.exe`. This validates the CSV path and executable target but starts no process and performs no GUI action. The output path must not exist yet, except in `probe` mode.

The Node.js launcher starts the compiled EXE in the background. Its positional arguments remain `mode`, absolute CSV path, action, status-file path, and wait seconds, matching `file_dialog.ahk`'s `A_Args` contract. The launcher never falls back to `AutoHotkey64.exe` or runs the `.ahk` source.

## 2. Probe the export dialog without touching it
Run this **before** opening the GX Works3 dialog (or while it is already visible):

```powershell
node .github/skills/gxworks3-file-dialog/scripts/watch_dialog.js export output/ahk_first_test.csv probe
```

Within 75 seconds, in GX Works3 select `CC-Link IE TSN構成` > `インポート/エクスポート` > `局一覧をエクスポート`. Wait for that Computer Use action to finish, then check the status file path printed in the terminal. `STATUS=PROBED` means correct window detected and no picker control was touched. Leave the dialog open for the fill test.

## 3. Fill the export filename field only
With the export picker still open and Computer Use no longer acting on it, start a new compiled-helper watcher:

```powershell
node .github/skills/gxworks3-file-dialog/scripts/watch_dialog.js export output/ahk_first_test.csv fill
```

The helper focuses and sets the filename field in the already-open picker. Do not use Computer Use until the watcher exits. Expect `STATUS=FILLED` in the status file and no `ahk_first_test.csv` created. Then verify the field visually and cancel manually.

If it says `ERROR`, report the exact `DETAILS=` text. Do not blindly remove control checks or disable PID/title guards to get past a failure.

## 4. Export CSV automatically (only after steps 2–3 work)
Reopen the export picker with Computer Use and wait for that action to finish. Then pick a new export destination not already on disk. Example:

```powershell
node .github/skills/gxworks3-file-dialog/scripts/watch_dialog.js export output/ahk_export_test_01.csv submit
```

Do not use Computer Use on the picker while the compiled helper is running. The helper should set and verify the filename, then press Enter. Confirm `STATUS=SAVED` and that `output/ahk_export_test_01.csv` exists. Independently check the CSV's UTF-16LE BOM, 39 headers and station rows before trusting it.

## 5. Import automatically (test project only)
First confirm the generated CSV is from the currently selected baseline template; approval is required prior to pressing Open. Open the GX Works3 `局一覧をインポート` picker with Computer Use, wait for that action to finish, and then start the watcher:

```powershell
node .github/skills/gxworks3-file-dialog/scripts/watch_dialog.js import output/station_list_overlay_export_mid_dual_period_20261121_1912.csv submit
```

Do not use Computer Use on the picker while the compiled helper is running. Expected status `STATUS=FILE_SELECTED`; then check GX Works3's import completion message and warnings. Closing the picker **does not** prove successful configuration import. Export the resulting station list, compare with the baseline. Apply and save the copied test project only with separate permission. Never write to PLC hardware.

## 6. Interpreting status
- `STARTED`: launcher created the helper; its mode, path, expected title, and `HELPER_EXE` are recorded.
- `WAITING`: the compiled helper is resolving GX Works3 or waiting for the matching dialog.
- `PROBED`: only window identification succeeded, no click.
- `FILLED`: path was sent to the filename field. Check the UI before submitting.
- `SAVED`: export file exists after picker closed.
- `FILE_SELECTED`: import picker closed; still need GX validation.
- `ERROR`: no further action; inspect `DETAILS=`.

Each run creates a unique text status file in `output/` and prints its exact path. You may inspect it in VS Code without Computer Use. If `STARTED` or `WAITING` remains after the 75-second limit, preserve the file and stop instead of launching a second watcher.

## 7. Troubleshooting
- `Compiled file-dialog helper EXE not found`: build or copy `tools/gx-file-dialog.exe` into the workspace. The launcher intentionally does not fall back to an AutoHotkey runtime or execute `file_dialog.ahk`.
- `Expected exactly one running GX Works3 process`: start GX Works3, keep one instance, and retry with `probe`.
- `Timed out waiting for dialog`: inspect `DETAILS=` and `DIAGNOSTICS=` for the expected title, matched GX PID, and same-process dialog candidates. Do not disable guards or repeat the Computer Use menu action without resolving the visible state.
- Filename focus errors include window/control diagnostics in the status file. Use those details to identify the actual picker controls; do not use blind coordinates or relax the PID/title/class checks.
- `ControlSetText` is verified by reading the field back. If it fails, do not submit and do not retry while the dialog state is uncertain.
- `Export target already exists`: choose a new name. Never overwrite the original template or verified results.
- `Dialog did not close`: inspect the dialog; do not launch a second `submit` without checking the state.
- If your local GX Works3 uses different dialog caption/UI, this helper will intentionally stop. Customize only after verifying that actual window.

## v1.0.1 bugfix (2026-11-22)
- Fixed AutoHotkey CSV suffix detection (previous version incorrectly used `SubStr(csvPath, -3)` and rejected valid `.csv` paths).
- `probe` still only detects the GX Works3 dialog; it does not type, click, import, or save.
- After replacing the helper, rerun `probe` and inspect the new `STATUS` file.

## v1.0.2 focus and handoff update (2026-11-22)
- File-name entry first focuses a uniquely identified `Edit` control and uses `ControlSetText` with read-back verification; `Alt+N` is a guarded fallback.
- `ControlGetFocus` returns a child HWND; the helper maps it to a known `Edit`/`ComboBox` ClassNN and ignores unresolved shell controls during focus selection.
- AHK errors include dialog and control diagnostics in the status file.
- `probe` hands off to Computer Use; `fill` and `submit` start only after Computer Use has finished opening the picker, avoiding concurrent control of the same dialog.
