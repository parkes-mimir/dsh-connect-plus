// lib/dump.js — dsh-connect-plus 统一日志写入模块
//
// 修复 issue #1：日志无上限增长 / Windows 路径错位 / 令牌泄露
//
// 用法（替换 provider 里散落的 appendFileSync）：
//   import { dump, authMark } from '../../dump.js';
//   dump('dispatch-opts.jsonl', JSON.stringify({...}) + '\n');
//   dump('shim-trace.log', `REQ ${req.method} ${req.url} auth=${authMark(req.headers.authorization)}\n`);
//
// 环境变量：
//   DSH_DUMP=0|1|2   0=全关（默认）  1=只记摘要（推荐）  2=全量转储（仅 debug）
//   DSH_DUMP_DIR     覆盖目录，默认 os.tmpdir()/dsh-dump
//   DSH_DUMP_MAX_MB  单文件轮转阈值，默认 200
//   DSH_DUMP_TOTAL_MB 单日总写入上限，默认 500

import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LEVEL = process.env.DSH_DUMP ?? '0';
const DIR = process.env.DSH_DUMP_DIR || join(tmpdir(), 'dsh-dump');
const MAX_BYTES = (Number(process.env.DSH_DUMP_MAX_MB) || 200) * 1024 * 1024;
const TOTAL_BYTES = (Number(process.env.DSH_DUMP_TOTAL_MB) || 500) * 1024 * 1024;

let dirReady = false;
let written = 0;          // 本进程累计写入
let stopped = false;      // 超总量后停写

/** 令牌脱敏：只记是否存在，绝不记内容或前缀 */
export function authMark(h) {
  if (!h) return '<none>';
  const s = String(h);
  // 只区分类型，不泄露任何字符
  if (s.startsWith('Bearer ')) return '<bearer>';
  if (s.startsWith('Basic ')) return '<basic>';
  return '<present>';
}

/** 体积摘要，替代全量 messages 转储 */
export function summarize(opts) {
  const msgs = opts?.messages;
  let msgCount = 0;
  let msgBytes = 0;
  if (Array.isArray(msgs)) {
    msgCount = msgs.length;
    for (const m of msgs) {
      try { msgBytes += JSON.stringify(m).length; } catch { /* skip */ }
    }
  }
  const tools = opts?.tools;
  return {
    model: opts?.model,
    provider: opts?.provider,
    msgCount,
    msgBytes,
    toolCount: Array.isArray(tools) ? tools.length : 0,
    approxTokens: Math.round(msgBytes / 3.5), // 粗估，够定位用
  };
}

/**
 * 写一条日志。
 * @param {string} name  文件名，如 'dispatch-opts.jsonl'
 * @param {string} line  已序列化的一行（调用方自行加 \n）
 */
export function dump(name, line) {
  if (LEVEL === '0' || stopped) return;

  const buf = typeof line === 'string' ? line : String(line);
  const size = Buffer.byteLength(buf);

  // 总量保护：防止高频调用把 IO 打满
  if (written + size > TOTAL_BYTES) {
    if (!stopped) {
      stopped = true;
      try {
        console.warn(`[dsh-dump] 已达单日上限 ${TOTAL_BYTES / 1048576} MB，停止转储`);
      } catch { /* noop */ }
    }
    return;
  }

  try {
    if (!dirReady) {
      mkdirSync(DIR, { recursive: true });
      dirReady = true;
    }

    const file = join(DIR, name);

    // 轮转：超阈值则 file -> file.1（覆盖旧的 .1）
    try {
      if (statSync(file).size > MAX_BYTES) {
        renameSync(file, file + '.1');
      }
    } catch { /* 文件不存在，正常 */ }

    appendFileSync(file, buf);
    written += size;
  } catch { /* 永不因日志失败影响主流程 */ }
}

/** 是否启用全量转储（LEVEL=2 时才有完整 payload） */
export const isVerbose = () => LEVEL === '2';

/** 当前状态，便于排查 */
export function dumpStatus() {
  return { level: LEVEL, dir: DIR, writtenBytes: written, stopped };
}
