const fs = require('fs');
const { execSync, spawnSync } = require('child_process');

const INST = 'C:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/apps/backend/instance/';
const SNAP = 'C:/Users/53527/Desktop/自我管理提升/自我管理提升V2.0/平台开发/管理平台设计/.workbuddy/browser_test/db_snapshot_pre_realsubmit.db';
const LIVE = INST + 'score_management.db';

function size(p){ try { return fs.statSync(p).size; } catch(e){ return -1; } }

function md5(p){
  try {
    const crypto = require('crypto');
    const buf = fs.readFileSync(p);
    return crypto.createHash('md5').update(buf).digest('hex');
  } catch(e){ return 'ERR:'+e.message; }
}

console.log('=== PRE-RESTORE STATE ===');
console.log('snapshot size =', size(SNAP), ' md5=', md5(SNAP));
console.log('live     size =', size(LIVE), ' md5=', md5(LIVE));
console.log('live != snapshot ?', md5(LIVE) !== md5(SNAP));

// Step 1: kill backend python processes (project convention: 强杀全部 python 再重启)
console.log('\n=== STEP 1: stop backend python ===');
try {
  const out = execSync('taskkill /IM python.exe /F 2>&1', { encoding: 'utf8', timeout: 15000 });
  console.log('taskkill output:\n' + out.trim());
} catch (e) {
  console.log('taskkill finished (some procs may have already exited):', (e.stdout||'').toString().trim() || e.message);
}
// give OS a moment to release the file handle
let waited = 0;
while (waited < 3000) { const t = Date.now(); while (Date.now() - t < 300) {} waited += 300; }

// verify no python holding port 5000
console.log('\n=== STEP 2: copy snapshot over live DB ===');
try {
  fs.copyFileSync(SNAP, LIVE);
  console.log('copy OK');
} catch (e) {
  console.log('COPY FAILED:', e.message);
  process.exit(1);
}

console.log('\n=== POST-RESTORE VERIFY ===');
console.log('snapshot size =', size(SNAP), ' md5=', md5(SNAP));
console.log('live     size =', size(LIVE), ' md5=', md5(LIVE));
console.log('RESTORE SUCCESS (md5 match) ?', md5(LIVE) === md5(SNAP));

// list any leftover sibling files
try {
  const sibs = fs.readdirSync(INST).filter(f => /score_management/.test(f));
  console.log('instance db-related files:', JSON.stringify(sibs));
} catch(e){ console.log('instance read err', e.message); }
console.log('\nDONE');
