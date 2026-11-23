/*
 * CC-Link IE TSN Structure Check Tool JSON -> GX Works3 station-list CSV
 * v0.3 experimental: use explicit JSON fields and leave others blank.
 * Header structure transcribed from an actual exported GX Works3 CSV.
 * All conversion executes locally in the browser. No external dependencies.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GXReverse = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const HEADER_ROWS = [["[No]","[ObjectN]","[ModelN]","[STA#]","[STAType]","[NetworkLabel]","[RX_P]","[RX_S]","[RX_E]","[RY_P]","[RY_S]","[RY_E]","[RWr_P]","[RWr_S]","[RWr_E]","[RWw_P]","[RWw_S]","[RWw_E]","[LB_P]","[LB_S]","[LB_E]","[LW_P]","[LW_S]","[LW_E]","[AutoParam]","[AutoParamDetail]","[PDOMapping]","[IPAddress]","[SubnetMask]","[DefaultGateway]","[Reserved/ErrInvalidSTA]","[NetworkSynchronousCOM]","[COMPeriod_RXRYRWrRWw]","[COMPeriod_LBLW]","[Alias]","[Comment]","[STA-SpecificMode]","[CC-LinkIETSNClass]","[CyclicTransmissionDistribution]"],["","","","","","","RX設定(16点単位)","RX設定(16点単位)","RX設定(16点単位)","RY設定(16点単位)","RY設定(16点単位)","RY設定(16点単位)","RWr設定(4点単位)","RWr設定(4点単位)","RWr設定(4点単位)","RWw設定(4点単位)","RWw設定(4点単位)","RWw設定(4点単位)","LB設定(16点単位)","LB設定(16点単位)","LB設定(16点単位)","LW設定(1点単位)","LW設定(1点単位)","LW設定(1点単位)","パラメータ自動設定","パラメータ自動設定","","","","","","","通信周期設定","通信周期設定","局情報","局情報","局情報","",""],["台数","オブジェクト名","形名","局番","局種別","ネットワークラベル","点数(10進数)","先頭(16進数)","最終(16進数)","点数(10進数)","先頭(16進数)","最終(16進数)","点数(10進数)","先頭(16進数)","最終(16進数)","点数(10進数)","先頭(16進数)","最終(16進数)","点数(10進数)","先頭(16進数)","最終(16進数)","点数(10進数)","先頭(16進数)","最終(16進数)","","","PDOマッピング設定","IPアドレス(10進数)","サブネットマスク(10進数)","デフォルトゲートウェイ(10進数)","予約/エラー無効局","ネットワーク同期通信設定","RX/RY/RWr/RWw","LB/LW","機器名","コメント","局固有モード設定","CC-Link IE TSN Class","サイクリック伝送分散設定"]];
  const COLUMNS = HEADER_ROWS[0];
  const META_KEYS = ["[FunctionN]","[OutputType]","[Version]","[NetworkType]","[MasterStation]","[IPAddressInputFormat]","[Language]","[Mode]","[PathMethod]","[CyclicTransmissionTime]"];
  const STATION_TYPES = { master:'マスタ局', local:'ローカル局', remote:'リモート局' };
  const CYCLE_NAMES = { BASIC:'基本周期', LOW:'低速', MID:'中速' };

  const has = (obj, key) => !!obj && Object.prototype.hasOwnProperty.call(obj,key);
  const str = value => (value == null ? '' : String(value));
  function scalar(value){ return value == null ? '' : typeof value === 'object' ? '' : String(value); }
  function safeCSVValue(value){ return scalar(value); }
  function validate(json) {
    if (!json || typeof json !== 'object' || !Array.isArray(json.nodes)) {
      throw new Error('構成チェックツールのJSON形式ではありません（nodes配列が必要です）。');
    }
    // Missing or invalid node data does not block generation; empty columns are intentional.
    if (json.nodes.length === 0) throw new Error('JSONに機器ノードがありません。');
    return json;
  }
  function csvCell(value) {
    const v = safeCSVValue(value);
    return /["\t\r\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v;
  }
  function toTSV(rows) { return rows.map(row => row.map(csvCell).join('\t')).join('\r\n') + '\r\n'; }
  function encodeUTF16LE(text) {
    const result = new Uint8Array(2 + text.length * 2);
    result[0] = 255; result[1] = 254;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      result[2 + i * 2] = code & 0xff;
      result[3 + i * 2] = code >> 8;
    }
    return result;
  }
  function getData(node) { return node && typeof node.data === 'object' && node.data ? node.data : {}; }
  function findModel(data) { return scalar(data.modelName || data.label); }
  function numStation(data) {
    const v = data.stationNumber;
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isSafeInteger(n) && n >= 0 ? n : null;
  }
  function slotSort(nodes) {
    return nodes.map((node, i) => ({node, i, st:numStation(getData(node))}))
      .sort((a,b) => a.st == null && b.st == null ? a.i-b.i
           : a.st == null ? 1 : b.st == null ? -1
           : a.st - b.st || a.i-b.i);
  }
  function metaRows(json, master, preserve) {
    const orig = preserve && master && getData(master).gxWorks3 && getData(master).gxWorks3.sourceMetadata;
    const meta = {};
    if (preserve && orig && typeof orig === 'object') {
      for (const key of META_KEYS) {
        const arr = orig[key];
        if (Array.isArray(arr)) meta[key] = arr.map(scalar);
      }
    }
    // Fixed structural markers needed to recognize this export type.
    meta['[FunctionN]'] = ['Exporting a list of stations'];
    meta['[OutputType]'] = ['CSV'];
    meta['[Version]'] = meta['[Version]'] || ['1','0'];
    meta['[NetworkType]'] = ['CC-Link IE TSN'];
    meta['[IPAddressInputFormat]'] = meta['[IPAddressInputFormat]'] || ['10'];
    meta['[Language]'] = meta['[Language]'] || ['ja'];
    meta['[MasterStation]'] = [master ? findModel(getData(master)) : ''];
    // No inference for unknown network topology or synchronization settings.
    meta['[PathMethod]'] = meta['[PathMethod]'] || [''];
    meta['[CyclicTransmissionTime]'] = meta['[CyclicTransmissionTime]'] || [''];
    if (json.communicationMode === 'unicast') meta['[Mode]'] = ['オンライン(ユニキャストモード)'];
    else if (json.communicationMode === 'multicast') meta['[Mode]'] = ['オンライン(マルチキャストモード)'];
    else meta['[Mode]'] = meta['[Mode]'] || [''];
    return META_KEYS.map(key => [key, ...(meta[key] || [''])]);
  }
  function setIfPresent(record, column, data, keys) {
    for (const k of keys) {
      if (has(data, k) && data[k] != null) {
        record[column] = scalar(data[k]);
        return true;
      }
    }
    return false;
  }
  function setPointCount(record, label, data, column, method, warnings, loc) {
    if (!has(data, label) || data[label] === null || data[label] === '') return;
    const amount = Number(data[label]);
    if (!Number.isFinite(amount) || amount < 0) {
      warnings.push(loc + ': ' + label + ' の値が数値ではないため、点数は空欄です。');
      record[column] = '';
      return;
    }
    // Flow-check tool RX/RY/LB are bytes; convert to bits. RWr/RWw/LW bytes to words.
    const points = method === 'bit' ? amount * 8 : amount / 2;
    if (!Number.isInteger(points)) {
      warnings.push(loc + ': ' + label + ' はGX Works3の点数単位に換算できないため、空欄です。');
      record[column] = '';
      return;
    }
    record[column] = String(points);
  }
  function convert(input, options={}) {
    let json;
    try { json=typeof input==='string' ? JSON.parse(input) : input; }
    catch (err) { throw new Error('JSONの解析に失敗しました: ' + err.message); }
    validate(json);
    const preserve = !!options.preserveSource;
    const nodes = slotSort(json.nodes);
    const masterItem = nodes.find(x => getData(x.node).stationType==='master' || getData(x.node).isMaster===true);
    const master = masterItem ? masterItem.node : null;
    const warnings=[];
    if (!master) warnings.push('マスタ局が特定できません。[MasterStation] は空欄です。');
    if (master && getData(master).stationType !== 'master') warnings.push('isMaster=true の機器をマスタ局として扱いました。');
    if (json.edges && json.edges.length) warnings.push('接続線（edges: '+json.edges.length+'本）は局一覧CSVに対応する列がないため出力されません。');
    const outRows = [...metaRows(json,master,preserve), ['[Data]'], ...HEADER_ROWS.map(row=>row.slice())];
    const stations=[];
    const stationNumbers=new Set();
    for (let i=0;i<nodes.length;i++) {
      const node=nodes[i].node, d=getData(node), gx=(d.gxWorks3 && typeof d.gxWorks3==='object') ? d.gxWorks3 : {};
      const source=(preserve && gx.sourceRow && typeof gx.sourceRow==='object') ? gx.sourceRow : {};
      const record=Object.fromEntries(COLUMNS.map(key=>[key, has(source,key) ? scalar(source[key]) : '']));
      const model=findModel(d);
      const station=numStation(d);
      const role=d.stationType || (d.isMaster===true ? 'master' : '');
      const loc = station == null ? '行'+(i+1) : '局番'+station;
      record['[No]']=String(i);
      record['[ObjectN]']=role==='master' ? '自局' : model;
      record['[ModelN]']=role==='master' ? '自局' : model;
      // Explicit JSON takes priority over saved source row; no made-up station numbers.
      record['[STA#]']=station==null ? (preserve ? (source['[STA#]']||'') : '') : String(station);
      record['[STAType]']=STATION_TYPES[role] || '';
      if (!model) warnings.push(loc+': 形名がJSONにないため、形名欄は空欄です。');
      if (!STATION_TYPES[role]) warnings.push(loc+': 「'+(role||'未設定')+'」は局一覧の局種別に対応しないため、局種別は空欄です。');
      if (station === null) warnings.push(loc+': 局番がJSONにないため空欄です。');
      else if (stationNumbers.has(station)) warnings.push('局番'+station+' が重複しています。');
      else stationNumbers.add(station);
      if (has(gx,'networkLabel') && gx.networkLabel != null) record['[NetworkLabel]']=scalar(gx.networkLabel);
      else setIfPresent(record,'[NetworkLabel]',d,['networkLabel']);
      if (has(d,'deviceClass') && d.deviceClass != null && role!=='master') {
        record['[CC-LinkIETSNClass]']=['A','B'].includes(d.deviceClass) ? 'CC-Link IE TSN Class '+d.deviceClass : '';
        if (!['A','B'].includes(d.deviceClass)) warnings.push(loc+': deviceClassがA/Bではありません。');
      }
      if (has(d,'cycleSetting') && d.cycleSetting != null) {
        record['[COMPeriod_RXRYRWrRWw]']=CYCLE_NAMES[d.cycleSetting] || '';
        if (!CYCLE_NAMES[d.cycleSetting]) warnings.push(loc+': cycleSettingは対応する日本語値がありません。');
      }
      // GX exported CSV stores point counts, while the check tool stores byte counts.
      for (const [label,column,unit] of [
        ['RX','[RX_P]','bit'], ['RY','[RY_P]','bit'],
        ['RWr','[RWr_P]','word'], ['RWw','[RWw_P]','word'],
        ['LB','[LB_P]','bit'], ['LW','[LW_P]','word']
      ]) setPointCount(record,label,d,column,unit,warnings,loc);
      // If source addresses no longer match modified point counts, show a warning.
      if (preserve) {
        for (const [label,column] of [['RX','[RX_P]'],['RY','[RY_P]'],['RWr','[RWr_P]'],['RWw','[RWw_P]'],['LB','[LB_P]'],['LW','[LW_P]']]) {
          if (has(source,column) && source[column]!=='' && record[column]!==scalar(source[column])) {
            warnings.push(loc+': '+label+'の点数を変更しましたが先頭/最終アドレスは元CSVの値です。');
          }
        }
      }
      // Use only explicit values; unknown values are intentionally blank.
      if (!setIfPresent(record,'[IPAddress]',d,['ipAddress','IPAddress'])) {
        if (has(gx,'ipAddress') && gx.ipAddress != null) record['[IPAddress]']=scalar(gx.ipAddress);
      }
      setIfPresent(record,'[SubnetMask]',d,['subnetMask']);
      setIfPresent(record,'[DefaultGateway]',d,['defaultGateway']);
      setIfPresent(record,'[Alias]',d,['alias']);
      setIfPresent(record,'[Comment]',d,['comment']);
      if (preserve && !gx.sourceRow) warnings.push(loc+': 元CSV情報がないため未対応の項目は空欄です。');
      const row=COLUMNS.map(key=>record[key] || '');
      outRows.push(row);
      stations.push({station:record['[STA#]'],model,role:record['[STAType]']||'（空欄）',classValue:record['[CC-LinkIETSNClass]'],ip:record['[IPAddress]'], rx:record['[RX_P]'], rwr:record['[RWr_P]'], emptyCells:row.filter(v=>v==='').length});
    }
    const csv=toTSV(outRows);
    return {
      csv, bytes:encodeUTF16LE(csv), warnings, stations,
      stats:{nodeCount:nodes.length, columns:COLUMNS.length, blankCells:stations.reduce((a,s)=>a+s.emptyCells,0), edgeCount:Array.isArray(json.edges)?json.edges.length:0, preserve}
    };
  }
  return {convert, COLUMNS, HEADER_ROWS, toTSV, encodeUTF16LE};
});
