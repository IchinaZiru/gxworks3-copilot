#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const converter = require('./patch_core.js');

function help() {
  console.log('Usage: node convert.js --json input/flowchart.json --out output/station_list.csv [--template input/gx_template.csv] [--force]');
  console.log('Without --template: sparse CSV, unknown columns blank. With --template: preserve existing GX column values.');
}
function fail(message) { console.error('ERROR:', message); process.exit(1); }
function parseArgs(args) {
  const opts = {};
  for (let i=0; i<args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') { help(); process.exit(0); }
    if (arg === '--force') { opts.force = true; continue; }
    if (['--json','--out','--template'].includes(arg)) {
      if (!args[i+1] || args[i+1].startsWith('--')) fail('Missing value for '+arg);
      opts[arg.slice(2)] = args[++i]; continue;
    }
    fail('Unknown option: '+arg);
  }
  if (!opts.json || !opts.out) { help(); fail('Both --json and --out are required.'); }
  return opts;
}
function main() {
  const opts = parseArgs(process.argv.slice(2));
  const source = path.resolve(opts.json);
  const target = path.resolve(opts.out);
  if (!fs.existsSync(source)) fail('JSON file not found: '+source);
  if (opts.template && !fs.existsSync(path.resolve(opts.template))) fail('GX CSV template not found: '+opts.template);
  if (target.toLowerCase() === source.toLowerCase() || (opts.template && target.toLowerCase() === path.resolve(opts.template).toLowerCase())) fail('Output path must not overwrite input files.');
  if (fs.existsSync(target) && !opts.force) fail('Output file exists; choose a new --out path, or pass --force deliberately.');
  let result;
  try {
    const json = JSON.parse(fs.readFileSync(source,'utf8').replace(/^\uFEFF/,''));
    const convOpts = opts.template ? {templateBytes:fs.readFileSync(path.resolve(opts.template))} : {};
    result = converter.convert(json, convOpts);
  } catch(err) { fail(err.message || String(err)); }
  const bytes = Buffer.from(result.bytes);
  if (bytes[0] !== 0xFF || bytes[1] !== 0xFE) fail('Generated file is missing UTF-16LE BOM.');
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.writeFileSync(target, bytes);
  console.log('OK. Generated: '+target);
  console.log('Mode: '+result.mode+'; UTF-16LE BOM; tab-separated; stations: '+result.stats.nodeCount+'; GX columns: '+result.stats.columns);
  if (result.stats.changed != null) console.log('Changed fields: '+result.stats.changed+'; matched stations: '+result.stats.matched+'; added: '+result.stats.added);
  for (const item of result.changes || []) console.log('CHANGED station='+item.station+' '+item.column+': '+JSON.stringify(item.from)+' -> '+JSON.stringify(item.to));
  for (const warning of result.warnings || []) console.warn('WARNING: '+warning);
  for (const skipped of result.skipped || []) console.warn('SKIPPED: '+JSON.stringify(skipped));
  console.log('Review the generated CSV before importing into GX Works3.');
}
main();
