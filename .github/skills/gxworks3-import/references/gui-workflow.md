# GUI workflow for GX Works3 (validated with MXR300-16 screenshots)

## Navigate to station list
1. Keep a copy of the GX Works3 `.gx3` project open (not a new project unless the user explicitly asks).
2. Find the navigation tree: Parameters > MXR300-16 > Unit Parameters (Port 1/2: CC-Link IE TSN).
3. Within Basic Settings open Network Configuration Settings (CC-Link IE TSN configuration).
4. Double-click the blue Details/Configuration control. This opens the CC-Link IE TSN Configuration window showing stations.
5. At top menu, open CC-Link IE TSN Configuration > Import/Export > Import Station List.
6. Select the generated `output/station_list.csv` path, inspect any prompts, and obtain user permission before confirming replacement.
7. After the import popup, scroll horizontally to the right to view cycle setting, device Class, station/IP fields. For selected sample, station 1 should be MID/medium speed if JSON says MID; other sample stations should be BASIC.
8. Review any warnings in the bottom Output panel; unknown sparse fields can be reset by GX Works3.
9. Click Apply/Close and Save only after the user has reviewed the results.

## Rules
- The UI is Japanese on the tested machine; names above are functional translations, not guaranteed literal English UI strings.
- Do not rely on absolute pixel coordinates or screen resolution.
- The local Copilot harness must be enabled for Computer Use; the skill cannot open desktop apps alone.
- The station-list menu is within the network configuration editor, NOT the unit-parameter screen's main menu.
- Do not use Online > Write to PLC or modify a running controller.
