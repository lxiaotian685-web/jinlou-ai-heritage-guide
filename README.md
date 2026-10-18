# 金漆木雕手记 · AI 非遗研学导览

本项目是已备案并上线的微信小程序教学案例，现以“智慧文旅”方向参加 AI 微信小程序赛事。现有版本提供碧江金楼文化图文、景点资料、讲解、收藏、分享、游览记录、云端内容管理与运营数据；比赛升级将重点建设图像辅助识别、有来源引用的文化知识 RAG、普通话/粤语讲解和个性化研学 Agent。

## 历史成果与本届新增边界

- 历史成果：原生微信小程序、CloudBase 数据与云函数、15 个景点资料、参考路线、讲解资料、收藏与游览记录、运营后台及自动测试。
- 本届计划新增：多模态文化识别、带来源引用的 RAG、受控研学 Agent、AI 质量评测和比赛演示材料。
- 所有历史文化结论必须来自已审核资料；无法确认时明确标记“待核对”，不得由模型编造。
- 当前线上版本是个人学习与教学案例，不代表景区官方运营或既成合作。

前后端分离项目：

- `frontend/`：原生微信小程序。
- `backend/`：Express API + SQLite。

协作规范见 `CONTRIBUTING.md`。密钥、管理口令、数据库、本机配置、用户数据和未授权原始素材不得提交到仓库。

## 本地启动

```powershell
cd backend
npm.cmd install
npm.cmd test
npm.cmd start
```

在 Windows PowerShell 中使用 `npm.cmd`，可避免系统执行策略拦截 `npm.ps1`。不需要为此修改全局 ExecutionPolicy。

微信开发者工具导入 `frontend/`。开发阶段可关闭“不校验合法域名”。API 地址集中配置在 `frontend/miniprogram/config.js`：真机联调填写运行后端电脑的 WLAN IPv4 地址，模拟器也可使用该地址；网络变化后需要更新。

## 第一阶段接口

- `GET /api/v1/health`
- `GET /api/v1/spots`
- `GET /api/v1/spots/:id`
- `GET /api/v1/spots/:id/narrations`
- `GET /api/v1/spots/:id/craft-guide`
- `GET /api/v1/site-map`
- `GET /api/v1/panoramas`
- `GET /api/v1/panoramas/:id`
- `GET /api/v1/service`
- `GET /api/v1/recommendations?category=food|hotel|transport|attraction`
- `POST /api/v1/assistant/chat`
- `GET /api/v1/routes`

当前景点文字是明确标注的演示内容，正式发布前须由景区审核。

数据库中的初始示例只会在对应数据表为空时写入。修改景点、路线或地图点位后，正常重启后端不会再被示例数据覆盖。

## 数据库备份

在 `backend` 目录运行：

```powershell
npm.cmd run backup
```

备份会保存到 `data/backups/`，文件名包含生成时间。命令会检查数据库完整性并比较各内容表的记录数量；验证失败的文件不会保留。恢复功能尚未实施，不要用备份文件直接覆盖运行中的数据库。

恢复前必须停止后端服务，然后明确指定备份文件并提供确认参数：

```powershell
npm.cmd run restore -- "data/backups/备份文件名.db" --confirm
```

恢复工具会先验证所选备份，再自动生成一份“恢复前安全备份”，最后通过临时文件替换和二次校验完成恢复。缺少 `--confirm` 时命令会拒绝执行。

## 景点内容修改

修改前建议停止后端服务。在 `backend` 目录按景点ID修改名称、简介或类别，例如：

```powershell
npm.cmd run content:update -- --id jinlou --summary "经景区审核的正式简介"
npm.cmd run content:update -- --id jinlou --name "正式名称" --category "古建景点"
```

命令只允许修改名称、简介和类别，每次实际写入前会自动生成备份。景点不存在、内容为空、文字过长或没有任何修改时不会写入数据库。
