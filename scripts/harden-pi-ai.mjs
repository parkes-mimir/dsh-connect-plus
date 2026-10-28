#!/usr/bin/env node
// harden-pi-ai.mjs —— 一键加固 pi-ai 崩溃点（跨平台）
//
// 用法：
//   node scripts/harden-pi-ai.mjs            # 自动定位 pi-ai 并打补丁
//   node scripts/harden-pi-ai.mjs --loader    # 强制走 ESM loader hook 模式（只读 FS / NixOS）
//
// 两种模式：
//   1) 直接补丁（默认）：定位 pi-ai/dist/utils/{estimate,text}.js，原地替换源码。
//      适用：常规 Linux / Windows / macOS（profile node_modules 可写）。
//   2) Loader hook：把 pi-ai-harden-loader.mjs + register.mjs 安装到 $DSH_HOME/hooks/，
//      并提示用户在启动 dsh 时加 NODE_OPTIONS=--import=<register.mjs 绝对路径>。
//      适用：NixOS / 任何 nix store 只读场景。
//
// 脚本幂等：已加固过会跳过并报告。

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const forceLoader = args.includes('--loader');

function log(msg) { console.log('[harden-pi-ai] ' + msg); }

function findPiAi() {
  // 1) 当前插件目录的 node_modules
  const candidates = [
    join(__dirname, '..', 'node_modules', '@earendil-works', 'pi-ai'),
    join(process.cwd(), 'node_modules', '@earendil-works', 'pi-ai'),
  ];
  // 2) 从 profile 解析
  try {
    try {
      const resolved = require.resolve('@earendil-works/pi-ai/package.json', { paths: require.resolve.paths('@earendil-works/pi-ai') || [] });
      candidates.push(dirname(resolved));
    } catch {
      const paths = require.resolve.paths('@earendil-works/pi-ai') || [];
      for (const p of paths) {
        const candidate = join(p, '@earendil-works', 'pi-ai', 'package.json');
        if (existsSync(candidate)) { candidates.push(dirname(candidate)); break; }
      }
    }
  } catch { /* 不在 require 路径里 */ }
  for (const c of candidates) if (existsSync(join(c, 'package.json'))) return c;
  return null;
}

function patchFile(file, replacements, marker) {
  if (!existsSync(file)) { log('  跳过（文件不存在）: ' + file); return false; }
  let src = readFileSync(file, 'utf8');
  if (src.includes(marker)) { log('  已加固，跳过: ' + file); return false; }
  let changed = false;
  for (const [from, to] of replacements) {
    if (src.includes(from)) { src = src.replace(from, to); changed = true; }
  }
  if (!changed) { log('  无匹配替换（可能已加固或版本不符）: ' + file); return false; }
  try {
    writeFileSync(file, src, 'utf8');
    log('  ✅ 已补丁: ' + file);
    return true;
  } catch (error) {
    log('  ❌ 写入失败（只读文件系统？）: ' + file + ' — ' + error.message);
    return 'readonly';
  }
}

function doDirectPatch(piAiDir) {
  const dist = join(piAiDir, 'dist', 'utils');
  const estimate = join(dist, 'estimate.js');
  const text = join(dist, 'text.js');

  const estimateReplacements = [
    ['chars += block.text.length;', 'chars += typeof block.text === "string" ? block.text.length : 0;'],
    ['chars += block.thinking.length;', 'chars += typeof block.thinking === "string" ? block.thinking.length : 0;'],
    ['chars += block.name.length + safeJsonStringify(block.arguments).length;',
     'chars += (typeof block.name === "string" ? block.name.length : 0) + safeJsonStringify(block.arguments).length;'],
    ['chars += block.type === "text" ? block.text.length : ESTIMATED_IMAGE_CHARS;',
     'chars += block.type === "text" ? (typeof block.text === "string" ? block.text.length : 0) : ESTIMATED_IMAGE_CHARS;'],
  ];
  const textReplacements = [
    ['for (const text of Object.values(message.sections ?? {})) {\n        if (text !== null)\n            parts.push(text);\n    }',
     'for (const text of Object.values(message.sections ?? {})) {\n        if (typeof text === "string") /* sections-guard */ parts.push(text);\n    }'],
  ];

  const r1 = patchFile(estimate, estimateReplacements, 'typeof block.name === "string"');
  const r2 = patchFile(text, textReplacements, '/* sections-guard */');
  return r1 === 'readonly' || r2 === 'readonly';
}

function installLoaderHook() {
  const dshHome = process.env.DSH_HOME || join(process.env.HOME || process.env.USERPROFILE || '.', '.dsh');
  const hooksDir = join(dshHome, 'hooks');
  mkdirSync(hooksDir, { recursive: true });
  copyFileSync(join(__dirname, 'pi-ai-harden-loader.mjs'), join(hooksDir, 'pi-ai-harden-loader.mjs'));
  const registerPath = join(hooksDir, 'register.mjs');
  writeFileSync(registerPath, "import { register } from 'node:module';\nregister('./pi-ai-harden-loader.mjs', import.meta.url);\n", 'utf8');
  log('✅ 已安装 loader hook: ' + hooksDir);
  log('');
  log('【下一步】让 dsh 进程加载这个 hook：');
  log('  Linux/macOS:  NODE_OPTIONS="--import=' + registerPath + '" dsh ...');
  log('  Windows(cmd): set NODE_OPTIONS=--import=' + registerPath + ' && dsh ...');
  log('  Windows(ps1): $env:NODE_OPTIONS="--import=' + registerPath + '"; dsh ...');
  log('  或在 dsh-web.service 的 systemd override 里加 Environment=NODE_OPTIONS=--import=' + registerPath);
  log('  重启 dsh 后生效；加固日志: /tmp/pi-ai-harden.log');
}

// ── main ──
log('开始加固 pi-ai...');
const piAiDir = findPiAi();
if (!piAiDir) {
  log('未找到 @earendil-works/pi-ai，尝试 loader hook 模式...');
  installLoaderHook();
  process.exit(0);
}
log('定位 pi-ai: ' + piAiDir);

if (forceLoader) {
  installLoaderHook();
  process.exit(0);
}

const readonly = doDirectPatch(piAiDir);
if (readonly) {
  log('检测到只读文件系统，自动切换到 loader hook 模式...');
  installLoaderHook();
} else {
  log('✅ 完成。已直接补丁 pi-ai 的 dist 文件，无需 NODE_OPTIONS，重启 dsh 即生效。');
}
