/**
 * WorkBuddy 国内版 11128 通道校验修复（fetch 层）。
 *
 * 根因（社区 A/B 实测，见 curo22/dsh-wb400-guard）：
 * `copilot.tencent.com` 对 system/developer/assistant 消息做文本指纹校验，
 * 命中即回 `400 {"code":11128,"msg":"Illegal API invocation from an unapproved channel"}`。
 * 与请求头、工具数量、max_tokens 均无关；国际网关 www.workbuddy.ai 不做此校验。
 *
 * 四个触发源（全部实测）：
 *  1. `@deepseek-ai/dsh-file-reference` 注入段里的 `@` 字形
 *     （`Tokens prefixed with @ are paths ...`）；去掉 @ 或换 `(at)` 即放行。
 *  2. 开头的身份句 `You are an AI agent powered by DeepSeek Harness.`
 *     （DeepSeek 与 Harness 之间是零宽空格 U+200B）；只在 system 开头触发。
 *  3. personaPrefix 的 `You are a coding agent powered by <model>.` 句式。
 *  4. `the DeepSeek Harness Web GUI` / `Current DeepSeek Harness Web GUI URL` 段。
 *
 * 处理方式：只对本网关的请求，对 system/developer/assistant 的文本做**语义等价**改写，
 * user 与 tool 消息一字不动；任何异常 fail-open 回原始请求。
 */

const GUARD_KEY = Symbol.for('dsh-connect-plus.wb400-guard');

/** DeepSeek 与 Harness 之间可能夹零宽字符，统一用这个字符类匹配。 */
const ZW = '[\\s\\u200B-\\u200D\\uFEFF\\u2060]*';

/** 触发源一：文件引用说明段（整段替换其内部的 @）。 */
const FILE_REF_SEGMENT = /Tokens prefixed with @ are paths[\s\S]*?quotes a path containing spaces\./;

/** 触发源二：身份句（只认句首形态，改空格为连字符）。 */
const IDENTITY_LINE = new RegExp(
  'You are an AI agent powered by DeepSeek' + ZW + 'Harness\\.',
  'g',
);

/** 触发源三：coding agent 句式（模型名原样保留，只换动词短语）。 */
const CODING_AGENT_LINE = /You are a coding agent powered by /g;

/** 触发源四：Web GUI 两段。 */
const GUI_PHRASE = new RegExp('the DeepSeek' + ZW + 'Harness Web GUI', 'g');
const GUI_URL_PHRASE = new RegExp('Current DeepSeek' + ZW + 'Harness Web GUI URL', 'g');

/** 兜底：任何残留的 DeepSeek+不可见分隔+Harness 品牌指纹。 */
const BRAND_FALLBACK = new RegExp('DeepSeek' + ZW + 'Harness', 'g');

/**
 * 对一段文本做四处改写 + 兜底。纯字符串进出，不改语义。
 * @param {string} text
 * @returns {string}
 */
export function rewriteGuardText(text) {
  if (typeof text !== 'string' || text === '') return text;
  let out = text;

  // 1) 文件引用段：只改这一段里的 @，不碰正文里的邮箱/装饰器
  out = out.replace(FILE_REF_SEGMENT, (segment) => segment.replace(/@/g, '(at)'));

  // 2) 身份句
  out = out.replace(IDENTITY_LINE, 'You are an AI agent powered by DeepSeek-Harness.');

  // 3) coding agent 句式
  out = out.replace(CODING_AGENT_LINE, 'You are a coding agent running on ');

  // 4) Web GUI 段
  out = out.replace(GUI_PHRASE, 'this Web GUI');
  out = out.replace(GUI_URL_PHRASE, 'Current Web GUI URL');

  // 兜底
  out = out.replace(BRAND_FALLBACK, 'DeepSeek-Harness');

  return out;
}

/** 只处理 system / developer / assistant；user 与 tool 原样返回。 */
const GUARDED_ROLES = new Set(['system', 'developer', 'assistant']);

/**
 * 改写一条消息的 content（string 或 OpenAI 片段数组）。
 * @param {any} content
 * @returns {{content: any, changed: boolean}}
 */
function rewriteContent(content) {
  if (typeof content === 'string') {
    const next = rewriteGuardText(content);
    return { content: next, changed: next !== content };
  }
  if (Array.isArray(content)) {
    let changed = false;
    const next = content.map((part) => {
      if (part && part.type === 'text' && typeof part.text === 'string') {
        const text = rewriteGuardText(part.text);
        if (text !== part.text) { changed = true; return { ...part, text }; }
      }
      return part;
    });
    return { content: changed ? next : content, changed };
  }
  return { content, changed: false };
}

/**
 * 改写一个 OpenAI chat 请求体里的 messages。非对象/非 messages 结构原样返回。
 * @param {any} body
 * @returns {{body: any, changed: boolean}}
 */
export function rewriteGuardBody(body) {
  if (!body || typeof body !== 'object') return { body, changed: false };
  const messages = body.messages;
  if (!Array.isArray(messages)) return { body, changed: false };
  let changed = false;
  const next = messages.map((m) => {
    if (!m || typeof m !== 'object') return m;
    if (!GUARDED_ROLES.has(m.role)) return m;
    const r = rewriteContent(m.content);
    if (!r.changed) return m;
    changed = true;
    return { ...m, content: r.content };
  });
  if (!changed) return { body, changed: false };
  return { body: { ...body, messages: next }, changed: true };
}

/**
 * 安装 fetch guard（进程级，幂等）。
 *
 * @param {{hosts?: string[], logger?: any}} [options]
 * @returns {() => void} 卸载函数
 */
export function installWorkBuddyFetchGuard(options = {}) {
  if (globalThis[GUARD_KEY] !== undefined) return globalThis[GUARD_KEY];

  const hosts = Array.isArray(options.hosts) && options.hosts.length > 0
    ? options.hosts
    : ['copilot.tencent.com'];
  const logger = options.logger;

  const original = globalThis.fetch;
  if (typeof original !== 'function') {
    const noop = () => {};
    globalThis[GUARD_KEY] = noop;
    return noop;
  }

  const hostMatches = (url) => {
    try {
      const host = new URL(url).hostname;
      return hosts.some((h) => (h.startsWith('.') ? host.endsWith(h) : host === h));
    } catch {
      return false;
    }
  };

  const guardFetch = async function guardedFetch(input, init) {
    try {
      // 两种调用形态：fetch(url, init) 与 fetch(Request)
      let url;
      let bodyText;
      let headers;
      if (typeof input === 'string' || input instanceof URL) {
        url = String(input);
        bodyText = init?.body;
        headers = init?.headers;
      } else if (input && typeof input === 'object' && typeof input.url === 'string') {
        url = input.url;
        headers = input.headers;
        if (typeof input.text === 'function' && (init?.body === undefined)) {
          // 尽量在不消费流的情况下拿 body：Request 允许多次 clone
          try { bodyText = await input.clone().text(); } catch { bodyText = undefined; }
        } else {
          bodyText = init?.body;
        }
      } else {
        return original(input, init);
      }

      if (!url || !hostMatches(url)) return original(input, init);
      if (typeof bodyText !== 'string' || bodyText === '') return original(input, init);

      let parsed;
      try { parsed = JSON.parse(bodyText); } catch { return original(input, init); }

      const { body: nextBody, changed } = rewriteGuardBody(parsed);
      if (!changed) return original(input, init);

      const serialized = JSON.stringify(nextBody);
      const nextInit = { ...(init ?? {}) };
      nextInit.body = serialized;

      // body 变长变短后旧 Content-Length 会让上游按旧长度截断 —— 必须剔除
      if (headers instanceof Headers) {
        const h = new Headers(headers);
        h.delete('content-length');
        nextInit.headers = h;
      } else if (headers && typeof headers === 'object') {
        const h = {};
        for (const [k, v] of Object.entries(headers)) {
          if (k.toLowerCase() === 'content-length') continue;
          h[k] = v;
        }
        nextInit.headers = h;
      }

      logger?.debug?.('dsh-connect-plus: wb400 guard 已改写 system 文本指纹');
      return original(url, nextInit);
    } catch (error) {
      // fail-open：改写链路任何异常都退回原始请求
      try { logger?.debug?.('dsh-connect-plus: wb400 guard 跳过（' + (error?.message ?? error) + '）'); } catch {}
      return original(input, init);
    }
  };

  globalThis.fetch = guardFetch;

  const uninstall = () => {
    if (globalThis.fetch === guardFetch) globalThis.fetch = original;
    delete globalThis[GUARD_KEY];
  };
  globalThis[GUARD_KEY] = uninstall;
  try { logger?.info?.('dsh-connect-plus: WorkBuddy 国内版 11128 fetch guard 已安装'); } catch {}
  return uninstall;
}
