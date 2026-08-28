const fs = require('node:fs/promises');
const path = require('node:path');

const PRODUCT_NAME = '学工智伴';

async function pathExists(fsImpl, target) {
  try {
    await fsImpl.lstat(target);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}

function macApplicationBundle(executablePath, pathImpl = path.posix) {
  const macosDirectory = pathImpl.dirname(pathImpl.resolve(executablePath));
  const contentsDirectory = pathImpl.dirname(macosDirectory);
  const applicationBundle = pathImpl.dirname(contentsDirectory);
  return /\.app$/i.test(applicationBundle) ? applicationBundle : null;
}

function isMountedDmgApplication(applicationBundle, pathImpl = path.posix) {
  const volumesDirectory = pathImpl.resolve(pathImpl.sep, 'Volumes');
  const resolved = pathImpl.resolve(applicationBundle);
  return resolved === volumesDirectory || resolved.startsWith(`${volumesDirectory}${pathImpl.sep}`);
}

/**
 * electron-builder normally creates the Windows shortcut. This runtime fallback
 * covers installers where the shell integration was skipped, without replacing
 * an existing shortcut or creating links from a mounted macOS DMG.
 */
async function ensureDesktopShortcut(options) {
  const value = options && typeof options === 'object' ? options : {};
  const platform = String(value.platform || process.platform);
  if (!value.isPackaged) return { status:'skipped-unpackaged' };
  if (!['win32', 'darwin'].includes(platform)) return { status:'skipped-platform' };

  const pathImpl = platform === 'win32' ? path.win32 : path.posix;
  const fsImpl = value.fs || fs;
  const productName = String(value.productName || PRODUCT_NAME).trim() || PRODUCT_NAME;
  const desktopPath = pathImpl.resolve(await value.getDesktopPath());
  await fsImpl.mkdir(desktopPath, { recursive:true });

  if (platform === 'win32') {
    const shortcutPath = pathImpl.join(desktopPath, `${productName}.lnk`);
    if (await pathExists(fsImpl, shortcutPath)) return { status:'existing', path:shortcutPath };
    const executablePath = String(value.executablePath || '').trim();
    if (!executablePath) return { status:'skipped-missing-target' };
    const target = pathImpl.resolve(executablePath);
    const shell = value.shell;
    if (!shell || typeof shell.writeShortcutLink !== 'function') return { status:'skipped-shell-unavailable' };
    const created = shell.writeShortcutLink(shortcutPath, 'create', {
      target,
      cwd:pathImpl.dirname(target),
      description:'学工智伴辅导员工作台',
      icon:target,
      iconIndex:0,
    });
    return created ? { status:'created', path:shortcutPath } : { status:'failed', path:shortcutPath };
  }

  const applicationBundle = macApplicationBundle(String(value.executablePath || ''), pathImpl);
  if (!applicationBundle) return { status:'skipped-not-app-bundle' };
  if (isMountedDmgApplication(applicationBundle, pathImpl)) return { status:'skipped-mounted-dmg' };
  const shortcutPath = pathImpl.join(desktopPath, `${productName}.app`);
  if (await pathExists(fsImpl, shortcutPath)) return { status:'existing', path:shortcutPath };
  await fsImpl.symlink(applicationBundle, shortcutPath, 'dir');
  return { status:'created', path:shortcutPath };
}

module.exports = { ensureDesktopShortcut, macApplicationBundle, isMountedDmgApplication };
