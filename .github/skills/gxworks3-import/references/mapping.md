# JSON to GX Works3 station-list mappings, v0.4

- `nodes[].data.modelName` -> `[ModelN]` and `[ObjectN]`
- `nodes[].data.stationNumber` -> `[STA#]`
- `nodes[].data.stationType` (`master`,`local`,`remote`) -> `[STAType]`
- `nodes[].data.deviceClass` (`A`,`B`) -> `[CC-LinkIETSNClass]` for nonmaster rows
- `nodes[].data.cycleSetting`: `BASIC` -> basic cycle; `MID` -> medium cycle; `LOW` -> slow cycle -> `[COMPeriod_RXRYRWrRWw]`
- In overlay mode, the same mapped cycle is applied to `[COMPeriod_LBLW]` when that template cell is populated; blank template cells remain blank.
- `nodes[].data.RX`, `RY`, `LB` bytes -> bit points x 8 -> `[RX_P]`, `[RY_P]`, `[LB_P]`
- `nodes[].data.RWr`, `RWw`, `LW` bytes -> word points /2 -> `[RWr_P]`, `[RWw_P]`, `[LW_P]`
- In overlay mode, a JSON `LB: 0` or `LW: 0` does not replace a blank template point-count cell with `0`; the blank is preserved.
- `nodes[].data.ipAddress` -> `[IPAddress]` only if explicitly in native JSON (not a standard field)
- `nodes[].data.networkLabel` -> `[NetworkLabel]` only if explicitly present
- `nodes[].data.subnetMask`, `defaultGateway`, `alias`, `comment` -> corresponding columns only if present
- top-level `communicationMode` -> `[Mode]` metadata header

Unsupported in station-list CSV: `edges` physical port connections, drawing positions, `speed`, `portCount`, `portType`, `firmwareVersion`, `protocolVersion`, `supportsMulticastFilter`, `isRingCapable`, `cyclicDataBytes` as a separate column, absolute master cycle period.

Two output modes: `sparse` creates missing-field blanks; `overlay` preserves existing non-JSON values from GX CSV template. Project hardware compatibility and mandatory values must be validated after import. Never mutate original checker JSON schema.
