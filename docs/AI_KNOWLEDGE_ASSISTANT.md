# 研学资料问答接入说明（知识库 + DeepSeek）

更新时间：2026-10-30

## 目标与边界

- 问答链路固定为：固定信息查询 → 知识库检索 → 模型整理 → 返回答案、来源与状态。
- 模型只允许整理检索到的资料，不得补充资料外的事实；资料不足时返回“资料库暂未收录”。
- 默认使用本地 Mock Provider；云端已配置 `DEEPSEEK_API_KEY`，使用 `deepseek-chat` 整理检索结果。
- 本模块不涉及音频播放器、AR 状态机、后台其他模块和无关页面。
- `bijiang-api` 已部署 CloudBase 并完成真实 DeepSeek 调用；API Key 只存在于云函数环境变量和本机受控环境变量中，不进入代码、`data.json`、提交或截图。未上传或发布微信版本。

## 代码位置

| 位置 | 作用 |
|---|---|
| `frontend/cloudfunctions/bijiang-api/assistant/knowledge.js` | 知识条目构建、固定信息、检索打分 |
| `frontend/cloudfunctions/bijiang-api/assistant/providers.js` | Provider 接口、Mock、DeepSeek、通义千问及 OpenAI 兼容 Provider |
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
| `fallbackReason` | 回退原因：`timeout` / `unauthorized` / `http_error` / `empty_response` / `provider_error` / `rate_limited` |
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
| `LLM_API_KEY` | 任意 OpenAI 兼容接口的 Key（优先使用） |
| `LLM_BASE_URL` | 接口根地址，例如 `https://api.siliconflow.cn/v1` |
| `LLM_MODEL` | 模型名，例如 `Qwen/Qwen2.5-7B-Instruct` |
| `LLM_PROVIDER` | 仅用于响应里的 `model` 名称展示 |
| `LLM_TIMEOUT_MS` | 超时毫秒数，默认 15000 |
| `DEEPSEEK_API_KEY` | DeepSeek 专用 Key；未配置完整 `LLM_*` 时优先使用 |
| `DEEPSEEK_BASE_URL` | 默认 `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 默认 `deepseek-chat` |
| `DEEPSEEK_TIMEOUT_MS` | 默认 15000 |
| `DASHSCOPE_API_KEY`（或 `QWEN_API_KEY`） | 通义千问专用配置，未设置 `LLM_*` 时生效 |
| `QWEN_MODEL` | 默认 `qwen-plus` |
| `QWEN_ENDPOINT` | 默认 `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `QWEN_TIMEOUT_MS` | 默认 8000 |
| `ASSISTANT_RATE_LIMIT_PER_MINUTE` | 单个访客每分钟模型调用上限，默认 60 |
| `ASSISTANT_RATE_LIMIT_PER_DAY` | 单个访客每天模型调用上限，默认 300 |

选择顺序：完整 `LLM_*` → `DEEPSEEK_API_KEY` → `DASHSCOPE_API_KEY` → Mock。未配置任何 Key 时使用 Mock Provider，`model` 返回 `mock`。

### 免费或带免费额度的 OpenAI 兼容服务

以下都需要**你本人注册账号**后获取 Key，注册通常要手机号或邮箱验证；Key 只能放进云函数环境变量或本机临时环境变量，不要提交到仓库。

| 服务 | 接口根地址 | 免费额度说明 |
|---|---|---|
| 硅基流动 SiliconFlow | `https://api.siliconflow.cn/v1` | 国内可直连，注册送额度，含 Qwen 等开源模型 |
| 智谱 GLM-4-Flash | `https://open.bigmodel.cn/api/paas/v4` | GLM-4-Flash 免费模型 |
| 阿里云百炼 DashScope | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 新用户免费额度，Qwen 系列 |
| OpenRouter | `https://openrouter.ai/api/v1` | 有 `:free` 模型，国内访问可能不稳定 |
| Groq | `https://api.groq.com/openai/v1` | 免费额度，国内访问可能不稳定 |

本机无账号方案：安装 Ollama 后运行 `ollama run qwen2.5:7b`，把 `LLM_BASE_URL` 设为 `http://127.0.0.1:11434/v1`，`LLM_MODEL` 设为 `qwen2.5:7b`，Key 可填任意非空字符串。

## 安全与回退

- 模型只能看到检索命中的片段，不接触数据库、密钥或用户隐私。
- 敏感问题（密钥、系统提示、提示词、后台口令、要求忽略规则等）直接拒绝，不进入检索与模型。
- 资料不足不猜测；固定信息未配置时明确说明“尚未配置”。
- 模型任何失败都不影响主流程：自动回退到 `rule_fallback`，页面提示“模型暂不可用或超时，已改用规则回答”。
- 日志与响应不包含 API Key；`requestId` 仅用于串联排查。
- 频率与额度保护：按访客维度做滑动窗口限流（每分钟 / 每天），超限时不调用模型，直接回退 `rule_fallback`（`fallbackReason=rate_limited`）。限流为进程内计数，云函数冷启动会重置，属于基础保护而非全局配额。
- 访客文案：接口保留 `reviewStatus` / `publicStatus` 等内部字段，但问答页与回答正文不展示“待景区复核、待景区审核、review-draft”等内部流程用语；送入模型的片段和模型输出均会做游客文案净化。
- Node.js 16 兼容：运行时没有全局 `fetch` 时自动使用原生 HTTPS 请求；云函数超时为 20 秒，模型请求超时为 15 秒。

## 测试

在 `backend/` 中运行：

```powershell
npm.cmd test
npm.cmd run acceptance:check
```

覆盖：知识条目字段完整性、检索命中与评分原因、固定信息不调用模型、无资料提示、模型超时回退、敏感问题不泄露、来源返回。

## 当前状态与后续验收

- CloudBase `bijiang-api` 已部署，真实 `deepseek-chat` 回答、固定电话查询、推荐问题和无资料兜底均已云端验证。
- 后端测试 46/46、集中自动验收核心项目全部通过、云端契约检查 14/14。
- 仍需在微信开发者工具和真机完成问答页视觉、弱网重试与连续提问录屏；该步骤不影响当前云函数能力。
- 当前资料量适合关键词检索；只有资料规模明显扩大后再评估向量检索，避免为比赛演示引入不必要复杂度。
