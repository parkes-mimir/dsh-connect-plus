# dsh-workbuddy-trae-qoder-connect

![三家免费额度，一个模型下拉](assets/social-preview.png)

**WorkBuddy（国区版 + 国际版）、Qoder CN、Trae CN 的免费额度都能在这里用起来。这一个插件把三家接进 DeepSeek Harness：一个模型下拉、一份对话历史，打开面板顺手把能领的积分领掉。国际版另有限时免费模型（`deepseek-v4.1-flash` 当前 `x0.00`）。**

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> **English** — WorkBuddy (China and international), Qoder CN and Trae CN all hand out free quota. This one DSH plugin pools all three into a single model picker with one shared conversation history, and claims the day's check-in for you when the panel opens. The international edition has no check-in campaign but does carry limited-time free models (`deepseek-v4.1-flash` at `x0.00`). Switch channels mid-conversation without losing context, with live credit multipliers, per-model reasoning effort and image input.
---

## 它解决什么

三家的额度散在三个客户端里。想都在 DSH 里用起来，就得装三个插件、开三个面板、维护三套凭据——而且每换一个渠道，对话历史就断一次。同类插件都是单渠道的，这个"散"一直没人收。

| | 三个单渠道插件 | **本插件** |
|---|---|---|
| 免费额度 | 三处分别看 | 一个面板看全部 |
| 模型下拉 | 三块，互不相通 | **一个列表**，按渠道分组，旁标积分倍率 |
| 中途换渠道 | 换插件 / 重开会话 | **直接换**，历史不丢 |
| 每日签到 | 点三次 | **打开面板一次全领** |
| 安装包 | 三个 | **一个** |

三家协议完全不同（OpenAI 方言、私有 agent 协议、带自定义编码的流式响应），插件在中间做翻译，对 DSH 和你来说它们长得一样。

## 你会得到什么

**一个下拉装下三家。** 模型按渠道分组，每个模型旁标着积分倍率，哪个贵一眼可见。Trae CN 的目录最全，独占 `glm-5.3-flash`、`kimi-k2.8-preview`、`qwen3.8-flash` 等；WorkBuddy 国际版带来 `gpt-6-astra`、`grok-4.7`、`deepseek-v4.1-flash`（当前 `x0.00`，白用）这些国区没有的。

**对话中途换渠道，历史不断。** 从 Trae 的模型换到 WorkBuddy 的接着聊，上下文原样带过去。

**签到不用记。** 打开面板自动领当天能领的积分，重复打开也只领一次、不重复扣分。可以在设置里关掉。（国际版没有签到活动，会显示「不适用」；企业号同理。）

**额度看得见。** 每个渠道剩多少积分、按套餐怎么拆、什么时候重置，面板直接显示。

**思考档位是按模型给的。** 每个模型能选哪些档，来自上游目录的声明。点「更新模型」，档位连同目录一起刷新，哪些模型变了会直接告诉你；没手动选档时，新会话自动用该模型声明的默认档。上游没给的档位不硬造——实测「关思考」在两家上游直接返回 400，就不提供这个选项。少数老模型上游不声明档位，设置里留了一键实测补上（消耗少量额度，结果缓存）。

**能干活，不只是聊天。** Agent 工具调用（读文件、跑命令、改代码，Trae 渠道端到端实测过）、按模型开放读图、主力模型普遍 1M 上下文（上游对同一模型声明多档窗口时，插件默认取最大的那档，可在面板里关掉退回默认档）。

**管理和凭据省心。** 渠道就地增删改名，模型勾选即时生效、不用重启；新增渠道时选「国区 / 国际版」，插件按区域去读对应客户端的上游与凭据文件；国际版还能单独选这个槽位是**跟随桌面客户端的登录态**还是**只认自己的凭据**（默认后者）。凭据只写进 0600 权限的本地文件，界面从不回显，仓库里没有任何账号数据。

## 渠道一览

| 渠道 | 接入内容 | 免费额度 | 登录方式 |
|---|---|---|---|
| **WorkBuddy** | 个人版多账号（槽位不限）+ 企业版 | 每日签到领积分 | 脚本生成授权链接，浏览器登录 |
| **WorkBuddy AI 国际版** | 国际版客户端全部模型（GPT-6 / Gemini-3.x / GLM-5.3 / Kimi-K3 / Grok-4.7…） | **限时免费模型**，如 `deepseek-v4.1-flash`（倍率 `x0.00`） | 装客户端后扫码登录，或勾选跟随桌面客户端的登录态 |
| **Qoder CN** | 账号下全部模型 | 每日签到活动 | 官方 PAT，或直接用桌面 App 的登录态 |
| **Trae CN** | IDE 里的全部模型 | 每日签到领积分 | 本机客户端凭据导出 |

国际版（`www.workbuddy.ai`）和国区版是**两个独立客户端**，模型阵容差别很大——国际版有 `gpt-6-astra` / `grok-4.7` / `deepseek-v4.1-flash` 这些国区没有的，国区有 `deepseek-v3-2-volc` 等。装了哪个就自动读哪个；两个都装就两个渠道并排。每个国际版槽位还能单独选**跟随桌面客户端的登录态**（适合只有一份账号）还是**只认自己的凭据**（多账号时的默认，扫码登录互不干扰）。

**国际版没有签到活动**，它的免费额度体现在**限时免费模型**上：`deepseek-v4.1-flash` 当前倍率 `x0.00`，按倍率算不扣积分（倍率是上游实时给的，以模型列表里显示的为准）。国际版凭据是加密存的，插件用客户端自己的 Electron 解封，**不碰钥匙串、不落明文**。

**Trae 现在只有一个产品：Trae CN IDE。** 旧的独立客户端 TRAE SOLO CN 已被厂商并进 IDE（SOLO 变成 IDE 里的一个模式），所以只接 IDE 那一份目录——它也是模型最全的那份：

```bash
node scripts/export-trae-plain.mjs --app cn     # Trae CN IDE（默认，也是唯一在用的）
node scripts/export-trae-plain.mjs --list       # 看本机数据目录的登录态
```

并入前导出的旧 SOLO 快照（`$DSH_HOME/trae/`）仍然照常可用、不用重导；`--app solo` 只为还没迁移的机器保留。

## 安装

前置：DSH 桌面版、Node ^22.19 或 ≥24。在 DSH 插件页粘贴仓库地址，重启一次 DSH，再配凭据：

```
https://github.com/chengshenyangtai/dsh-workbuddy-trae-qoder-connect
```

## 配凭据：把一句话发给 AI

把下面这段复制给你的 AI 助手，剩下的它全包——生成 WorkBuddy 授权链接发到对话里、你浏览器点开授权、它轮询到成功落盘、导出 Trae 凭据、接上 Qoder 登录态，最后汇报各渠道状态与模型数：

```text
跑 scripts/ 下的脚本配好 dsh-workbuddy-trae-qoder-connect 三个渠道的凭据，
WorkBuddy 登录要轮询到成功为止。完成后汇报各渠道状态与模型数，提醒我重启 DSH。
```

想自己跑也行：`scripts/export-trae-plain.mjs`（Trae）、`scripts/workbuddy-login.mjs workbuddy1`（WorkBuddy，第二个账号换 `workbuddy2`，会持续轮询到授权成功）、Qoder 用桌面 App 登录态或把 `pt-…` PAT 存到 `$DSH_HOME/qoder/pat`。新建的账号槽位（如 `workbuddy3`）重启 DSH 后装载。

## 面板

渠道中心 → 设置页：自动签到开关；停用渠道（模型隐藏、不参与签到，凭据保留，随时开回来）；模型勾选「已选 X / 共 N」（改完即生效）；档位实测入口（上游不声明的少数模型用）；侧栏入口开关。「更新模型」按钮按渠道独立刷新。

## 背后怎么做的

不关心可以整段跳过，这里只讲三件值得知道的：

**协议翻译。** 每个渠道在本地起一个中转，把各自的私有协议翻成 OpenAI 方言喂给 DSH。Trae 只有 IDE 一个产品了，产品变体表留着一条历史条目，只服务并入前导出的旧快照。

**档位的真值来源。** 上游声明 ∪ 实测。实测用哨兵拒绝法：先证明请求本身能通，再拿一个随机值探"上游到底校不校验这个字段"，确证它会拒绝才逐档扫描——所以不会把"传什么都收"误判成"所有档位都支持"。一个值得知道的坑：Qoder 的 `dfmodel` 标着"非专用思考模型"，却声明了 3 个档位。**能不能调档看 `thinking_config` 的声明，别看那个布尔。**

**Trae 走本地快照。** Trae 的凭据在客户端加密存储里，目录接口又挑请求头（少给一个就静默返回空壳），所以导出一次、本地读，重跑脚本即刷新。

## 暂不支持

- 插件代码改动需重启 DSH；凭据与产品切换是热生效
- **WorkBuddy AI 国际版没有签到活动**，面板会显示「不适用」（它的免费额度体现在限时免费模型上，如 `deepseek-v4.1-flash` 当前 `x0.00`）
- 少数模型上游只声明一档窗口（如 `kimi-k2.6`），以模型列表里显示的为准

## 开发与验证

- **27 个确定性验证脚本、418 项断言**，不依赖网络、离线可跑，当前全绿；另有 3 个活体脚本做真实上游单点实测。清单与探针纪律见 [probes/README.md](probes/README.md)
- 每处修复都做过**反向验证**：把修复撤掉，对应断言必须变红（`node scripts/reverse-verify-bugfix.mjs`，当前 23 项全部按预期变红）
- 改完代码用 `node scripts/sync-to-profile.mjs` 同步到 profile 里跑着的那份（`--check` 只报差异）。仓库侧的 `lib/**` 与安装副本之间是硬链接，而编辑器"写新文件再改名"会把链接断开——不同步就会出现「改了但重启后没生效」
- 这两个脚本是**维护者工具**，不随安装包分发（`package.json` 的 `files` 里显式排除）：`probes/`、`docs/`、`assets/` 同理，用户装到的只有 `lib/` + `cordis.patch.yml` + 三个面向用户的 CLI（导出 Trae 登录态 / 解 Trae 凭据 / WorkBuddy 扫码登录）
- 历次 bug 修复记在 [CHANGELOG.md](CHANGELOG.md)，不当卖点用
- 设计细节：[docs/CATALOG.md](docs/CATALOG.md) · [docs/TRAE-CN-PRODUCTS.md](docs/TRAE-CN-PRODUCTS.md) · [docs/TRAE-REASONING-EFFORT.md](docs/TRAE-REASONING-EFFORT.md)

## 来源与许可

基于 [yembors64632/dsh-connect](https://github.com/yembors64632/dsh-connect)（MIT），致谢见 [NOTICE](NOTICE)。本插件 MIT 许可。
