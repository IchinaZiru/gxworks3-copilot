# GX Works3 Copilot Computer Use starter (Windows / VS Code)

This is a standalone local starter workspace for the tested CC-Link IE TSN Structure Check Tool JSON -> GX Works3 station-list CSV workflow. It does not alter the original checker, GX Works3, or the PLC hardware.

## 1. Set up VS Code Copilot Computer Use

1. Install or update VS Code (Windows), then sign in to GitHub Copilot.
2. In Settings, enable `chat.agentHost.computerUse.enabled`. Restart VS Code.
3. Open this folder in VS Code; start a new **local Copilot harness** chat.
4. Run `/computer on` in chat and follow permission prompts.
5. First try a READ-ONLY desktop observation of GX Works3 before asking to import anything.

Official docs:
https://code.visualstudio.com/docs/setup/copilot
https://code.visualstudio.com/docs/agents/run/tools
https://code.visualstudio.com/docs/agent-customization/agent-skills

## 2. Test the converter separately

Install Node.js LTS if `node --version` does not work. The converter has no npm dependencies.

From a PowerShell terminal at this workspace root:

```powershell
node .github/skills/gxworks3-import/scripts/convert.js --json input/flowchart.json --out output/station_list.csv
```

The sample in `input/flowchart.json` uses documentation/synthetic IP addresses. It is NOT your actual GX configuration.

For overlay mode (recommended for preserving existing GX fields):

```powershell
node .github/skills/gxworks3-import/scripts/convert.js --json input/flowchart.json --template input/gx_template.csv --out output/station_list_overlay.csv
```

This sample GX template also uses synthetic addresses. For actual work, replace it with a CSV exported by your own copied GX Works3 project.

## 3. Put your actual file in the workspace

Overwrite `input/flowchart.json` with your own checker JSON exported via EXPORT JSON. Do not rename the `SKILL.md` or change existing structure checker code.

## 4. Ask Copilot to import

Start a fresh local Copilot chat and ask it to use `/gxworks3-import`. Ask it to run the converter first, then use Computer Use to open the OFFLINE copied GX Works3 project and import the generated station-list CSV. Require user approval before a write/import or save. Ask it to verify station numbers, models, per-station cycles and warnings.

Do NOT allow write-to-PLC, online commands, changes to a real running controller, or automatic approval of sensitive applications. Review prompts and GUI actions. Computer Use is experimental and may not always find controls reliably.

## Limitations

- The conversion code is the previously tested browser converter v0.4 core reused under Node.js.
- Missing checker fields may result in blank GX CSV cells (sparse mode).
- `speed`, physical port wiring, actual hardware firmware, and a master cycle time (e.g., 4,000 microseconds) are not encoded in the station-list CSV format tested here.
- GX Works3 may display warnings or reset unsupported/missing parameters after import.
- No live GX Works3 interaction can be tested in this Linux container; verify the generated CSV with your Windows installation.
- Keep company data local; do not commit actual exported configuration to a public GitHub repository without authorization.
