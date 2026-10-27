# 研学资料问答接入说明（知识库 + 通义千问）

更新时间：2026-10-27

## 目标与边界

- 问答链路固定为：固定信息查询 → 知识库检索 → 模型整理 → 返回答案、来源与状态。
- 模型只允许整理检索到的资料，不得补充资料外的事实；资料不足时返回“资料库暂未收录”。
- 默认使用本地 Mock Provider，不依赖任何外部平台；配置 `DASHSCOPE_API_KEY` 后切换到通义千问。
- 本模块不涉及音频播放器、AR 状态机、后台其他模块和无关页面。
- 未上传 CloudBase、未发布微信版本；API Key 只允许放在云函数环境变量中，不进入代码、`data.json`、提交或 PR 截图。

## 代码位置

| 位置 | 作用 |
|---|---|
| `frontend/cloudfunctions/bijiang-api/assistant/knowledge.js` | 知识条目构建、固定信息、检索打分 |
| `frontend/cloudfunctions/bijiang-api/assistant/providers.js` | Provider 接口、Mock Provider、通义千问 Provider |
| `frontend/cloudfunctions/bijiang-api/assistant/chat.js` | 问答编排、敏感问题拦截、失败回退 |
| `frontend/cloudfunctions/bijiang-api/assistant/index.js` | 统一导出 |
| `frontend/cloudfunctions/bijiang-api/index.js` | 云函数 `/assistant/chat` 入口 |
| `backend/src/app.js` | 本机 Express `/api/v1/assistant/chat` 入口，复用同一份问答核心 |
| `frontend/miniprogram/pages/assistant/` | 问答页：加载、失败、重试、来源展开、回答方式 |

本机后端与云函数共用同一份问答核心，避免两套逻辑漂移；云函数部署时会连同 `assistant/` 目录一起打包。

## 知识条目结构

| 字段 | 说明 |
|---|---|
| `id` | `spot:<id>`、`route:<id>`、`service:<field>`、`craft:<spotId>`、`faq:<id>` |
| `category` | `spot` / `route` / `service` / `craft` / `faq` |
| `title` | 条目标题（景点名、路线名、问题等） |
| `content` | 可检索、可回答的正文 |
| `keywords` | 人工关键词数组 |
| `sourceId` | 主要来源编号 |
| `sourceIds` | 该条目引用的全部来源编号 |
| `sourceName` / `sourceUrl` | 来源名称与链接（由接口层按来源目录补全） |
| `reviewStatus` | `reviewed` / `pending` / `scenic-review` / `pending-expert-review` / `pending-field-check` |
| `updatedAt` | 条目更新时间 |

数据来源：景点（15 条）、推荐路线（3 条）、服务配置（地址、开放时间、电话、交通、票务）、木雕工艺导览、管理端维护的问答条目。

## 接口契约

`POST /assistant/chat`（云函数）与 `POST /api/v1/assistant/chat`（本机后端）请求与响应一致。

请求：

```json
{ "question": "金楼的木雕有什么特色？", "mode": "auto" }
```

响应 `data`：

| 字段 | 说明 |
|---|---|
| `answer` | 回答正文 |
| `mode` | `fixed_fact` / `knowledge_rag` / `rule_fallback` / `not_ready` |
| `sources` | 引用的来源数组（id、名称、机构、链接、审核状态、支持范围） |
| `reviewStatus` | 审核状态 |
| `publicStatus` | `review-draft` / `public` / `not-ready` |
| `fallbackReason` | 回退原因：`timeout` / `unauthorized` / `http_error` / `empty_response` / `provider_error` |
| `requestId` | 单次请求标识，便于排查 |
| `model` | `mock` / `qwen` / Provider 名称 |
| `notice` | 给人看的回答方式说明 |

回答方式：

- `fixed_fact`：地址、开放时间、电话、交通、票务、路线等固定信息，直接读数据，不调用模型。
- `knowledge_rag`：命中知识条目后由 Provider 整理，答案是资料内容的归纳。
- `rule_fallback`：模型超时、鉴权失败、额度或网络异常时，用检索到的资料原文按规则回答。
- `not_ready`：资料库没有对应内容，或问题越界（索取密钥、系统提示等），明确说明暂未收录。

## Provider 与环境变量

| 变量 | 说明 |
|---|---|
| `DASHSCOPE_API_KEY`（或 `QWEN_API_KEY`） | 通义千问 API Key，仅在云函数环境变量中配置 |
| `QWEN_MODEL` | 模型名称，默认 `qwen-plus` |
| `QWEN_ENDPOINT` | 接口地址，默认 DashScope OpenAI 兼容端点 |
| `QWEN_TIMEOUT_MS` | 超时毫秒数，默认 8000 |

未配置 Key 时使用 Mock Provider，`model` 返回 `mock`，行为与规则回答一致；配置 Key 后自动切换为 `qwen`。

## 安全与回退

- 模型只能看到检索命中的片段，不接触数据库、密钥或用户隐私。
- 敏感问题（密钥、系统提示、提示词、后台口令、要求忽略规则等）直接拒绝，不进入检索与模型。
- 资料不足不猜测；固定信息未配置时明确说明“尚未配置”。
- 模型任何失败都不影响主流程：自动回退到 `rule_fallback`，页面提示“模型暂不可用或超时，已改用规则回答”。
- 日志与响应不包含 API Key；`requestId` 仅用于串联排查。

## 测试

在 `backend/` 中运行：

```powershell
npm.cmd test
npm.cmd run acceptance:check
```

覆盖：知识条目字段完整性、检索命中与评分原因、固定信息不调用模型、无资料提示、模型超时回退、敏感问题不泄露、来源返回。

## 未完成事项

- 云函数未部署、未做线上联调；`DASHSCOPE_API_KEY` 需由负责人配置到云函数环境变量。
- 未使用真实千问 Key 做线上验收，`qwen` 分支仅完成接口实现与单元级注入测试。
- 微信开发者工具完整问答录屏/连续截图需由接手同学补充。
- 知识条目目前由现有数据库与快照生成，尚未接入向量检索；后续如资料量增大再评估。
