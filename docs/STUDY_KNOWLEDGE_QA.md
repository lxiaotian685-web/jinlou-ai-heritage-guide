# 研学资料问答与普通话试听说明

本文记录王同学负责的研学资料问答、知识来源和普通话讲解试听的实现边界。当前内容用于比赛演示与教学，不代表景区正式发布资料。

## 能力命名与范围

- 当前实现是关键词匹配、审核 FAQ 和固定规则组成的受控资料库，不调用模型、向量检索或生成式 RAG，因此用户界面统一称为“研学资料问答”，不包装成 AI 能力。
- 问答页支持自由输入（最多 200 字）、推荐问题、重复提交防护、网络失败重试和来源展示。
- Express API 与 CloudBase 云函数都提供 `GET /assistant/suggestions` 和 `POST /assistant/chat`，并使用相同的来源结构和兜底文案。
- 未命中可靠资料，或票务、开放、交通、拍摄、无障碍等资料未配置时，回答必须以“未找到可靠资料”开头，不附伪造来源。
- 景点页支持普通话试听的播放/暂停、进度、前后跳转、倍速和文字稿兜底。

若后续真正接入可说明的模型能力，应另行记录模型名称与版本、检索库、提示词边界、引用校验、评测集和失败降级，再评估是否恢复“AI”命名。

## 知识来源清单

| 来源 | 状态 | 当前可支持的回答范围 | 使用边界 |
|---|---|---|---|
| [顺德区博物馆：碧江金楼](https://www.sdmuseum.com.cn/unmoveabledetail.html?id=1551) | 已核对公开资料（2026-10-18） | 金楼原名赋鹤楼、苏丕文、清代嘉庆/道光年间、木雕构件及浮雕/线刻/镂雕、泥金/贴金等工艺 | 不据此回答景区当前票价、开放时间、交通、拍摄或无障碍政策 |
| [中山大学历史学系：碧江金楼古建筑群田野考察](https://history.sysu.edu.cn/article/1296) | 已核对公开资料（2026-10-18） | 碧江苏氏聚居背景、金楼古建筑群组成 | 不扩写文章未明确记载的人物故事和年代细节 |
| 项目景点资料清单 | 待景区复核 | 15 个景点的教学版简介 | 只显示为“公开资料核对稿”，不得冒充景区正式介绍 |
| 项目木雕工艺导览 | 待专家复核 | 构件、雕刻层次和饰金观察提示 | 不把图像观察结果写成确定的纹样、年代或作者结论 |
| 项目景区服务配置 | 待景区复核 | 后台人工配置的地址、开放时间、电话和交通 | 默认占位值不能作为答案；临时政策以景区当日公告为准 |
| 项目推荐路线清单 | 待现场实走 | 教学版路线和参考用时 | 入口、出口、单向通行、临时关闭及无障碍路线未核验 |

来源统一维护在 `backend/src/knowledge-sources.js`，云函数镜像在 `frontend/cloudfunctions/bijiang-api/knowledge-sources.js`。新增事实时应先登记来源、核对日期、支持范围与审核状态，再让问答引用。

## 现有数据库升级

后端启动时会执行 `20261018-enable-mandarin-preview-audio` 数据迁移：

- 为缺失的普通话讲解补齐记录；
- 仅在旧记录的 `audio_url=''` 且 `audio_type='none'` 时补试听地址和类型；
- 不覆盖人工维护的讲解文字、审核状态、其他语言或已有正式音频；
- 在 `schema_migrations` 中记录版本，重复启动不会重复改写。

也可以在 `backend/` 手动执行 `npm.cmd run db:migrate`，输出迁移版本、普通话试听数量和可播放景点数量。

## 普通话试听清单

以下 15 个文件均为 `system-tts-preview`（系统语音合成试听），文字来自项目审核稿。它们不是正式人工配音；对外发布前须由景区审核文字、发音、多音字和停连，并替换或确认音频。

| 景点 | 文件 |
|---|---|
| 南山祠 | `nanshan-hall-zh.wav` |
| 职方第 | `zhifangdi-zh.wav` |
| 对朝 | `duizhao-zh.wav` |
| 金楼 | `jinlou-zh.wav` |
| 守清屋 | `shouqingwu-zh.wav` |
| 伯韶医馆 | `boshao-clinic-zh.wav` |
| 泥楼 | `nilou-zh.wav` |
| 镬耳民居 | `wokear-residence-zh.wav` |
| 镬耳大屋 | `wokear-house-zh.wav` |
| 亦渔遗塾 | `yiyu-school-zh.wav` |
| 民居构件展示 | `components-exhibit-zh.wav` |
| 二十四咏 | `twenty-four-odes-zh.wav` |
| 抱月亭 | `baoyue-pavilion-zh.wav` |
| 叠趣亭 | `diequ-pavilion-zh.wav` |
| 后花园 | `garden-zh.wav` |

本地文件位于 `backend/public/media/narrations/`。本地 API 可直接播放这些文件，但云端快照不会把本地 `/media/...` 地址冒充为真机可用地址。

## 云端发布门禁

1. 在仓库根目录安装 CloudBase CLI 到工作区外的工具目录：

   ```powershell
   npm.cmd install --prefix ..\.tools\cloudbase-cli @cloudbase/cli
   node ..\.tools\cloudbase-cli\node_modules\@cloudbase\cli\bin\tcb login
   ```

2. 在 `backend/` 上传并核验音频：

   ```powershell
   npm.cmd run audio:cloud:publish
   ```

   脚本逐个上传 15 个 WAV，再通过已认证的 CloudBase CLI 下载到临时目录并比较 SHA-256。全部一致后才生成 `docs/cloud-audio-verification.json`。

3. 启动本地后端后运行 `npm.cmd run cloud:publish`。该命令会先执行 `audio:cloud:verify`；只有完整核验报告存在时，导出的 CloudBase 快照才会写入 `cloud://` fileID 和 `audioReady=true`。

4. 依据 `docs/CLOUD_AUDIO_REAL_DEVICE_CHECKLIST.md` 在真机逐条播放。CLI 的上传/下载哈希一致只能证明云文件存在且未损坏，不能代替真机解码、网络和权限验证。

云函数还会防御性地隐藏云数据库里遗留的本地 `/media/...` 音频地址，避免真机退回开发电脑局域网。云文件不可用时页面持续显示失败原因，并保留讲解文字稿。

## 测试矩阵

| 场景 | 预期结果 | 自动化覆盖 |
|---|---|---|
| 旧数据库升级 | 普通话试听从 0/15 升至 15/15，人工文字不变，重复启动不重写 | 数据库迁移测试 |
| 正常文化问题 | 返回审核稿、结构化来源、审核状态 | API 测试 |
| 推荐问题 | 返回带分类的受控问题和 200 字边界 | API 测试 + 集中验收 |
| 无答案或政策未配置 | 以“未找到可靠资料”开头，来源为空 | API 测试 |
| 空问题/超长问题 | 返回明确的 400 错误码 | API 测试 |
| 问答断网 | 页面保留原问题并提供“重新尝试” | 集中静态验收；开发者工具断网需人工复核 |
| 本地普通话试听 | 15 个 URL、类型和实体 WAV 一一对应 | 数据库测试 + 集中验收 |
| 云端普通话试听 | 15 个上传文件下载哈希与本地一致 | `audio:cloud:publish` / `audio:cloud:verify` |
| 音频失败 | 页面持续显示失败原因，文字稿仍可阅读 | 集中静态验收；真机需人工复核 |

自动化命令在 `backend/` 目录执行：

```powershell
npm.cmd test
npm.cmd run cloud:check
npm.cmd run acceptance:check
```
