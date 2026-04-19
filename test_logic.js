const path    = require('path');
const fs      = require('fs');
const vm      = require('vm');
const KEIRIN_DIR = __dirname;

const logs = [];
const consoleSpy = {
  log:   (...a) => { logs.push(a.join(' ')); },
  error: (...a) => { logs.push('[ERROR] ' + a.join(' ')); },
  warn:  (...a) => { logs.push('[WARN] '  + a.join(' ')); },
};

const elStub = {
  value: '', innerHTML: '', innerText: '', checked: false, style: {},
  getAttribute: () => null, querySelector: () => elStub,
  querySelectorAll: () => [], dispatchEvent: () => {},
  insertAdjacentHTML: () => {}, remove: () => {}, forEach: () => {},
};
const documentStub = {
  getElementById: () => elStub,
  querySelector: () => null,
  querySelectorAll: () => ({ forEach: () => {} }),
  addEventListener: () => {},
};
const windowStub = { scrollBy: () => {}, scrollTo: () => {}, open: () => {} };

let src = fs.readFileSync(path.join(KEIRIN_DIR, 'keirin_logic.js'), 'utf8');
// IIFEをほどき、app.logMessage を console.log にリダイレクト
src = src
  .replace(/^\(function\(app\)\s*\{/, '')
  .replace(/\}\)\(App\);\s*$/, '')
  .replace(/app\.logMessage\(/g, 'console.log(');

const appStub = { logMessage: () => {}, sendLog: () => {} };
const ctx = vm.createContext({
  app: appStub,
  App: appStub,
  require,
  __dirname: KEIRIN_DIR,
  document: documentStub,
  window: windowStub,
  alert: () => {},
  console: consoleSpy,
  setTimeout: () => {},
  clearTimeout: () => {},
});

try {
  vm.runInContext(src, ctx);
  const successLog = logs.find(l => l.includes('SUCCESS'));
  console.log('[TEST] keirin_logic.js ロード: OK');
  console.log('[TEST] loadBANK_DATA ログ:');
  logs.filter(l => l.includes('SUCCESS') || l.includes('FATAL') || l.includes('ERROR')).forEach(l => console.log('  ', l));
  if (successLog) {
    console.log('[TEST] PASS —', successLog);
  } else {
    console.log('[TEST] FAIL — SUCCESSログなし');
    process.exit(1);
  }
} catch (e) {
  console.error('[TEST] FAIL:', e.message);
  process.exit(1);
}
