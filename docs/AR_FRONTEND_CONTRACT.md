# AR 木雕寻宝前端接口约定

适用分支：`feature/ar-device-acceptance`

## 页面状态

- `stage`：`intro`、`camera`、`discovered`
- `cameraReady`：相机是否完成初始化
- `cameraError`：相机不可用时的错误信息
- `useFallback`：是否使用参考图模式
- `hotspots`：三个热点，包含 `id`、`number`、`title`、`description`、`x`、`y`、`visited`
- `activeHotspot`：当前展示的热点
- `visitedHotspots`：已访问热点 ID 数组
- `visitedCount`：已访问数量
- `quizUnlocked`：仅当三个热点全部访问后为 `true`
- `selectedAnswer`：当前答案
- `quizPassed`：是否答对
- `completedBefore`：当前手机是否已有完成记录

## 页面事件

- `startExperience`：进入相机步骤
- `handleCameraReady`：相机初始化完成
- `handleCameraError`：相机失败，显示参考图入口
- `confirmTarget`：确认目标并进入热点探索
- `useImageFallback`：改用参考图并进入同一探索流程
- `selectHotspot`：记录热点访问并在 3/3 时解锁问答
- `answerQuiz`：未解锁时拒绝答题；答错可重试；答对写入本机完成记录
- `openNarration`：打开金楼讲解
- `openAssistant`：打开研学资料问答
- `resetExperience`：清空本轮临时状态，保留历史完成标记

## 持久化

本机键：`arStudyProgress:jinlou-woodcarving`

答对后保存 `targetId`、`completedAt` 和 `visitedHotspots`。重新体验不会删除历史完成记录。

## UI 修改边界

林同学可重做 WXML/WXSS，但必须保留以上字段和事件，不得绕过三线索解锁、相机失败降级、答错重试及完成记录。新增字段或事件需先说明用途，避免覆盖业务逻辑。
