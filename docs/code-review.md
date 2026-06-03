# DHOL 项目代码审查报告

> 审查时间：2026-06-03  
> 审查范围：全量代码（前端 + 后端 + 共享包）  
> 总体评分：6.5/10

---

## 评分总览

| 维度 | 评分 | 主要短板 |
|------|------|---------|
| 安全 | 6.5 | CORS 过宽、postMessage 目标源、缺速率限制 |
| 性能 | 6.5 | Zustand 无细粒度 selector、O(n²) 状态合并算法 |
| 代码质量 | 6.5 | 三个超大文件（1000+ 行）、组件职责混乱 |
| 架构 | 6.5 | grid.ts 重复、后端单体 3600+ 行、状态未分层 |

---

## 问题清单

### 高优先级

| ID | 类别 | 问题 | 文件 | 状态 |
|----|------|------|------|------|
| S1 | 安全 | `postMessage` 目标源使用 `'*'`，允许任意窗口接收敏感消息 | `gmPanelHtml.ts:263`, `GmPanelBoard.tsx:196` | ✅ 已修复（2026-06-03）|
| S2 | 安全 | CORS 允许所有来源 (`access-control-allow-origin: *`) | `apps/realtime/src/index.ts:3662` | ✅ 已修复（2026-06-03）|
| S3 | 安全 | 导入数据无大小限制，可被 DoS 攻击 | `packages/shared/src/validators.ts` | ⬜ 待处理 |
| S4 | 安全 | 无速率限制（创建房间、发送消息等） | `apps/realtime/src/index.ts` | ⬜ 待处理 |
| P1 | 性能 | Zustand 直接解构整个 Store，任何状态变化都重渲染顶层组件 | `fronted/src/pages/RoomPage.tsx:15` | ✅ 已修复（2026-06-03）|
| P2 | 性能 | `map_cards` 操作每次全量 O(n) 遍历查找目标卡牌 | `useStore.ts:966, 994, 1051` 等 | ⬜ 待处理 |
| P3 | 性能 | `preserveTransientRoomState` 存在 O(n²) 算法，每次 WebSocket 更新都触发 | `useStore.ts:256-308` | ⬜ 待处理 |
| Q1 | 质量 | `useStore.ts` 1423 行，100+ 个方法，UI/房间/动画逻辑全混在一起 | `fronted/src/store/useStore.ts` | ⬜ 待处理 |
| Q2 | 质量 | `GmPanelBoard.tsx` 1194 行，严重违反单一职责 | `fronted/src/components/gm-panel/GmPanelBoard.tsx` | ⬜ 待处理 |
| Q3 | 质量 | `MobilePanelRoom.tsx` 1121 行，严重违反单一职责 | `fronted/src/components/mobile-panel/MobilePanelRoom.tsx` | ⬜ 待处理 |
| Q4 | 质量 | `useEffect` 依赖数组不完整，导致 ResizeObserver 频繁重注册 | `fronted/src/components/layout/TopBar.tsx:63` | ⬜ 待处理 |
| A1 | 架构 | 后端 3600+ 行，业务工具函数未提取到 `shared` 包 | `apps/realtime/src/index.ts` | ⬜ 待处理 |
| A2 | 架构 | `grid.ts` 在前端和 shared 包中重复，存在版本不同步隐患 | `fronted/src/utils/grid.ts`, `packages/shared/src/grid.ts` | ⬜ 待处理 |

### 中优先级

| ID | 类别 | 问题 | 文件 | 状态 |
|----|------|------|------|------|
| S5 | 安全 | Session token 暴露在 WebSocket URL 查询参数中（会被记录在日志/历史） | `apps/realtime/src/index.ts:3549` | ⬜ 待处理 |
| S6 | 安全 | 邀请码仅 6 字符，无暴力枚举锁定机制 | `index.ts:3553` | ⬜ 待处理 |
| S7 | 安全 | GM 角色卡 HTML 仅靠元标签验证，未做内容完整性校验 | `GmPanelBoard.tsx:46-50` | ⬜ 待处理 |
| P4 | 性能 | WebSocket 消息处理无背压控制，多人高频操作时阻塞主线程 | `fronted/src/lib/realtime.ts:144` | ⬜ 待处理 |
| P5 | 性能 | `fetchGmSheetHtml` 无防抖，视觉变化时频繁触发 | `GmPanelBoard.tsx:139-185` | ⬜ 待处理 |
| Q5 | 质量 | `MobilePanelRoom` 6+ 个独立 boolean 状态，可能同时触发多个 Modal | `MobilePanelRoom.tsx:381-393` | ⬜ 待处理 |
| Q6 | 质量 | 错误处理不一致：部分 catch 块无日志，用户看到错误但开发者拿不到堆栈 | 多处 | ⬜ 待处理 |
| Q7 | 质量 | `30_000` 等裸数字未提取为常量 | `GmPanelBoard.tsx:134` | ⬜ 待处理 |
| A3 | 架构 | 错误消息混合中英文、无错误码，前端无法做差异化恢复 | `index.ts` 多处 | ⬜ 待处理 |
| A4 | 架构 | `fronted/src/types/index.ts` 只是转发 shared 类型，制造双重导入路径 | `types/index.ts` | ⬜ 待处理 |

### 低优先级

| ID | 类别 | 问题 | 状态 |
|----|------|------|------|
| S8 | 安全 | 缺少 CSP 响应头 | ⬜ 待处理 |
| S9 | 安全 | 缺少 HSTS 头 | ⬜ 待处理 |
| S10 | 安全 | 导入功能未限制权限，任意成员可覆盖全房间数据 | ⬜ 待处理 |
| P6 | 性能 | LandingPage 大量 inline style 对象每次渲染重新创建 | ⬜ 待处理 |
| Q8 | 质量 | `localStorage` 写入无 try-catch（隐身模式下可能抛出异常） | ⬜ 待处理 |
| Q9 | 质量 | LandingPage/TopBar 存在 DRY 违反（按钮组代码重复） | ⬜ 待处理 |
| A5 | 架构 | 完全没有自动化测试 | ⬜ 待处理 |
| A6 | 架构 | 协议无版本字段，未来多版本客户端并存时会有问题 | ⬜ 待处理 |

---

## 整改计划

### 第一轮（已完成）
目标：高收益低风险的改动，不涉及大规模重构

- [x] **S1** — 修复 `postMessage` 目标源（gmPanelHtml.ts + GmPanelBoard.tsx）
- [x] **S2** — CORS 改为环境变量可配置（`ALLOWED_ORIGIN`）
- [x] **P1** — RoomPage.tsx 改用 Zustand 细粒度 selector

### 第二轮（已完成）
目标：结构性重构，改善可维护性

- [x] **Q1** — 拆分 useStore.ts（按领域分为 UI store / Room store）（2026-06-03）
- [x] **Q2** — 拆分 GmPanelBoard.tsx（≥5 个子组件）（2026-06-03）
- [x] **Q3** — 拆分 MobilePanelRoom.tsx（≥5 个子组件）（2026-06-03）
- [x] **A1** — 提取 shared/utils.ts（后端业务工具函数）（2026-06-03）
- [x] **A2** — 合并 grid.ts（前端只保留 UI 扩展层）（2026-06-03）

### 第三轮（已完成）
目标：完善性改进

- [x] **S3/S4** — 速率限制 + 导入大小验证（2026-06-03）
- [x] **P2/P3** — 优化 map_cards 索引和 preserveTransientRoomState 算法（2026-06-03）
- [x] **A3** — 错误码结构化（2026-06-03）
- [x] **A5** — 引入 Vitest，覆盖 shared 验证器和核心业务逻辑（2026-06-03）

---

## 改动记录

### 第三轮 - 2026-06-03

**S3 - 导入大小验证**
- `packages/shared/src/validators.ts` 新增 10 个防 DoS 常量
- `assertDhPack`：限制 200 张卡、包名 100 字符、描述 500 字符、标题/内容 100/20000 字符
- `assertDhRoomBackup`：限制地图 500 张卡、500 个注释（注释文本 2000 字符）、导入包 20 个、手牌总数 200 张

**S4 - HTTP + WebSocket 速率限制**
- `apps/realtime/src/index.ts` 新增模块级 `_ipRateLimitMap`，IP 维度每分钟 10 次限制
- `createRoom` 和 `joinRoom` 都调用 `checkHttpRateLimit`，超限返回 HTTP 429
- `RoomDurableObject` 新增 `wsRateLimitMap`，每连接每秒 30 条消息限制
- 超速 WebSocket 连接发送错误消息后立即关闭（code 1008）

**A3 - 错误码结构化**
- `apps/realtime/src/index.ts` 新增 `ERR` 常量对象（8 个错误码：ROOM_NOT_FOUND、PERMISSION_DENIED 等）
- `sendError` 方法完整传递 `{ code, message }`（匹配 ServerMessage error 协议定义）
- 所有 HTTP 错误响应统一添加 `code` 字段

**P2 - map_cards 操作优化**
- `fronted/src/store/useStore.ts` 新增 `updateCardById` 辅助函数
- 通过 `findIndex` + array slice 替代全量 `.map()`，card 不存在时直接返回原数组（early exit）
- 覆盖：`moveCard`、`resizeCard`、`toggleExpandCard`、`lockCard`、`unlockCard` 等

**P3 - preserveTransientRoomState 快速路径**
- 无本地 override 时（最常见情况）走快速路径：跳过清理逻辑，仅对比 `is_expanded` 差异
- 若 `is_expanded` 也无差异则直接返回 `incoming`（零拷贝）
- 有 override 时才走原有慢速路径

**A5 - Vitest 测试框架**
- `packages/shared/package.json` 新增 vitest devDependency 和 test/test:watch scripts
- `packages/shared/vitest.config.ts` 新建
- `packages/shared/src/__tests__/validators.test.ts`：20 个测试用例覆盖 assertDhPack（正常/边界/错误）、assertDhRoomBackup、safeJsonParse
- `packages/shared/src/__tests__/grid.test.ts`：16 个测试用例覆盖 snapToGrid、getCardGridSize、normalizeCardDimensions、createLocationTerritory、normalizeTerritoryRect

### 第二轮 - 2026-06-03

**Q1 - useStore.ts 拆分**
- 新建 `storeTypes.ts`：集中所有 TypeScript 类型定义（UIState、AppStore 等接口）
- 新建 `uiSlice.ts`：UI 状态初始值 + 25 个纯 UI action（模态框开关、toast、连线工具等），使用 Zustand `StateCreator` slice 模式
- 改写 `useStore.ts`：仅保留房间/网络逻辑，通过 `...createUISlice()` 组合 UI slice；文件行数 1423 → 650 行

**Q2 - GmPanelBoard.tsx 拆分**
- 新建 `gmPanelTypes.ts`：共享类型定义（SheetDocState、ImportPendingState 等）
- 提取 6 个子组件：`GmImportPendingToast`、`GmHtmlSheetCard`、`GmEmptySlotCard`、`GmActivityLogPanel`、`GmFearTracker`（含进度钟和 IconButton）
- 主文件行数 1194 → 280 行

**Q3 - MobilePanelRoom.tsx 拆分**
- 提取 5 个文件：`MobileSharedWidgets`（StatPill/TrackDots/NumberAdjuster）、`MobileMarkdownRenderer`（Markdown 解析 + SectionCard/InfoBlock）、`MobileFearAndCountdowns`、`MobileCharacterList`、`MobileCharacterModals`（含 5 个 Modal 组件 + ExperienceDraft 工具函数）
- 主文件行数 1120 → 220 行

**A1 - 提取 shared/utils.ts**
- 新建 `packages/shared/src/utils.ts`（约 1250 行），提取 60+ 个纯工具函数（卡牌、玩家、房间、资源追踪、GM 面板、HTML 解析、Mobile 面板等）
- 更新 `packages/shared/src/index.ts`：新增 `export * from './utils'`
- `apps/realtime/src/index.ts` 改为从 shared 导入，行数 3685 → 2480 行

**A2 - 合并 grid.ts**
- 分析确认两个版本逻辑完全一致（前端版本的 `cols/rows/scale` 别名字段无实际调用）
- `fronted/src/utils/grid.ts` 改为从 `@dhgc/shared` 纯 re-export，保持原有导入路径不变

### 第一轮 - 2026-06-03

**S1 - postMessage 目标源修复**
- `buildGmSheetSrcDoc` 新增 `parentOrigin` 参数，调用方传入 `window.location.origin`
- iframe 内脚本的两处 `'*'` 改为嵌入的 `PARENT_ORIGIN` 常量
- 父→iframe 方向的 `'*'` 因 srcDoc 的 null origin 限制无法修复，已加注释说明

**S2 - CORS 环境变量化**
- `Env` 接口新增 `ALLOWED_ORIGIN?: string`
- `withCors` 改用模块级变量 `_corsAllowedOrigin`，在 fetch handler 和 DO 构造器中从 env 初始化
- `wrangler.toml` 补充配置说明注释

**P1 - Zustand selector**
- `RoomPage.tsx` 改用 `useShallow` selector，避免无关状态变化触发重渲染
