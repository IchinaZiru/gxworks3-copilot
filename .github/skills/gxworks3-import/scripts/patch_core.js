/*
 * JSON -> GX Works3 station CSV overlay converter, v0.4.
 * The original CC-Link IE TSN structure checker is not modified.
 * Requires GXReverse from reverse_core.js (v0.3).
 * Standalone conversion: leave unknown fields blank.
 * Overlay conversion: carry forward unknown fields from a GX-exported CSV.
 */
(function(root, factory){
  'use strict';
  const base = typeof module !== 'undefined' && module.exports
    ? require('./reverse_core.js') : root.GXReverse;
  const value = factory(base);
  if (typeof module !== 'undefined' && module.exports) module.exports=value;
  else root.GXPatch=value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(base){
  'use strict';
  if (!base || typeof base.convert !== 'function') throw new Error('Missing GXReverse dependency');
  const COLS=base.COLUMNS;
  const EDITABLE=[
    '[ObjectN]','[ModelN]','[STAType]','[NetworkLabel]',
    '[RX_P]','[RY_P]','[RWr_P]','[RWw_P]','[LB_P]','[LW_P]',
    '[IPAddress]','[SubnetMask]','[DefaultGateway]',
    '[COMPeriod_RXRYRWrRWw]','[COMPeriod_LBLW]','[Alias]','[Comment]','[CC-LinkIETSNClass]'
  ];
  const ALLOWED_ROLES = new Set(['master','local','remote']);
  const has=(obj,key)=>obj!=null && Object.prototype.hasOwnProperty.call(obj,key);
  function parseTSV(text){
    if (typeof text!=='string') throw new Error('CSV text must be a string');
    const rows=[];let row=[], cell='', quoted=false, start=true;
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(quoted){
        if(c==='"'){
          if(text[i+1]==='"'){cell+='"';i++;}
          else quoted=false;
        }else cell+=c;
      }else if(c==='"' && start){quoted=true;start=false;}
      else if(c==='\t'){row.push(cell);cell='';start=true;}
      else if(c==='\r'||c==='\n'){
        if(c==='\r' && text[i+1]==='\n') i++;
        row.push(cell);rows.push(row);row=[];cell='';start=true;
      }else{cell+=c;start=false;}
    }
    if(quoted)throw new Error('Unclosed quotation mark in CSV');
    if(row.length || cell) {row.push(cell);rows.push(row);}
    return rows;
  }
  function decodeText(bytes){
    if (typeof bytes==='string') return bytes.replace(/^\uFEFF/,'');
    const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
    if(b.length>=2 && b[0]===0xff && b[1]===0xfe){return new TextDecoder('utf-16le').decode(b.subarray(2));}
    if(b.length>=2 && b[0]===0xfe && b[1]===0xff){return new TextDecoder('utf-16be').decode(b.subarray(2));}
    if(b.length>=3 && b[0]===0xef && b[1]===0xbb && b[2]===0xbf){return new TextDecoder('utf-8').decode(b.subarray(3));}
    if(b.length>12 && b[1]===0 && b[3]===0 && b[5]===0){return new TextDecoder('utf-16le').decode(b);}
    return new TextDecoder('utf-8',{fatal:true}).decode(b);
  }
  function getJson(input){
    const data=typeof input==='string'?JSON.parse(input):input;
    if (!data || !Array.isArray(data.nodes)) throw new Error('Invalid check-tool JSON (nodes missing)');
    // gxWorks3 was introduced by a separate converter and is NOT native checker state.
    // Always ignore it: sourceRow must never become a hidden data source.
    const cleaned={...data,nodes:data.nodes.map(node=>{
      const d={...((node && node.data) || {})};delete d.gxWorks3;
      return {...node,data:d};
    })};
    return cleaned;
  }
  function checkRows(rows){
    if(rows.length<14 || rows[10]?.[0]!=='[Data]') throw new Error('Unexpected GX Works3 CSV header ([Data] not found)');
    if(rows[11].length!==COLS.length || rows[11].some((k,i)=>k!==COLS[i])){
      throw new Error('GX Works3 CSV column definitions do not match the verified 39-column format');
    }
    for(let i=12;i<rows.length;i++){
      if(rows[i].length!==COLS.length) throw new Error('Unexpected row width at line '+(i+1));
    }
    return true;
  }
  function dataRows(rows){return rows.slice(14);}
  function getColIndex(key){return COLS.indexOf(key);}
  function value(row,key){return row[getColIndex(key)]||'';}
  function diff(station,col,from,to,type){return {station,column:col,from,to,type:type||'update'};}
  function masterModel(json){
    const m=json.nodes.find(n=>n?.data?.stationType==='master' || n?.data?.isMaster===true);
    return m ? String(m.data?.modelName||m.data?.label||'') : '';
  }
  function convert(input, options={}){
    const json=getJson(input);
    const result=base.convert(json); // sparse values only; no sourceRow path.
    const generated=parseTSV(result.csv);
    checkRows(generated);
    const errors=result.warnings.slice();
    const patches=[];const skipped=[];
    if(options.templateBytes==null && options.templateText==null){
      return {
        ...result,mode:'sparse',changes:[],skipped,
        stats:{...result.stats,mode:'sparse',matched:0,added:result.stats.nodeCount,changed:0,ignored:0},
      };
    }
    const template=decodeText(options.templateBytes==null?options.templateText:options.templateBytes);
    const outputRows=parseTSV(template);
    checkRows(outputRows);
    const cycleCol=getColIndex('[COMPeriod_RXRYRWrRWw]');
    const lbLwCycleCol=getColIndex('[COMPeriod_LBLW]');
    for(const row of dataRows(generated)){
      if(row[cycleCol]) row[lbLwCycleCol]=row[cycleCol];
    }
    const statCol=getColIndex('[STA#]');
    const typeCol=getColIndex('[STAType]');
    const numberCol=getColIndex('[No]');
    const mapped=new Map();
    let maxNo=-1;
    for(let j=14;j<outputRows.length;j++){
      const row=outputRows[j];
      const n=String(row[statCol]);
      if(n==='')continue;
      if(mapped.has(n))throw new Error('Duplicate station number in GX CSV template: '+n);
      mapped.set(n,j);
      const num=Number(row[numberCol]);
      if(Number.isSafeInteger(num)) maxNo=Math.max(maxNo,num);
    }
    let matched=0,added=0;
    const seen=new Set();
    const jsonSorted=json.nodes.map((node,i)=>({d:node?.data||{},i})).sort((a,b)=>{
      const av=Number(a.d.stationNumber),bv=Number(b.d.stationNumber);
      return (Number.isSafeInteger(av)?av:999999)-(Number.isSafeInteger(bv)?bv:999999)||a.i-b.i;
    });
    for(let i=0;i<jsonSorted.length;i++){
      const d=jsonSorted[i].d;
      const key=d.stationNumber==null||d.stationNumber===''?'':String(d.stationNumber);
      const role=d.stationType || (d.isMaster===true?'master':'');
      if(!ALLOWED_ROLES.has(role)){
        skipped.push({node:d.modelName||d.label||'? ',reason:'unsupported station type: '+role});
        continue;
      }
      if(key==='' || !Number.isSafeInteger(Number(key)) || Number(key)<0){
        skipped.push({node:d.modelName||d.label||'? ',reason:'station number missing or invalid'});
        continue;
      }
      if(seen.has(key))throw new Error('Duplicate station number in JSON: '+key);
      seen.add(key);
      const generatedRow=generated.slice(14).find(row=>String(row[statCol])===key);
      if(!generatedRow){skipped.push({node:d.modelName||d.label||'?',reason:'not in generated station table'});continue;}
      const existingIndex=mapped.get(key);
      if(existingIndex==null){
        if(role==='master'){
          skipped.push({node:d.modelName||d.label||'?',reason:'master station absent in template'});
          continue;
        }
        const newRow=generatedRow.slice();
        newRow[numberCol]=String(++maxNo);
        outputRows.push(newRow);
        mapped.set(key,outputRows.length-1);added++;
        patches.push(diff(key,'[ROW]','', 'new station','add'));
        continue;
      }
      matched++;
      const dest=outputRows[existingIndex];
      if(key==='0' && role==='master'){
        // The master model is a property of the GX project, not an imported station name.
        // Keep its exported master-row markers unchanged.
      }
      for(const col of EDITABLE){
        const c=getColIndex(col);
        if(c<0)continue;
        // For master, never replace the special self-station cells.
        if(role==='master' && (col==='[ObjectN]' || col==='[ModelN]')) continue;
        const next=generatedRow[c];
        if(next==null || next==='') continue;
        const prev=dest[c];
        if(col==='[COMPeriod_LBLW]' && prev==='') continue;
        if(prev==='' && next==='0' && (col==='[LB_P]' || col==='[LW_P]')) continue;
        if(next!==prev){
          dest[c]=next;
          patches.push(diff(key,col,prev,next));
          // The JSON has sizes but no address allocation. Do not recalculate ranges.
          if(/^\[(RX|RY|RWr|RWw|LB|LW)_P\]$/.test(col)){
            errors.push('Station '+key+': '+col+' changed; old start/end addresses were retained, not recalculated.');
          }
        }
      }
    }
    if(json.communicationMode==='unicast' || json.communicationMode==='multicast'){
      const wanted=json.communicationMode==='unicast'?'\u30aa\u30f3\u30e9\u30a4\u30f3(\u30e6\u30cb\u30ad\u30e3\u30b9\u30c8\u30e2\u30fc\u30c9)':'\u30aa\u30f3\u30e9\u30a4\u30f3(\u30de\u30eb\u30c1\u30ad\u30e3\u30b9\u30c8\u30e2\u30fc\u30c9)';
      const metaIndex=outputRows.findIndex(row=>row[0]==='[Mode]');
      if(metaIndex>=0 && outputRows[metaIndex][1]!==wanted){
        patches.push(diff('metadata','[Mode]',outputRows[metaIndex][1],wanted));
        outputRows[metaIndex][1]=wanted;
      }
    }
    const expectedMaster=masterModel(json);
    const metaMaster=outputRows.find(row=>row[0]==='[MasterStation]')?.[1]||'';
    if(expectedMaster && metaMaster && expectedMaster!==metaMaster){
      errors.push('GX CSV master '+metaMaster+' differs from JSON master '+expectedMaster+'; template master was preserved.');
    }
    const text=base.toTSV(outputRows);
    const stations=dataRows(outputRows).map(row=>({
      station:value(row,'[STA#]'),model:value(row,'[ModelN]'),role:value(row,'[STAType]'),
      classValue:value(row,'[CC-LinkIETSNClass]'),ip:value(row,'[IPAddress]'),
      rx:value(row,'[RX_P]'),rwr:value(row,'[RWr_P]'),emptyCells:row.filter(v=>v==='').length
    }));
    return {
      csv:text,bytes:base.encodeUTF16LE(text),warnings:errors,stations,
      mode:'overlay',changes:patches,skipped,
      stats:{nodeCount:stations.length,columns:COLS.length,blankCells:stations.reduce((a,s)=>a+s.emptyCells,0),
        edgeCount:Array.isArray(json.edges)?json.edges.length:0,mode:'overlay',matched,added,changed:patches.filter(x=>x.type==='update').length,ignored:skipped.length}
    };
  }
  return {convert,parseTSV,decodeText,EDITABLE};
});
