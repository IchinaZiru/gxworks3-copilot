#!/usr/bin/env node
'use strict';

/**
 * Start the compiled file-dialog helper that waits for a GX Works3 CSV picker.
 * This launcher only starts a local helper; it never talks to PLC hardware.
 *
 * node watch_dialog.js export output/check.csv probe|fill|submit [--dry-run]
 * node watch_dialog.js import output/generated.csv probe|fill|submit [--dry-run]
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filtered = args.filter((arg) => arg !== '--dry-run');
  if (filtered.length !== 3) {
    throw new Error('Usage: node watch_dialog.js import|export output/NAME.csv probe|fill|submit [--dry-run]');
  }

  const [mode, inputPath, action] = filtered;
  if (!['import', 'export'].includes(mode)) throw new Error('Mode must be import or export');
  if (!['probe', 'fill', 'submit'].includes(action)) throw new Error('Action must be probe, fill, or submit');
  if (!/\.csv$/i.test(inputPath)) throw new Error('File extension must be .csv');

  // The script must be invoked from the original gxworks3-copilot workspace root.
  const workspace = path.resolve(__dirname, '../../../../');
  const outputDir = path.resolve(workspace, 'output');
  const csv = path.resolve(process.cwd(), inputPath);
  const relative = path.relative(outputDir, csv);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('For safety, CSV files must be inside the workspace output/ directory');
  }
  if (!fs.existsSync(outputDir) || !fs.statSync(outputDir).isDirectory()) {
    throw new Error('Missing output/ folder in workspace');
  }
  if (action !== 'probe') {
    if (mode === 'import' && (!fs.existsSync(csv) || !fs.statSync(csv).isFile())) {
      throw new Error('Import file does not exist: ' + csv);
    }
    if (mode === 'export' && fs.existsSync(csv)) {
      throw new Error('Export target already exists; choose a new name: ' + csv);
    }
  }

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '') + '_' + process.pid;
  const statusFile = path.join(outputDir, `gx_dialog_${stamp}.status.txt`);
  const helperExe = path.resolve(workspace, 'tools', 'gx-file-dialog.exe');
  const expectedTitle = mode === 'import' ? 'インポート' : 'エクスポート';

  console.log('Mode    :', mode);
  console.log('Action  :', action);
  console.log('CSV     :', csv);
  console.log('Status  :', statusFile);
  console.log('Helper  :', helperExe);
  if (!fs.existsSync(helperExe) || !fs.statSync(helperExe).isFile()) {
    throw new Error('Compiled file-dialog helper EXE not found: ' + helperExe);
  }
  if (dryRun) {
    console.log('DRY-RUN: Path validation succeeded. The compiled helper above is the execution target; no process or GUI action was started.');
    return;
  }
  if (process.platform !== 'win32') throw new Error('This launcher can only run on Windows');
  const startupDetails = [
    `MODE=${mode}`,
    `ACTION=${action}`,
    `CSV=${csv}`,
    `EXPECTED_DIALOG_TITLE=${expectedTitle}`,
    `HELPER_EXE=${helperExe}`,
    `STARTED_AT=${new Date().toISOString()}`,
  ].join('\n') + '\n';
  fs.writeFileSync(statusFile, `STATUS=STARTED\n${startupDetails}`, 'utf8');
  const child = spawn(helperExe, [mode, csv, action, statusFile, '75'], {
    cwd: workspace,
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.once('error', (error) => {
    fs.writeFileSync(
      statusFile,
      `STATUS=ERROR\n${startupDetails}DETAILS=${error.stack || error.message}\nTIME=${new Date().toISOString()}\n`,
      'utf8',
    );
    console.error(error.message);
    process.exitCode = 1;
  });
  child.once('spawn', () => {
    console.log('Started compiled file-dialog helper (PID ' + child.pid + ').');
    if (action === 'probe') {
      console.log('Probe is read-only. Open the GX Works3 CSV ' + (mode === 'import' ? 'Import' : 'Export') + ' dialog with Computer Use.');
    } else {
      console.log('Leave the matching GX Works3 dialog open, then start this action after Computer Use has finished.');
      console.log('Do not use Computer Use on the dialog until the watcher reports its final status.');
    }
    console.log('Read the status file after the helper completes.');
    child.unref();
  });
}

try {
  main();
} catch (error) {
  console.error('ERROR:', error.message);
  process.exitCode = 1;
}
