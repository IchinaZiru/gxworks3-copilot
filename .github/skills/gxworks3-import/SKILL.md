---
name: gxworks3-import
description: Convert CC-Link IE TSN Structure Check Tool flowchart JSON into GX Works3 station-list CSV, then guide local Copilot Computer Use to import and verify it in GX Works3 on Windows. Use for requests to apply flowchart.json to MXR300-16 GX Works3, automate station-list import, or validate conversion results. Never modify the existing structure checker or program/write PLC hardware.
---
# GX Works3 station-list import from checker JSON

## Preconditions
- Run in VS Code using the **local Copilot harness** with Computer Use enabled for GUI actions. This skill itself does not grant computer access.
- Work on a COPY of the GX Works3 project. Do not operate connected PLC hardware or use Online Write/Read functions.
- Review external application permissions; get confirmation before importing, overwriting a configuration, or saving the project.
- Keep company data out of public repositories and unapproved services. Use the sample JSON for initial tests.

## Required conversion tool
The converter is bundled here and runs on Node.js (no npm installation).

```powershell
node .github/skills/gxworks3-import/scripts/convert.js --json input/flowchart.json --out output/station_list.csv
```

The command above produces a **sparse** UTF-16LE BOM, tab-delimited station-list file with 39 columns; unmapped fields are blank. Blank fields may be reset by GX Works3 upon import.

Preferred when preserving existing GX settings:

```powershell
node .github/skills/gxworks3-import/scripts/convert.js --json input/flowchart.json --template input/gx_template.csv --out output/station_list.csv
```

The overlay mode replaces only fields represented in the native checker JSON; other existing GX CSV cells stay as-is. This is still a full station-list import, not an atomic partial update. Never overwrite the source template.

If a converted file already exists, use a new output path (recommended) or an explicit `--force` after reviewing what will be overwritten.

## Workflow
1. Read and validate `input/flowchart.json` before any GUI operation. Record station numbers, model names, station types, Class, `RX`, `RWr`, and `cycleSetting`. Reject duplicate station numbers.
2. Run the bundled converter in the VS Code terminal. Confirm exit code 0, 39 columns, UTF-16LE BOM, and review any warnings/changed fields.
3. Read [GUI workflow](references/gui-workflow.md) before interacting with GX Works3.
4. Use Computer Use to locate the user's **copied/offline** GX Works3 project and open the CC-Link IE TSN network configuration editor.
5. Ask the user to approve importing `output/station_list.csv`. Use station-list import, not generic project import, and do not operate online/PLC write commands.
6. Inspect the GUI after import. Verify station count/models/numbers, class, RX and RWr allocations, and per-station cycle (`BASIC` -> basic, `MID` -> medium, `LOW` -> low), especially station 1.
7. Report any GX import warning, ignored values, or automatic defaults separately from successful fields. Save only with user permission.

## Mapping and limits
Read [mapping notes](references/mapping.md). Key conversion behavior comes from the tested v0.4 converter, not a model's guess. `gxWorks3` custom metadata is deliberately ignored in native checker mode.
- Node `modelName`, `stationNumber`, `stationType`, `deviceClass`, `cycleSetting`, `RX`, `RWr`, and other explicitly mapped fields become station-list CSV values.
- `RX` is bytes to bit points (x8). `RWr` is bytes to word points (/2). Validate the data if changed.
- `speed`, raw basic-cycle duration in microseconds, firmware, port capacity, physical connectivity (`edges`), and device capability flags are NOT fields in the observed 39-column station-list CSV.
- Do not invent topology from JSON station numbers; CSV does not encode physical cables. Distinguish capability data from configurable parameters.
- A GX unit-parameter screen may contain fields the station-list CSV does not. Do not claim that every GX setting has been imported from this CSV.
- If GX screens differ by version, identify visible controls dynamically; never blindly click remembered coordinates.

## Stopping conditions
Stop and ask for help if: GX Works3 requests hardware write; the selected CPU/network differs from the sample; import affects real connected equipment; a warning indicates unsupported/invalid configuration; target station is missing; or expected GUI controls cannot be identified.
