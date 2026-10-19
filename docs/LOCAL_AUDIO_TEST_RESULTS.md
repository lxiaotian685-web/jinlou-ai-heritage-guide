# 普通话试听音频本地验收记录

验收日期：2026-10-19

## 范围与边界

- 本记录覆盖仓库中的 15 段普通话系统语音合成试听音频。
- 音频位于 `backend/public/media/narrations/`，合计 20,256,290 bytes。
- 下表哈希是仓库本地文件的 SHA-256，仅用于负责人上传后的逐文件比对。
- 本次未访问、上传或修改任何 CloudBase 环境。
- CloudBase 上传、下载回验和 15/15 云端哈希一致性校验由项目负责人账号执行。
- 微信真机播放仍需按 `docs/CLOUD_AUDIO_REAL_DEVICE_CHECKLIST.md` 逐项验收。

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
| `baoyue-pavilion-zh.wav` | 1,336,970 | `a026c74a2a71f50525ceeb6e3f74b7cd246565211c2d3e5e33501ba42a937877` |
| `boshao-clinic-zh.wav` | 1,477,958 | `27e4b0ab3b637895933909b2fe7928ee097403818d86491d6dc03d35c41bc972` |
| `components-exhibit-zh.wav` | 1,415,028 | `345ae604001db6622698c800c9d611582a884e5e3cc058a45d35dfcdfb1f6d6d` |
| `diequ-pavilion-zh.wav` | 1,316,122 | `bb580617ea29cb55e02ecdfc77a599776292eff48ef533211205b98401440531` |
| `duizhao-zh.wav` | 1,297,234 | `fb134e606ef53c5b5f0514b7857e948480fb29dcc627b46777ef5a395920fed6` |
| `garden-zh.wav` | 1,368,318 | `7d4f363daff82ba735fe9e6b397302ed3718b1e9afa067a6fb227ef642298d98` |
| `jinlou-zh.wav` | 1,384,356 | `8f26250bf3087319e5e93cbdc75cdb1ff98c012d9ad684564f0fe20c313fcd31` |
| `nanshan-hall-zh.wav` | 1,322,912 | `181302de9daa34663455fd6993baa9526a896e3a265a584518c3a2a1320fb779` |
| `nilou-zh.wav` | 1,386,430 | `bd1a702784b1619f1549595c7b68c9e4b93cc71487db06e5aecba8d247e8cf81` |
| `shouqingwu-zh.wav` | 1,376,262 | `907c16def467137be9b40b32ffe9aebeb24bdf592b5379bf814993fcb264a70f` |
| `twenty-four-odes-zh.wav` | 1,237,370 | `53975aebb3a198466a0809c7d4f722c41e8d11b1ef048542621846f29f4cbf53` |
| `wokear-house-zh.wav` | 1,237,226 | `dfd34ee3d9ec41ca5d3a577f4e82a3e35c9cb9a72ce60805e174ac2c2fefa20f` |
| `wokear-residence-zh.wav` | 1,344,514 | `f0b24c0e3909692f398ca8e461d2759f08b387f3f95362111cb8f91358bc28c1` |
| `yiyu-school-zh.wav` | 1,333,264 | `e829e3dbb720446aef6af377d029e0fc9428bced0a36e5132757a155dcde760f` |
| `zhifangdi-zh.wav` | 1,422,326 | `21cfda61174df2848e6152b48c1f1d379fbbbaaaa0daf4ec5962abe6204ea10b` |

## 负责人云端验收入口

在具备目标 CloudBase 环境权限的终端中，由负责人执行：

```powershell
cd backend
npm.cmd run audio:cloud:publish
```

该命令会上传 15 个文件，再逐个下载并比较 SHA-256；只有全部一致才生成 `docs/cloud-audio-verification.json`。随后仍需完成真机逐条播放验收。本记录不替代上述云端与真机步骤。
