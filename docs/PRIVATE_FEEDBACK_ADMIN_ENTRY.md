# 私密问题反馈与管理入口整理（1.7.0 工作包 C）

- 交付人：林同学
- 分支：`feature/private-feedback-admin-entry`
- 依据：《金漆木雕手记 1.7.0 三人分工与执行清单》工作包 C
- 范围：游客提交私密反馈、管理端查看与处理、管理入口收敛
- 不在范围：公开评论、评分、论坛、用户互评、报名、支付、退款

## 1. 数据字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 反馈编号，本地为 `fb-<uuid>`，云端为 `fb-<时间戳>-<随机串>` |
| `category` | string | `content-error` 内容纠错 / `feature-issue` 功能问题 / `visit-suggestion` 参观建议 / `other` 其他 |
| `content` | string | 必填，去除首尾空白后 1—500 字 |
| `contact` | string | 选填，最多 80 字；仅用于必要时回访，不公开展示 |
| `createdAt` | string | 提交时间，ISO 8601 |
| `status` | string | `pending` 待处理 / `processing` 处理中 / `done` 已完成 |
| `adminNote` | string | 管理端内部备注，最多 1000 字，游客端不可见 |
| `updatedAt` | string | 最近处理时间，ISO 8601 |
| `sourceVersion` | string | 提交端版本，当前固定 `1.7.0` |

本地 SQLite 表：`backend/src/db.js` 中的 `feedback` 表（`STRICT`）。
云端集合：`bijiang_feedback`（首次写入或读取时自动创建）。

## 2. 接口

### 游客端（只写）

`POST /api/v1/feedback`

```json
{
  "category": "content-error",
  "content": "金楼简介里有一处需要核对的错别字",
  "contact": "选填",
  "sourceVersion": "1.7.0"
}
```

成功：`201`

```json
{
  "data": {
    "id": "fb-...",
    "category": "content-error",
    "status": "pending",
    "createdAt": "2026-11-09T12:00:00.000Z"
  },
  "meta": { "notice": "反馈已提交，仅管理人员可查看" }
}
```

约束：

- 响应不回显 `content` 或 `contact`。
- 不提供 `GET /api/v1/feedback`，游客端没有任何公开反馈列表。
- 重复提交由前端 `submitting` 状态拦截；服务端不提供批量查询。

错误码：

| 场景 | HTTP | code | message |
|---|---|---|---|
| 类型不在枚举内 | 400 | `INVALID_CATEGORY` | 请选择正确的问题类型 |
| 内容为空 | 400 | `CONTENT_REQUIRED` | 请输入反馈内容 |
| 内容超过 500 字 | 400 | `CONTENT_TOO_LONG` | 反馈内容不能超过500个字符 |
| 联系方式超过 80 字 | 400 | `CONTACT_TOO_LONG` | 联系方式不能超过80个字符 |
| 版本号超过 40 字 | 400 | `SOURCE_VERSION_TOO_LONG` | 来源版本信息不能超过40个字符 |

### 管理端（受控读取与处理）

两个接口都必须携带现有管理口令（本地 `x-admin-token`，云端 `adminToken` 对应环境变量 `BIJIANG_ADMIN_TOKEN`）。

`GET /api/v1/admin/feedback?status=pending|processing|done`（状态可省略）

`PATCH /api/v1/admin/feedback/:id`

```json
{
  "status": "processing",
  "adminNote": "已转交内容组核对"
}
```

错误码：

| 场景 | HTTP | code | message |
|---|---|---|---|
| 未携带或口令错误 | 401 / 503 | `ADMIN_UNAUTHORIZED` / `ADMIN_DISABLED` | 沿用现有管理鉴权 |
| 状态不合法 | 400 | `INVALID_STATUS` / `INVALID_FEEDBACK_UPDATE` | 反馈状态不正确 |
| 反馈不存在 | 404 | `FEEDBACK_NOT_FOUND` | 未找到该反馈 |
| 备注超过 1000 字 | 400 | `INVALID_FEEDBACK_UPDATE` | 备注不能超过1000个字符 |
| 没有任何更新字段 | 400 | `INVALID_FEEDBACK_UPDATE` | 至少提供状态或备注 |

## 3. 权限边界

- 游客端只能提交，不能查询全部反馈，也不能通过普通接口读取他人反馈。
- 管理端读取与更新必须经过现有受控鉴权；未登录管理端不加载反馈数据。
- 日志与错误提示不输出管理口令、完整联系方式或反馈内容；云端只记录错误 `message`。
- 管理端页面只在登录成功后显示反馈列表；游客端页面不包含反馈列表循环。

## 4. 页面与入口

- 新增 `frontend/miniprogram/pages/feedback/index`：类型选择、500 字说明、选填联系方式、提交回执；只显示本次提交结果，不显示任何公开列表。
- 服务页页脚新增「问题反馈 · 仅管理人员可见」入口。
- 隐私与本地数据页面的「管理人员入口」按钮已移除，改为**长按页脚区域**进入管理页；页面直达路径 `/pages/admin/index` 和 `app.json` 路由保留。
- 管理页新增「景点内容 / 问题反馈」切换、状态筛选、内部备注、状态更新与保存。

管理入口恢复方式：

1. 普通路径：在「隐私与本地数据」页面长按页脚（`privacy-foot`）。
2. 直达路径：保留 `pages/admin/index`，可在开发者工具或受控场景直接进入。
3. 口令：沿用云端环境变量 `BIJIANG_ADMIN_TOKEN` / 本地 `ADMIN_TOKEN`，不写入仓库。

## 5. 验证记录

| 项目 | 命令 | 结果 |
|---|---|---|
| 后端测试 | `cd backend && node --test` | 37 / 37 通过 |
| 集中验收 | `node scripts/migrate-db.js && node scripts/acceptance-check.js` | 核心检查全部通过（含 8 项反馈新增检查） |
| JS 语法 | `node --check`（后端、云函数、反馈页、管理页、api.js） | 全部通过 |
| JSON | `app.json`、`pages/feedback/index.json` | 解析通过 |
| WXML / WXSS | 标签与花括号平衡检查 | 全部通过 |
| 包体 | 小程序目录统计 | 见 PR / 交付说明 |

未完成：微信开发者工具真机逐项点验（提交空内容、超长内容、重复点击、断网失败、管理端筛选与保存），需在合并前由负责人执行。

## 6. 共享文件改动

以下文件在分工清单中列为项目负责人统一维护，本工作包因功能必需做了最小改动，请在合并时重点复核：

- `frontend/miniprogram/app.json`：仅新增 `pages/feedback/index` 路由。
- `frontend/miniprogram/services/api.js`：仅新增 `submitFeedback`、`adminGetFeedback`、`adminUpdateFeedback` 三个封装。
- `backend/scripts/acceptance-check.js`：新增工作包 C 的 7 项自动检查。

其余改动均在本工作包自己的页面、云函数与管理页范围内。
