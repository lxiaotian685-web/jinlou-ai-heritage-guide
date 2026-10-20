# 多语种试听音频本地验收记录

验收日期：2026-10-20

## 范围与边界

- 本记录覆盖 15 个景点的粤语、English 两种试听音频，共 30 段。
- 加上 `docs/LOCAL_AUDIO_TEST_RESULTS.md` 记录的 15 段普通话，仓库现有 45 段试听音频，合计 45,226,422 bytes。
- 粤语、英语讲解词均由已审核普通话讲解词机器翻译而来，属于试听草稿；事实仍以中文原稿为准，用词与发音待景区人工审核。
- 音频类型统一为 `system-tts-preview`，审核状态为 `pending`，小程序中显示为试听稿。

## 音色与生成参数

| 语言 | 音色 | 文件后缀 | 文件数 | 合计字节 |
|---|---|---|---:|---:|
| 普通话 | `zh-CN-XiaoxiaoNeural`（晓晓） | `-zh.wav` | 15 | 13,590,162 |
| 粤语 | `zh-HK-HiuMaanNeural` | `-yue.wav` | 15 | 14,208,786 |
| English | `en-US-AriaNeural` | `-en.wav` | 15 | 17,427,474 |

统一参数：Microsoft Edge TTS 神经语音，语速 `-5%`，EBU R128 归一化到 -16 LUFS、峰值上限 -1.5 dBTP，输出 24,000 Hz / 单声道 / 16-bit PCM WAV。

重新生成命令：

```powershell
cd backend
.\scripts\generate-narration-audio.ps1                  # 全部 45 段
.\scripts\generate-narration-audio.ps1 -Languages yue,en  # 只重做 30 段非普通话
```

## 验证结果

| 检查 | 结果 |
|---|---|
| WAV 文件头与格式 | 45/45 为有效 RIFF/WAVE，24 kHz 单声道 16-bit |
| 30 段新增音频时长 | 17.6–30.5 秒；粤英文本长度与时长成比例，无截断 |
| 30 段新增音频响度 | -17.11 至 -15.70 LUFS，峰值不高于 -1.39 dBTP |
| `npm.cmd test` | 34/34 通过（新增三语讲解接口测试） |
| `npm.cmd run acceptance:check` | 核心检查全部通过；普通话 15/15、粤语/英语 30/30 |
| `npm.cmd run cloud:check` | 云函数本地契约 14/14 通过 |

## 数据与前端

- 每个景点返回 3 条讲解记录：`zh-CN`、`yue`、`en`，语言标签由接口数据驱动，小程序无需新增页面。
- 数据库迁移 `20261020-enable-multilingual-preview-audio` 为既有数据库补齐三种语言的讲解记录与本地音频地址。
- 云端快照 `frontend/cloudfunctions/bijiang-api/data.json` 已重新导出：两种新增语言保留译文，但 `audioReady` 固定为 `false`，因为云端音频发布流程目前只覆盖 15 段普通话。

## 云端发布边界

- `npm.cmd run audio:cloud:publish` 仍然只上传并校验 15 段普通话音频（`cloudAudioAssets` 仅包含 `zh-CN`）。
- 粤语、英语音频目前仅用于本机与局域网试听，未上传、未做云端哈希回验、未做真机验收。
- 真机与云端验收仍需按 `docs/CLOUD_AUDIO_REAL_DEVICE_CHECKLIST.md` 由项目负责人执行。

