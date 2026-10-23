# 普通话试听音频本地验收记录

验收日期：2026-10-20

## 范围与边界

- 本记录覆盖仓库中的 15 段普通话系统语音合成试听音频。
- 音频位于 `backend/public/media/narrations/`，本记录只覆盖其中 15 段普通话，合计 13,590,162 bytes。
- 同目录另有 30 段粤语、英语试听音频；三个语种共 45 段，详见 `docs/MULTILINGUAL_AUDIO_TEST_RESULTS.md`。
- 下表哈希是仓库本地文件的 SHA-256，仅用于负责人上传后的逐文件比对。
- 本次未访问、上传或修改任何 CloudBase 环境。
- CloudBase 上传、下载回验和 15/15 云端哈希一致性校验由项目负责人账号执行。
- 微信真机播放仍需按 `docs/CLOUD_AUDIO_REAL_DEVICE_CHECKLIST.md` 逐项验收。

## 音色与生成参数

| 项目 | 取值 |
|---|---|
| 语音引擎 | Microsoft Edge TTS（`edge-tts`），神经语音 |
| 音色 | `zh-CN-XiaoxiaoNeural`（晓晓） |
| 语速 | `-5%` |
| 响度 | EBU R128 归一化至 -16 LUFS，峰值上限 -1.5 dBTP |
| 采样格式 | 24,000 Hz / 单声道 / 16-bit PCM（WAV） |
| 生成脚本 | `backend/scripts/generate-narration-audio.ps1` → `generate-narration-audio.py` |

选择晓晓的原因：中文讲解、科普与语音导览场景中使用最广的神经音色，自然度和断句明显优于原先的 Windows SAPI `Microsoft Huihui`；云健偏体育解说、晓伊和云夏偏卡通故事，不适合文化导览。

本地试听复查：15 段时长 17.09–21.14 秒，平均 4.05–4.29 字/秒，语速一致、无截断；响度 -16.22 至 -16.84 LUFS，峰值不高于 -1.48 dBTP。

## 自动测试结果

| 检查 | 结果 |
|---|---|
| `npm.cmd test` | 34/34 通过 |
| `npm.cmd run acceptance:check` | 核心自动检查全部通过；普通话讲解文字 15/15、试听音频清单 15/15 |
| `npm.cmd run cloud:check` | 云函数本地契约 14/14 通过 |
| WAV 文件头检查 | 15/15 为有效 RIFF/WAVE |
| 本机 HTTP 访问检查 | 15/15 返回 HTTP 200，响应为有效 RIFF/WAVE |

## 本地文件清单与 SHA-256

| 文件 | 字节数 | 本地 SHA-256 |
|---|---:|---|
| `baoyue-pavilion-zh.wav` | 885,966 | `2a49d197183b3370cfa917656589f6491e0cfeec854b1a529a1cc0ed7b79547b` |
| `boshao-clinic-zh.wav` | 1,014,990 | `7e65d909f75a8d5d6ff908af23d79ad8cfd314c55350e3844479f7d94aca904d` |
| `components-exhibit-zh.wav` | 972,366 | `a90a75c2796ded3508a79c4e5c4e0b4cae744fd74aa31bf35a0b1d727b315f4b` |
| `diequ-pavilion-zh.wav` | 860,622 | `2599f2bec5b231f857aff54702674c908a6c989882fdb39c0d8b21c294d956a1` |
| `duizhao-zh.wav` | 877,902 | `4d62373cbceaad55545c485373c7ae948db8e46d4bdf1277add4d8090dca8806` |
| `garden-zh.wav` | 920,526 | `1d18278ae342afe481e35d718cd7737f848ed75132db2a530aef48ded1c6f67c` |
| `jinlou-zh.wav` | 895,182 | `abaa31e3368b4e16f753d739eb562e2eb9088602d07d512abfbf15a4dbaec0b2` |
| `nanshan-hall-zh.wav` | 909,006 | `09d3078ee170f864e4235fd385ffa20112dd2f6e15340627736e22a9b1b5c035` |
| `nilou-zh.wav` | 905,550 | `ba37f60ae8151d6e7e9e3e595ac9888c38f96453bc3a49ea3674093c9acc4306` |
| `shouqingwu-zh.wav` | 950,478 | `11f95186d6a081d95ce99ac1390d834a00f9e07779161ecdb9f927beb04148ff` |
| `twenty-four-odes-zh.wav` | 827,214 | `863a96b3d67261a4ac559bfa4d3c1be6f427b15fcc11744e6b2d91a71bf7e170` |
| `wokear-house-zh.wav` | 820,302 | `d595f2859622988ba719bf06b919c6fc49f86db7d04b33725eec8f1ba90f2166` |
| `wokear-residence-zh.wav` | 905,550 | `f61489d8340328c357dcf0a8365bc36f09b84f90b0e4e3073ed3b78154b5319c` |
| `yiyu-school-zh.wav` | 892,878 | `22a08585629a769cbca4a28e566327f250f399380ad0842b55ffaf1df842b625` |
| `zhifangdi-zh.wav` | 951,630 | `aeb7fa9c71ae8441e1f033afc5be671f4cb5be5a15f7ef88eb7b2c31e45866a2` |

## 负责人云端验收入口

在具备目标 CloudBase 环境权限的终端中，由负责人执行：

```powershell
cd backend
npm.cmd run audio:cloud:publish
```

该命令会上传 15 个文件，再逐个下载并比较 SHA-256；只有全部一致才生成 `docs/cloud-audio-verification.json`。随后仍需完成真机逐条播放验收。本记录不替代上述云端与真机步骤。

