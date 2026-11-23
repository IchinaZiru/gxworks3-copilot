---
name: gxworks3-file-dialog
description: Automate the Windows CSV Open/Save file picker shown by Mitsubishi Electric GX Works3 CC-Link IE TSN station-list import/export using AutoHotkey v2. Use when GitHub Copilot Computer Use times out on the GX Works3 "インポート" or "エクスポート" dialog, or when integrating flowchart JSON to CSV to GX Works3 import/verification. Coordinate with the existing gxworks3-import skill without editing the converter or writing to live PLC hardware.
---
# GX Works3 CSV dialog automation (Windows, AutoHotkey v2)

## Scope and safe defaults
- Use this skill **in addition to** the existing `gxworks3-import` skill. Never overwrite its locally tested `patch_core.js`, `convert.js`, `mapping.md`, JSON, template CSV, or GX Works3 projects.
- Automate only the native Windows **CSV** file dialog titled `インポート` or `エクスポート` opened by GX Works3. Do not treat this helper as proof that GX Works3 accepted any setting.
- Do not automate PLC write, online operation, GX project overwrite, or application settings outside the CSV picker. Keep GX Works3 offline and work with an independent test project.
- Ask for approval before `submit` on an import. Begin with `probe` and `fill` before using `submit`.

## Required tools
- Windows 10/11, Node.js, and the compiled helper `tools/gx-file-dialog.exe`.
- AutoHotkey v2 and Ahk2Exe are required only to rebuild the helper; they are not required on machines that run the EXE.
- Run VS Code terminal in the `gxworks3-copilot` workspace root. Start GX Works3 first and open exactly one GX Works3 instance.
- See [Windows workflow](references/windows-workflow.md) before starting.

## Three actions
The Node.js launcher starts `tools/gx-file-dialog.exe` **in the background**. It passes the same five arguments expected by `file_dialog.ahk`: mode, absolute CSV path, action, status-file path, and wait seconds. No AutoHotkey runtime fallback is attempted; a missing EXE produces an explicit error. `probe` is read-only and can run while Computer Use opens the picker. `fill` and `submit` control the picker, so start them only after Computer Use has finished opening it. This handoff prevents both tools from activating or typing into the same dialog at once. Each watcher stops after its first action or after 75 seconds.

1. `probe`: Only detect that the correct GX Works3 dialog exists; **no interaction**.
2. `fill`: Focus `ファイル名(N)` using the identified dialog's controls and enter the CSV path, **do not click Open/Save**.
3. `submit`: Set and verify the CSV path, then press Enter **once**. Check the result afterward; for import, the picker closing means *file selected*, not *configuration verified*.

Examples from workspace root:

```powershell
node .github/skills/gxworks3-file-dialog/scripts/watch_dialog.js export output/ahk_export_probe.csv probe
node .github/skills/gxworks3-file-dialog/scripts/watch_dialog.js export output/ahk_export_fill_test.csv fill
node .github/skills/gxworks3-file-dialog/scripts/watch_dialog.js export output/ahk_export_submit_01.csv submit
node .github/skills/gxworks3-file-dialog/scripts/watch_dialog.js import output/station_list_overlay_export_mid_dual_period_20261121_1912.csv fill
```

The final `import` example is for a **baseline test project only**, after confirming the input CSV and approving the operation. It does not import or save the GX Works3 project automatically.

## Required orchestration
1. Identify an offline backup project and distinguish initial and modified CSV files. Confirm the desired station-list file with the user.
2. Start `watch_dialog.js` with `probe`. Use Computer Use to open GX Works3's station-list `局一覧をエクスポート` picker (or ask the user to open it). Wait for the Computer Use action to finish, then check the new `output/gx_dialog_*.status.txt`; `STATUS=PROBED` confirms detection without dialog interaction.
3. With the export picker still open and Computer Use no longer acting on it, start `fill` with a **new, nonexisting** output path. Wait for `STATUS=FILLED`, verify the filename field, then cancel manually after the watcher exits; nothing should be saved.
4. Reopen the export picker with Computer Use and wait for that action to finish. Only then start `submit` with a different, nonexisting output path. Do not use Computer Use on the picker while the compiled helper is running. Verify `STATUS=SAVED`, the output file exists, and its 39-column/5-station contents parse.
5. Test `import submit` only after explicit approval and baseline protection, verify GUI warning/error messages, then re-export and diff all 39 columns to the template. If any unexpected warning or value change occurs, stop.
6. Update the coordinating skill instructions after success. Keep CLI references stable and specific to the `output` directory.

## Guardrails
- Do not retry a timed-out Computer Use command without inspecting the visible GX Works3 state; a GUI action may have completed even when the tool reports timeout.
- The helper filters dialogs by exact Japanese caption, `#32770` class, and GX Works3 process PID. If no such window appears, it **stops** rather than clicks another application.
- Import source must exist; export destination must **not** exist. CSV path must remain inside workspace `output/`.
- `probe` is the only action allowed to overlap with Computer Use opening the picker. For `fill` and `submit`, let Computer Use finish opening the dialog before starting the compiled helper, then let it finish before using Computer Use again.
- On a Computer Use timeout, inspect the visible state and watcher status before proceeding. Never repeat the menu action blindly; request manual opening if the dialog state is uncertain.
- On `ERROR`, inspect `DETAILS=` and `DIAGNOSTICS=`. The helper records the matched window identity, active/focused state, controls, and same-process dialog candidates. `ControlGetFocus` returns a child HWND, so the helper maps it to an `Edit`/`ComboBox` ClassNN; unsupported shell controls are not used as filename controls. Do not disable PID/title/class checks or guess a control.
- If status remains `STARTED` or `WAITING` beyond the 75-second limit, treat the helper as unresponsive, preserve the status file, and stop; do not launch another watcher.
- If input is already submitted or the project is in an uncertain state, do not repeat. Get human confirmation and compare exports.
- Project `設定を反映して閉じる`, `適用(A)`, and `名前を付けて保存` remain a separate workflow; do not claim they are automated by this CSV helper.
- This is a Windows-only helper. Static checks do not replace verification in the actual GX Works3 file picker.

## Compiled helper
- The runtime target is `tools/gx-file-dialog.exe`, compiled from `scripts/file_dialog.ahk` for AutoHotkey v2 64-bit.
- To rebuild it, use the official Ahk2Exe compiler with the AutoHotkey v2 64-bit base runtime. Rebuilding does not change the launcher's argument contract.
- `--dry-run` validates the CSV path and reports the compiled EXE path without starting a process or performing a GUI action.
