// ESM loader hook —— 在加载时加固 pi-ai 崩溃点（适用于 nix store 只读、无法直接改文件的场景）
// 来源：chengshenyangtai/dsh-workbuddy-trae-qoder-connect issue #9 社区修复（v0.3.3）
// ① estimate.js：estimateMessageTokens 的 else 分支 block.name.length（tool-addition/tool-removal 块只有 toolName）
// ② text.js：getSystemMessageText 的 parts.filter(part => part.length)（sections 值可能为 undefined）

export async function load(url, context, next) {
  const result = await next(url, context);
  if (!result || result.source == null) return result;
  const isEstimate = url.includes('/dist/utils/estimate.js');
  const isText = url.includes('/dist/utils/text.js');
  if (!isEstimate && !isText) return result;

  let src = typeof result.source === 'string' ? result.source : Buffer.from(result.source).toString('utf8');
  let changed = false;

  if (isEstimate && !src.includes('typeof block.name === "string"')) {
    const before = src;
    src = src.replace(
      'chars += block.text.length;',
      'chars += typeof block.text === "string" ? block.text.length : 0;'
    );
    src = src.replace(
      'chars += block.thinking.length;',
      'chars += typeof block.thinking === "string" ? block.thinking.length : 0;'
    );
    src = src.replace(
      'chars += block.name.length + safeJsonStringify(block.arguments).length;',
      'chars += (typeof block.name === "string" ? block.name.length : 0) + safeJsonStringify(block.arguments).length;'
    );
    src = src.replace(
      'chars += block.type === "text" ? block.text.length : ESTIMATED_IMAGE_CHARS;',
      'chars += block.type === "text" ? (typeof block.text === "string" ? block.text.length : 0) : ESTIMATED_IMAGE_CHARS;'
    );
    if (src !== before) changed = true;
  }

  if (isText && !src.includes('/* sections-guard */')) {
    const before = src;
    src = src.replace(
      'for (const text of Object.values(message.sections ?? {})) {\n        if (text !== null)\n            parts.push(text);\n    }',
      'for (const text of Object.values(message.sections ?? {})) {\n        if (typeof text === "string") /* sections-guard */ parts.push(text);\n    }'
    );
    if (src !== before) changed = true;
  }

  if (changed) {
    try { (await import('node:fs')).appendFileSync('/tmp/pi-ai-harden.log', '[' + new Date().toISOString() + '] hardened ' + url.split('/').slice(-2).join('/') + '\n'); } catch {}
  }
  return { ...result, source: src };
}
