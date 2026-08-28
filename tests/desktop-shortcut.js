const assert = require('node:assert/strict');
const path = require('node:path');
const { ensureDesktopShortcut, macApplicationBundle, isMountedDmgApplication } = require('../desktop/desktop-shortcut.cjs');

function missingFs() {
  return {
    async lstat() { const error = new Error('missing'); error.code = 'ENOENT'; throw error; },
    async mkdir() {},
    async symlink() { throw new Error('symlink should not run'); },
  };
}

(async () => {
  const skipped = await ensureDesktopShortcut({ platform:'win32', isPackaged:false, getDesktopPath:async () => 'C:/Desktop' });
  assert.equal(skipped.status, 'skipped-unpackaged', 'development Electron must not create a desktop shortcut');

  const writes = [];
  const windows = await ensureDesktopShortcut({
    platform:'win32',
    isPackaged:true,
    getDesktopPath:async () => 'C:/Users/teacher/Desktop',
    executablePath:'C:/Program Files/学工智伴/counselor-desk.exe',
    fs:missingFs(),
    shell:{ writeShortcutLink:(shortcut, operation, details) => { writes.push({ shortcut, operation, details }); return true; } },
  });
  assert.equal(windows.status, 'created');
  assert.match(writes[0].shortcut, /学工智伴\.lnk$/);
  assert.equal(writes[0].operation, 'create');
  assert.match(writes[0].details.target, /counselor-desk\.exe$/);
  assert.equal(writes[0].details.description, '学工智伴辅导员工作台');

  const existingFs = { async lstat() {}, async mkdir() {}, async symlink() { throw new Error('must preserve existing desktop item'); } };
  const existing = await ensureDesktopShortcut({
    platform:'win32', isPackaged:true, getDesktopPath:async () => 'C:/Users/teacher/Desktop', executablePath:'C:/Program Files/学工智伴/counselor-desk.exe', fs:existingFs,
    shell:{ writeShortcutLink() { throw new Error('must preserve existing desktop shortcut'); } },
  });
  assert.equal(existing.status, 'existing');

  const links = [];
  const mac = await ensureDesktopShortcut({
    platform:'darwin', isPackaged:true, getDesktopPath:async () => '/Users/teacher/Desktop', executablePath:'/Applications/学工智伴.app/Contents/MacOS/counselor-desk', fs:{
      ...missingFs(),
      async symlink(target, shortcut, type) { links.push({ target, shortcut, type }); },
    },
  });
  assert.equal(mac.status, 'created');
  assert.deepEqual(links[0], { target:'/Applications/学工智伴.app', shortcut:'/Users/teacher/Desktop/学工智伴.app', type:'dir' });
  assert.equal(macApplicationBundle('/Applications/学工智伴.app/Contents/MacOS/counselor-desk'), '/Applications/学工智伴.app');
  assert.equal(isMountedDmgApplication('/Volumes/学工智伴/学工智伴.app'), true, 'DMG bundles must never create a persistent desktop alias');

  const dmg = await ensureDesktopShortcut({
    platform:'darwin', isPackaged:true, getDesktopPath:async () => '/Users/teacher/Desktop', executablePath:'/Volumes/学工智伴/学工智伴.app/Contents/MacOS/counselor-desk', fs:missingFs(),
  });
  assert.equal(dmg.status, 'skipped-mounted-dmg');
  console.log('PASS desktop-shortcut');
})().catch(error => { console.error(error); process.exitCode = 1; });
