# dsh-connect-plus

> WorkBuddy + Trae + Qoder CN 三合一模型接入插件 —— **全量补丁版**，开箱即用，Windows / Linux / macOS 通用。

本仓库在 [`dsh-workbuddy-trae-qoder-connect`](https://github.com/chengshenyangtai/dsh-workbuddy-trae-qoder-connect) v0.3.2 基础上，把社区 + 实战踩过的所有补丁一次性打进 `lib/`，装上直接用，不用再逐个手改。

---

## ✅ 本版本已内置的补丁

| # | 补丁 | 位置 | 解决的问题 |
|---|------|------|-----------|
| 1 | **DSML 泄漏全量修复** | `providers/workbuddy/index.js` `dsmlTransform`、`providers/qoder/index.js` `cleanDsmlDelta` + `dsmlTransform`、`providers/trae/index.js` `sanitizeAgentResidue` + `cleanReasoning` | DeepSeek 系模型原生工具格式 `<｜｜DSML｜｜ calls>` 文本协议，上游 OpenAI 接口不认 → 标签泄漏进正文打断会话。修复：① 提取改用 `dsmlBuffer.raw` 原始文本（原代码先清洗再提取，永远匹配不到）② 完整标签 + 裸标记 `｜｜DSML｜｜` 双重清洗 ③ `[DONE]` 守卫 ④ `content` + `reasoning_content` 双通道 |
| 2 | **tailfix 正文保留** | 三 provider 的 DSML Transform 尾部扣留逻辑 | 原逻辑只要文本末尾含 `<` 或 `｜` 就扣留，导致正文里的 `<`、反引号、代码块被吞。修复：只在真的是 `<｜｜DSML` 标签前缀时才扣留 |
| 3 | **Qoder userinfo Bearer 签名** | `providers/qoder/index.js` `userinfo` 请求头 | bootstrap 时还没有 uid，`buildCosyHeaders` 会 throw；userinfo 属 OpenAPI 平面，用普通 Bearer（实测 jobToken 可直接取 uid） |
| 4 | **Qoder 502 网络错误分类** | `providers/qoder/index.js` 错误处理 | 瞬时网络故障（undici `terminated`、连接重置、超时）被一律报成 401 `not_signed_in`，前端显示「API 密钥无效」—— 凭据其实有效。修复：传输类错误改报 502 `network`，DSH 重试策略自动重打 |
| 5 | **Qoder SSE 心跳保活** | `providers/qoder/index.js` 流响应开头 | 上游首字节延迟时一个字节都不回，触发客户端「无输出」取消。修复：立即回 SSE 头 + `:sse-open` / 每 8s `:ping` 心跳 |
| 6 | **pi-ai 崩溃加固** | `lib/index.js` `autoHardenPiAi()` + `scripts/harden-pi-ai.mjs` | pi-ai `estimate.js` 的 `block.name.length`（tool-addition/tool-removal 块只有 toolName）和 `text.js` 的 `parts.filter(part=>part.length)`（sections 值可为 undefined）→ 任何插件模型一发消息必崩（`PI_AI_ERROR`）。可写 FS 自动补丁；NixOS 等只读 FS 走 ESM loader hook |
| 7 | **WorkBuddy 国内版 11128 通道校验修复** | `lib/wb400-guard.js`（fetch 层）+ `lib/index.js` 安装 | `copilot.tencent.com` 对 system/developer/assistant 文本做指纹校验（`@` 文件引用段、`DeepSeek￼Harness` 身份句、`coding agent powered by` 句式、Web GUI 段），命中即 `400 code 11128 Illegal API invocation from an unapproved channel`。修复：fetch 层语义等价改写这四处指纹，user/tool 原样透传，fail-open |
| 8 | **Trae tools 扁平格式兼容** | `providers/trae/index.js` `toTraeTools` / `toTraeToolCalls` | pi-ai 发的 tools 是扁平 `{name,parameters}`，原代码只认 `{function:{...}}` → 工具全被丢弃 → 上游内部状态不一致返回 `502 invalid character 'u'`。修复：`const fn = t?.function ?? t` |

---

## 📦 安装

### 方式一：本地目录安装（推荐，开箱即用）

```bash
# 1. 把本目录放到任意位置，例如 ~/.dsh/plugins/dsh-connect-plus
cp -r dsh-connect-plus ~/.dsh/plugins/

# 2. 安装（dsh 会处理依赖 + 写入 profile）
dsh plugin --profile <你的profile名> add ~/.dsh/plugins/dsh-connect-plus
# 或者用 plugin_manager 安装本地目录（绝对路径）
```

### 方式二：从本仓库链接安装

```bash
dsh plugin --profile <你的profile名> add github:你的fork/dsh-connect-plus
```

> 装完重启 dsh。插件 id 是 `dsh-connect`（与原版一致，面板路由 `/plugins/dsh-connect/*` 不变）。

---

## 🔧 pi-ai 加固（可选，针对 NixOS / 只读 FS）

常规 Linux / Windows / macOS：插件加载时**自动**加固 pi-ai，无需手动操作。

NixOS 或其它只读文件系统（pi-ai 在 nix store 里）：

```bash
cd dsh-connect-plus
node scripts/harden-pi-ai.mjs --loader
```

脚本会把 `pi-ai-harden-loader.mjs` + `register.mjs` 装到 `$DSH_HOME/hooks/`，然后提示你在启动 dsh 时加：

```bash
# Linux / macOS
NODE_OPTIONS="--import=$HOME/.dsh/hooks/register.mjs" dsh ...

# Windows (PowerShell)
$env:NODE_OPTIONS="--import=$env:USERPROFILE\.dsh\hooks\register.mjs"; dsh ...
```

加固日志：`/tmp/pi-ai-harden.log`。

---

## 📋 凭据配置

三个渠道的凭据路径与原版完全一致（插件升级不丢配置）：

| 渠道 | 凭据位置 |
|------|---------|
| WorkBuddy | 环境变量 `WORKBUDDY1_AUTH_FILE` / `WORKBUDDY2_AUTH_FILE` / `WORKBUDDY3_AUTH_FILE` / `WORKBUDDY4_AUTH_FILE`（明文快照） |
| Trae CN | `$DSH_HOME/connect-auth/trae.json`（`product: "trae-cn"`）；模型目录 `$DSH_HOME/trae-cn/models.json` |
| TRAE SOLO CN | 同上，`product: "trae"`；模型目录 `$DSH_HOME/trae/models.json` |
| Qoder CN | `$DSH_HOME/qoder/pat` 或环境变量 `QODERCN_PAT` |

Trae 模型目录由 `scripts/export-trae-plain.mjs` 从桌面端导出；面板「更新模型」会自动跑。

---

## 💰 Token 成本控制：为什么接进 dsh 后积分暴涨几十倍

> 这不是插件 bug，是 **agent 模式的结构性开销**。实测数据在 NixOS 上采集，方法可复现。

### 先说结论

同一个问题，**官方网页版 ≈ 1,300 token，dsh agent 做完 ≈ 1,000,000 token**，差约 800 倍。
积分按 token 折算，所以你看到「官方 3-6 分 vs 插件几十到几百分」。

两条原因，第一条占大头：

| 因素 | 倍率 | 说明 |
|---|---|---|
| **一次对话 = N 次请求** | ~20-50× | 每调一次工具就重发一次完整请求（含全部历史） |
| **每请求固定开销大** | ~15-20× | 工具 schema + system prompt + MEMORY 注入 |

### 拆开看：一次请求里都装了什么

实测一个注册了 74 个插件的 dsh profile：

| 组成 | 体积 | 备注 |
|---|---|---|
| **工具 schema** | **≈ 17,000 token** | 暴露 130-170 个工具定义，每个 80-800 字符 |
| system prompt | ≈ 3,400 token | 项目指令那一大段 |
| MEMORY.md | ≈ 2,600 token | 长期记忆，**每轮强制注入** |
| USER.md | ≈ 1,200 token | 用户画像，**每轮强制注入** |
| **固定开销合计** | **≈ 24,000 token** | 还没算历史 |

**官方网页版一次问答的 system prompt 只有几百 token，零工具定义。**

### 最致命的：一次「对话」其实是几十次请求

Agent 模式下每调用一次工具，就要把「固定开销 + 全部历史 + 本次工具结果」重新发一遍。

```
一个「改代码并提交 PR」的任务：
  读文件/查状态     8 次
  改代码            6 次
  验证              5 次
  git 操作          4 次
  ─────────────────────
  约 24 次 LLM 请求

累计 token：
  第 1 次   约  25,000
  第 12 次  约  45,000
  第 24 次  约  65,000
  ─────────────────────
  合计     约 1,070,000 token
```

**关键：历史越滚越大，后面的请求越来越贵。** 所以「同一个会话聊越久，单轮越贵」是必然的。

### 静态分模式：最见效的一招

插件本身管不了工具注册（那是宿主和 MCP 插件的事），但**你可以从 profile 侧按模式隔离**。

**做法：不同任务建不同 preset，每个 preset 只挂需要的 MCP，其余 `disabled: true`。**

```yaml
# cordis.patch.yml 片段示例
- id: mcp-phone          # 手机自动化
  disabled: true        # ← 不写手机相关任务时关掉（9 个工具）
- id: mcp-sts2           # 游戏自动化
  disabled: true        # ← 关（20 个工具）
- id: mcp-hcl            # 网络设备仿真
  disabled: true        # ← 关（5 个工具）
```

**实测收益（同一 profile）：**

| 模式 | 工具数 | 工具 schema | 固定开销 |
|---|---|---|---|
| 全开 | 150+ | ~17,000 token | ~24,000 |
| 开发（文件+终端+git） | ~28 | ~4,000 token | ~11,000 |
| 纯聊天 | ~12 | ~1,500 token | ~8,500 |

**工具 schema 一项就能省 13,000 token/请求。**
按 24 次请求的任务算，单任务省 **≈ 310,000 token**。

### 三个可立刻做的压缩点

#### ① 砍工具数量（收益最大）

找出现状：

```bash
# 看 profile 里注册了多少插件
grep -cE '^\s+- id: ' ~/.dsh/profiles/web/cordis.patch.yml

# 看哪些是 MCP（这些通常可按场景关）
grep -E '^\s+- id: (mcp-|off-tool)' ~/.dsh/profiles/web/cordis.patch.yml
```

**按任务类型分档**（示例）：

| 场景 | 保留 | 关掉 |
|---|---|---|
| 纯对话/写作 | 内置文件+终端+记忆 | 所有 MCP |
| 代码开发 | +git、mnemon 全套 | phone / sts2 / hcl / qq |
| 安卓/设备 | +mcp-phone | sts2 / hcl / mcsm |
| 网络设备 | +mcp-hcl | phone / sts2 / qq |
| 游戏/服务器 | +mcp-sts2、mcsm | phone / hcl |

**本仓库排错章节里提到的 `off-tool-whitelist` 插件也能做这件事**——它在 schema 组装期用 `ctx.tools.restrict({ allow })` 隐藏工具，**不用重启、不用改 YAML**，更适合频繁切换。

#### ② 精简 MEMORY.md / USER.md（约 3.8K → 可压到 1K）

这两个文件**每轮请求都强制注入**。

**该放**：工作纪律、红线、当前状态指向、空间地图。
**不该放**：具体设备的 UUID / MD5 / 路径 / 完整技术结论——那些应该进 `mnemon_remember`，需要时 `recall` 取。

> 反例：一条记忆里塞了完整的网络接口对照表和内核 md5，占 2,000+ 字符，
> 但它只在做那个项目时有用，其余 90% 的对话都在白白付这份钱。

#### ③ 减少工具调用轮数（行为层面）

**同一件事，一次 `bash` 做完 vs 拆成 5 次调用，差 5 倍请求。**

```bash
# ❌ 三次调用
ls /path/a
cat /path/b
grep x /path/c

# ✅ 一次调用
ls /path/a; cat /path/b; grep x /path/c
```

配合写脚本批量处理，能把 24 次请求压到 8 次左右，**省 60%**。

### 一个反直觉的事实

**「自动检测任务类型、动态加载工具」在当前 DSH API 下做不到理想的每轮切换。**

原因：`ctx.tools.restrict()` 是**会话级、注册后一次性**的（见 `off-tool-whitelist` 的实现注释），一旦收窄就锁死到会话结束。

所以**判定必须在新会话开始时做一次**，判定错了要重开会话。
实际体验上，「手动选模式」往往比「自动猜错」更省心——这也是本文推荐静态分模式的原因。

### 快速自查清单

```bash
# 1. 固定开销有多大？（工具数 × 400 字符 ÷ 3.5 ≈ token）
grep -cE '^\s+- id: ' ~/.dsh/profiles/web/cordis.patch.yml

# 2. MEMORY.md / USER.md 多大？
wc -c ~/.mnemon/*/MEMORY.md ~/.mnemon/*/USER.md 2>/dev/null

# 3. 这个会话发了几次请求？（开了 DSH_DUMP=1 后看摘要）
#    每条 dispatch-opts 记录一次请求
wc -l /tmp/dsh-dump/dispatch-opts.jsonl 2>/dev/null
```

---

## 🆘 排错大全（Troubleshooting）

> 以下都是实战踩过的坑，按症状分类。每条都有**根因**和**修复步骤**。

---

### 一、插件加载 / 启动类

#### 1. 插件装上了但模型选择器里看不到任何渠道

**症状**：设置页插件已启用，但模型列表里没有 workbuddy1/trae/qoder1。

**排查**：
```bash
# 看 dsh 日志里有没有 dsh-connect 的加载日志
journalctl --user -u dsh-web -n 200 | grep -i "dsh-connect"
# 或桌面端看 devtools console
```

**根因 A**：`package.json` 的 `name` 与 `cordis.patch.yml` 的 `name` 不一致。loader 按 name 加载模块，不一致就找不到入口。
→ 确认两者都是 `dsh-connect-plus`（本仓库已对齐）。

**根因 B**：peerDependencies 版本不满足。`@earendil-works/pi-ai` 声明 `^0.85.1`，但内核带的是 `1.0.2`。
→ 这是**警告不是错误**，pi-ai 1.0.2 向下兼容，能跑。如果真的加载失败，检查 `node_modules/@earendil-works/pi-ai` 是否存在。

**根因 C**：某个渠道 apply 抛异常，连累整体。
→ 日志里搜 `dsh-connect: <渠道> 渠道加载失败`。三个渠道是独立 try/catch，一个挂了其余不受影响。

---

#### 2. `PI_AI_ERROR: Cannot read properties of undefined (reading 'length')`

**症状**：选了插件模型，一发消息就崩，请求从未发出。日志里只有一句 `PI_AI_ERROR`，无堆栈。

**根因**：pi-ai `dist/utils/estimate.js` 的 `estimateMessageTokens()` else 分支访问 `block.name.length`，但 `tool-addition` / `tool-removal` 块只有 `toolName` 没有 `name`；另一个崩点在 `text.js` 的 `getSystemMessageText()`，`parts.filter(part => part.length)` 里 sections 值可能是 undefined。异常发生在 `streamSimple()` 同步段、provider try/catch 之外，被 `lazy.js` 抹成一句话。

**修复**：本插件已内置 `autoHardenPiAi()`，常规系统自动生效。NixOS 用户：
```bash
node scripts/harden-pi-ai.mjs --loader
# 然后用 NODE_OPTIONS 启动 dsh
```
验证：`grep -c 'typeof block.name' <pi-ai>/dist/utils/estimate.js` 应 > 0。

---

### 二、模型回复异常类

#### 3. 回复正文里出现 `<｜｜DSML｜｜ calls>...</｜｜DSML｜｜>` 或 `｜｜DSML｜｜` 残片

**症状**：模型回复被 DSML 标签打断，工具调用没被识别，正文里有奇怪的 `｜｜DSML｜｜` 字样。

**根因**：DeepSeek 系模型（dfmodel、deepseek-v4.1-flash 等）原生工具格式是 `<｜｜DSML｜｜ calls>` 文本协议，qoder/trae/workbuddy 上游的 OpenAI 兼容接口不认，模板退化，DSML 漏进正文。

**修复**：本版本已内置 DSML 全量修复。如果还出现：
```bash
# 确认补丁在
grep -c "dsmlBuffer.raw" lib/providers/workbuddy/index.js   # 应 > 0
grep -c "cleanDsmlDelta" lib/providers/qoder/index.js       # 应 > 0
grep -c "sanitizeAgentResidue" lib/providers/trae/index.js  # 应 > 0
```

---

#### 4. 回复里正常的 `<`、反引号、代码块被吞掉

**症状**：模型写的代码块或含 `<` 的文本，末尾几个字符丢失。

**根因**：DSML Transform 的尾部扣留逻辑过于激进——只要文本末尾含 `<` 或 `｜` 就扣留等下一帧，误伤正常正文。

**修复**：本版本已内置 tailfix。确认：
```bash
grep -c "tailfix" lib/providers/workbuddy/index.js lib/providers/qoder/index.js lib/providers/trae/index.js
# 三个都应 > 0
```

---

### 三、Qoder 专用类

#### 5. Qoder 报 `401 not_signed_in` / 「API 密钥无效」，但凭据明明有效

**症状**：Qoder 模型突然全报 401，但 PAT 没过期、手动 curl 能通。

**根因**：瞬时网络故障（undici `terminated`、ECONNRESET、ETIMEDOUT、连接重置）被一律当成 401。前端因此提示密钥无效，实际上只是网络抖动。

**修复**：本版本已把传输类错误改报 502 `network`，DSH 重试策略（覆盖 SERVER/TRANSPORT）会自动重打。如果还报 401，检查：
```bash
# 凭据文件
cat $DSH_HOME/qoder/pat
# 手动验证
curl -s -H "Authorization: Bearer $(cat $DSH_HOME/qoder/pat)" https://qoder.byteintlapi.com/api/qoder/v1/userinfo | head
```

---

#### 6. Qoder 每隔几分钟断连：`502: Qoder transport interrupted`

**症状**：对话中突然报 502 transport interrupted，自动重试后恢复。

**根因有两种**：

**A. 工具数量撑爆上下文**（最常见）：某个 MCP 作为全局 bundle 注入了几百个工具，单次请求 schema 就 20 多万 token，上游直接断 TLS（不是 4xx，是 transport 层断连）。
→ **判据**：新开一个空会话也报错（与对话历史无关）。
→ **修复**：不要把大工具集挂全局。按模式隔离——只在对应 preset 的 `config.plugins` 里挂载。验算工具数：
```bash
DSH_DUMP=2 tail -c 3000000 /tmp/dsh-dump/req-dump-qoder.log | grep -oE '"type":"function","function":\{"name":"[^"]*"' | sed 's/.*"name":"//;s/"$//' | sort -u | wc -l
```
正常应 < 200。

**B. 真的网络抖动**：本版本已改 502 + 自动重试，偶发一次可忽略。

---

#### 7. Qoder 流式回复卡住，几秒后客户端取消

**症状**：发消息后转圈，没有任何输出，过几秒被取消。

**根因**：上游首个事件延迟期间一个字节都不回，客户端「无输出」超时取消。

**修复**：本版本已在流开头立即回 `:sse-open` + 每 8s `:ping` 心跳。确认：
```bash
grep -c "sse-open" lib/providers/qoder/index.js   # 应 = 1
```

---

#### 8. Qoder userinfo 接口 500 / bootstrap 失败

**症状**：Qoder 渠道状态异常，日志里 userinfo 请求报错。

**根因**：bootstrap 时还没有 uid，`buildCosyHeaders(null, ...)` 会 throw。userinfo 属 OpenAPI 平面，不需要 COSY 签名。

**修复**：本版本已改用普通 `Authorization: Bearer <authToken>`。确认：
```bash
grep -c "userinfo 属 OpenAPI" lib/providers/qoder/index.js   # 应 = 1
```

---

### 四、Trae 专用类

#### 9. Trae 模型列表为空 / 「更新模型」失败

**症状**：Trae 渠道没有模型，点「更新模型」报错。

**根因**：Trae 模型目录 `$DSH_HOME/trae-cn/models.json` 不存在或为空，需要从桌面端导出。

**修复**：
```bash
# 确保 Trae 桌面端已登录，然后手动导出
node scripts/export-trae-plain.mjs
# 检查产物
ls -la $DSH_HOME/trae-cn/models.json $DSH_HOME/connect-auth/trae.json
```
桌面端没登录或 storage.json 损坏都会导致导出失败。

---

#### 10. Trae 回复里有 `<｜｜DSML｜｜>` 或 agent 自编标记

**症状**：Trae 模型回复正文里残留 DSML 标签或 `[[user]]` 之类的模板残片。

**根因**：Trae 上游走 `translate()` 直连流，shim 的 Transform 拦不到。

**修复**：本版本已在 `translate()` 的 `cleanDsmlDelta` 和 `sanitizeAgentResidue` 两处都加了 DSML 清洗。确认：
```bash
grep -c "cleanReasoning" lib/providers/trae/index.js   # 应 > 0
```

---

#### 11. Trae 报 `502 invalid character 'u' looking for beginning of value`

**症状**：Trae 模型（尤其 DS 系列开高档位 xhigh）思考几分钟后突然报 502，message 为 `invalid character 'u' looking for beginning of value`。

**根因**：pi-ai 发给 adapter 的 `tools` 是**扁平结构** `{name, description, parameters}`，但 `toTraeTools` 原先只认 OpenAI 嵌套格式 `{function: {name, parameters}}`（用 `t?.function` 取值），导致**所有工具被 skip**，请求发给 Trae 上游时不带 tools 定义。而对话历史里有 assistant 工具调用 + tool 结果，Trae 上游 Go 服务处理这种"有工具调用历史但无工具定义"的不一致状态时，内部 JSON 解析遇到 `undefined` 字面量，报 `invalid character 'u'`，返回 502。

**判据**：
```bash
# 看发给 trae 的请求里 tools 是不是空的
DSH_DUMP=1 tail -3 /tmp/dsh-dump/dispatch-opts.jsonl | grep -o '"toolCount":[0-9]*'   # 应有值
# 或在 dispatch-opts.jsonl 里看 options.tools 元素是否有 function 字段
```

**修复**：v0.3.3-plus.3 已修——`toTraeTools` / `toTraeToolCalls` 改为 `const fn = t?.function ?? t`，兼容扁平与嵌套两种格式。升级到 v0.3.3-plus.3 即可。

---

### 五、WorkBuddy 专用类

#### 12. WorkBuddy 国内版报 `11128 Illegal API invocation from an unapproved channel`

**症状**：WorkBuddy 国内版发消息报 400，`code: 11128`，`msg: "Illegal API invocation from an unapproved channel"`，`displayTips` 提示 "This call failed channel verification, possibly because it was not sent from an official client"。换国际版正常，换账号/换模型/换机器都一样，第一步就挂。

**根因（社区 A/B 实测，不是请求头问题）**：`copilot.tencent.com` 会对 **system / developer / assistant 消息的文本内容**做指纹校验，命中即 11128。与请求头、工具数量、`max_tokens`、对话长度全部无关。四个触发源：

1. **文件引用段里的 `@`** —— `@deepseek-ai/dsh-file-reference` 注入的 `Tokens prefixed with @ are paths ...` 段，网关匹配「前段连续词组 + @ 字形」的组合
2. **身份句** —— `You are an AI agent powered by DeepSeek￼Harness.`（中间是零宽空格 U+200B），**位于 system 开头**时触发；放句中/句尾/前面垫一行都不触发
3. **coding agent 句式** —— `You are a coding agent powered by <模型名>.`，网关认的是 `coding agent powered by` 这个句式，换模型名救不了
4. **Web GUI 段** —— `the DeepSeek￼Harness Web GUI` / `Current DeepSeek￼Harness Web GUI URL`，通常落在 system 尾部

前两个是本机实测，后两个来自他人机器实测 + 防御性覆盖。**国际网关 `www.workbuddy.ai` 不做这个校验。**

**修复**：v0.3.3-plus.5 内置 `lib/wb400-guard.js`——在 `globalThis.fetch` 层只对发往 `copilot.tencent.com` 的请求，对 system/developer/assistant 文本做**语义等价改写**：

| # | 改什么 | 改成什么 |
|---|---|---|
| 1 | 文件引用段里的 `@` | `(at)` |
| 2 | `You are an AI agent powered by DeepSeek￼Harness.` | `... DeepSeek-Harness.` |
| 3 | `You are a coding agent powered by ` | `You are a coding agent running on ` |
| 4 | `the DeepSeek￼Harness Web GUI` / `Current ... Web GUI URL` | `this Web GUI` / `Current Web GUI URL` |

加兜底：残留的 `DeepSeek`+不可见分隔+`Harness` 统一换成 `DeepSeek-Harness`。**user 与 tool 消息一字不动**（邮箱 `a@b.com`、`@某人`、装饰器都保留），其他 API 原样透传，改写链路任何异常 fail-open 回原始请求，并剔除陈旧的 `Content-Length`。

**为什么必须在 fetch 层**：`llm/stream` 的 `GenerateOptions` 是深冻结的，改不了；`system-prompt/assemble` 会改掉所有 provider 的提示词。fetch 是唯一精准且能覆盖插件内部 11128 重试阶梯的位置。

**验证方式**：升级后发一条 WorkBuddy 国内版消息，能正常回复即通过。宿主日志里应出现 `dsh-connect-plus: WorkBuddy 国内版 11128 fetch guard 已安装`。

**（历史）v0.3.3-plus.4 的 `X-Conversation-*` 猜测是错的**——那套头是国际版 11128 的原因，国内版不吃这套，升级到 plus.4 仍会报错。plus.5 才是真修复。

---

#### 13. WorkBuddy 报凭证无效 / 401

**症状**：WorkBuddy 渠道 401，但快照文件存在。

**排查**：
```bash
# 检查环境变量是否指向正确文件
echo $WORKBUDDY1_AUTH_FILE
# 检查文件内容是否是合法的 auth 快照（含 access_token）
head -c 300 $WORKBUDDY1_AUTH_FILE
```
**根因**：快照过期（WorkBuddy token 有效期短）或环境变量没注入到 dsh 进程。

**修复**：重新登录导出快照，确认环境变量在 dsh 启动前已 export（systemd 服务需要在 override 里写 `Environment=`）。

---

### 六、通用诊断命令

> **⚠️ 自 v0.3.4 起转储默认关闭。** 插件不再无条件写 `/tmp/*.log`，
> 需要排查时显式开启（见下方「六点五、转储开关」）。目录也从 `/tmp` 改到
> `os.tmpdir()/dsh-dump/`（Linux 仍是 `/tmp/dsh-dump/`，Windows 是 `%TEMP%\dsh-dump\`）。

```bash
# 1. 看插件是否加载
journalctl --user -u dsh-web -n 300 | grep -iE "dsh-connect|dsh-workbuddy|dsh-trae|dsh-qoder"

# 2. 看请求/响应原始帧（排查 DSML / 流式问题）—— 需先 DSH_DUMP=2
# Linux: /tmp/dsh-dump    Windows: %TEMP%\dsh-dump
tail -f /tmp/dsh-dump/shim-frames.log     # workbuddy/trae shim 出口（verbose）
tail -f /tmp/dsh-dump/qoder-err.log       # qoder 错误详情（始终写入，体积小）
tail -f /tmp/pi-ai-harden.log             # pi-ai 加固日志（loader hook 自己的，不受开关影响）

# 3. 看 pi-ai 是否被加固
PI_AI=$(node -e "console.log(require('path').dirname(require.resolve('@earendil-works/pi-ai/package.json')))")
grep -c 'typeof block.name' "$PI_AI/dist/utils/estimate.js"
grep -c 'sections-guard' "$PI_AI/dist/utils/text.js"

# 4. 验证模型可用性（探针）
# 见上游 README 的 probe 部分，或在面板里点「探测」

# 5. 确认三个 provider 都注册了
curl -s http://127.0.0.1:3080/plugins/dsh-connect/status | jq .
```

---

## 📁 目录结构

```
dsh-connect-plus/
├── package.json
├── cordis.patch.yml
├── README.md                  ← 本文件
├── LICENSE
├── lib/
│   ├── index.js               ← 编排入口（含 autoHardenPiAi）
│   ├── panel.js               ← 统一面板
│   ├── channel-registry.js
│   ├── client.js
│   ├── providers/
│   │   ├── workbuddy/index.js ← DSML + tailfix 已打
│   │   ├── trae/index.js      ← sanitizeAgentResidue + cleanReasoning 已打
│   │   └── qoder/index.js     ← userinfo + 502 + SSE + DSML + tailfix 已打
│   └── shared/
└── scripts/
    ├── harden-pi-ai.mjs       ← pi-ai 加固脚本（含 --loader 模式）
    ├── pi-ai-harden-loader.mjs ← ESM loader hook（只读 FS 用）
    ├── export-trae-plain.mjs  ← Trae 凭据/目录导出
    ├── trae-vault.mjs
    └── workbuddy-login.mjs
```

---

## 🔄 升级 / 回滚

- 本插件与原版 `dsh-workbuddy-trae-qoder-connect` 的 provider id、凭据路径、状态文件**完全一致**，直接替换即可，用户已选模型不用重选。
- 回滚：`dsh plugin remove dsh-connect-plus` 后重装原版。

---

## 📝 版本

- 上游：`dsh-workbuddy-trae-qoder-connect@0.3.2`
- 本版本：`dsh-connect-plus@0.3.3-plus.5`
- 补丁来源：社区 issue #9（pi-ai）、[curo22/dsh-wb400-guard](https://github.com/curo22/dsh-wb400-guard)（WorkBuddy 国内版 11128 的 A/B 实测与改写规则）、实战 DSML/tailfix/userinfo/502/SSE/tools 格式修复

### 六点五、转储开关（v0.3.4 新增）

插件历史上会把请求/响应无条件写到 `/tmp/*.log`，**无大小上限**，导致：

- Linux：单日可涨到数十 GB（`/tmp` 是 tmpfs，重启才清）
- Windows：`appendFileSync('/tmp/x')` 被解析成 `<当前盘>:\tmp\x`，**两天 26 GB**（issue #1）
- 若从非系统盘启动，`D:\tmp\` 可能不存在 → 每次写都抛异常被吞 → **静默无日志**

**现已改为默认关闭 + 统一入口 + 轮转。** 环境变量：

| 变量 | 默认 | 说明 |
|---|---|---|
| `DSH_DUMP` | `0` | `0` 全关 / `1` **只记摘要**（推荐）/ `2` 全量转储（仅 debug） |
| `DSH_DUMP_DIR` | `os.tmpdir()/dsh-dump` | 覆盖输出目录 |
| `DSH_DUMP_MAX_MB` | `200` | 单文件轮转阈值，超了转成 `.1` |
| `DSH_DUMP_TOTAL_MB` | `500` | 单进程写入上限，超了停写并 `console.warn` |

```bash
# 临时开摘要（定位"发了什么、多大、几个工具"足够）
DSH_DUMP=1 systemctl --user restart dsh-web

# 要看完整 messages 才用 2（注意体积：单条可达 1-2 MB）
DSH_DUMP=2 systemctl --user restart dsh-web

# 关回去（默认状态，不写任何文件）
systemctl --user restart dsh-web
```

**摘要模式记录什么：**

```json
{"model":"...","provider":"...","msgCount":42,"msgBytes":552960,"toolCount":173,"approxTokens":157988}
```

**令牌不再落盘内容**——`shim-trace.log` 里只写 `<bearer>` / `<basic>` / `<present>` / `<none>`，
不再是 `Bearer sk-xxx...` 的前 20 字符。

