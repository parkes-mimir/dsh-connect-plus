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
tail -c 3000000 /tmp/req-dump-qoder.log | grep -oE '"type":"function","function":\{"name":"[^"]*"' | sed 's/.*"name":"//;s/"$//' | sort -u | wc -l
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
grep -o '"tools":\[' /tmp/dispatch-opts.jsonl | wc -l   # 应有值
# 或在 dispatch-opts.jsonl 里看 options.tools 元素是否有 function 字段
```

**修复**：v0.3.3-plus.3 已修——`toTraeTools` / `toTraeToolCalls` 改为 `const fn = t?.function ?? t`，兼容扁平与嵌套两种格式。升级到 v0.3.3-plus.3 即可。

---

### 五、WorkBuddy 专用类

#### 12. WorkBuddy 国内版报 `11128 Illegal API invocation from an unapproved channel`

**症状**：WorkBuddy 国内版发消息报 400，`code: 11128`，`msg: "Illegal API invocation from an unapproved channel"`，`displayTips` 提示 "This call failed channel verification, possibly because it was not sent from an official client"。

**根因**：WorkBuddy 国内版已上线与国际版相同的 conversation id 校验。`chatHeaders` 原先只在国际版（`region === "global"`）加 `X-Conversation-*` 头，国内版故意不带（旧假设：只在国际版观察到）。国内网关现在也校验这四个头，缺了就拦。

**修复**：v0.3.3-plus.4 已修——`chatHeaders` 无条件带 `X-Conversation-ID` / `X-Conversation-Request-ID` / `X-Conversation-Message-ID` / `X-Root-Request-ID`（每次请求用 `randomUUID()` 生成）。升级到 v0.3.3-plus.4 即可。

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

```bash
# 1. 看插件是否加载
journalctl --user -u dsh-web -n 300 | grep -iE "dsh-connect|dsh-workbuddy|dsh-trae|dsh-qoder"

# 2. 看请求/响应原始帧（排查 DSML / 流式问题）
tail -f /tmp/shim-frames.log          # workbuddy/trae shim 出口
tail -f /tmp/qoder-err.log            # qoder 错误详情
tail -f /tmp/pi-ai-harden.log         # pi-ai 加固日志

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
- 本版本：`dsh-connect-plus@0.3.3-plus.1`
- 补丁来源：社区 issue #9（pi-ai）+ 实战 DSML/tailfix/userinfo/502/SSE 修复
