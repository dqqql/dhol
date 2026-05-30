# 角色码修改路径：dhol 手机端角色房间

## 目标

在 `D:\Dql\Desktop\dhol` 中新增一个专门解析角色码的实时房间。这个房间不是复刻完整 HTML 角色卡，也不是 GM 面板 iframe，而是一个适合手机端跑团使用的轻量角色与资源追踪界面。

这份文档只面向 dhol 的 agent 开发。

## 核心要求

- 新增独立房间类型，例如 `character-code-room` 或等价命名。
- 房间内提供角色码粘贴解析器，解析 `DHCHAR.v1.<base64url-json>`。
- 解析后渲染为手机端友好的角色面板，去掉卡图、HTML iframe、A4 纸张布局。
- 所有人权限完全一样：任何人都能导入多个角色、修改所有角色资源、修改 GM 资源。
- GM 资源需要包含恐惧点和进度钟。
- 重复导入同一个角色时完整覆盖，包括资料与资源状态。

## 统一角色码协议

必须与 MyDHcharsheet 侧保持完全一致：

```text
DHCHAR.v1.<base64url-json>
```

`base64url-json` 解码后是 UTF-8 JSON，最外层结构：

```json
{
  "format": "dh-character-code",
  "version": 1,
  "character_id": "string",
  "exported_at": "2026-05-30T00:00:00.000Z",
  "sheet": {
    "character_name": "string",
    "summary_line": "string",
    "identity": {},
    "stats": {},
    "resources": {},
    "equipment": {},
    "features": {},
    "domain_cards": [],
    "narrative": {}
  }
}
```

解析要求：

- 只接受 `DHCHAR.v1.` 前缀。
- 只接受 `format === "dh-character-code"` 且 `version === 1`。
- Base64URL 解码必须按 UTF-8 处理，保证中文和多行文本不损坏。
- 对输入长度设上限，避免粘贴超大内容拖垮页面或 WebSocket。
- 前端可以先本地校验，但服务端也必须再次校验。

## 数据模型建议

优先复用 dhol 现有资源追踪抽象：

- `packages/shared/src/types.ts` 已有 `ResourceTrackerSheet`、`ResourceTrackerResources`、`ResourceTrackerCountdown` 等类型。
- 新角色码房间可以扩展现有 sheet 结构，新增 `features` 与 `domain_cards` 字段。
- 如果不想污染现有 GM 面板类型，可以新增 `CharacterCodeSheet`，但资源字段语义要与 `ResourceTrackerSheet.resources` 保持一致。

建议新增状态：

```ts
interface CharacterCodeRoomState {
  fear: { value: number; max: number }
  countdowns: ResourceTrackerCountdown[]
  characters: CharacterCodeCharacterEntry[]
  character_order: string[]
  activity_log: Array<...>
}
```

角色条目建议：

```ts
interface CharacterCodeCharacterEntry {
  id: string
  character_id: string
  imported_at: string
  updated_at: string
  source_code_version: 1
  source_exported_at: string
  sheet: CharacterCodeSheet
}
```

覆盖策略：

- 如果新导入的 `character_id` 已存在，完整覆盖该角色条目。
- 覆盖时资源状态也使用新角色码中的状态，不保留旧 HP/压力/希望。
- 如果 `character_id` 不存在，则新增角色。

## 房间与协议修改路径

建议修改位置：

- 共享类型与解析：`packages/shared/src/types.ts`、`packages/shared/src/protocol.ts`、`packages/shared/src/validators.ts`，或新增 `packages/shared/src/character-code.ts`。
- Durable Object 房间逻辑：`apps/realtime/src/index.ts`。
- 前端 store：`fronted/src/store/useStore.ts`。
- 创建房间入口：`fronted/src/pages/LandingPage.tsx`。
- 房间路由渲染：`fronted/src/pages/RoomPage.tsx`。
- 新 UI 组件目录：`fronted/src/components/character-code-room/`。

建议新增消息：

- `character.importCode`：导入角色码。
- `character.updateResource`：更新角色资源。
- `character.delete`：删除角色。
- `character.move`：调整角色顺序。
- `character.updateFear`：更新恐惧点。
- `character.createCountdown`、`character.updateCountdown`、`character.deleteCountdown`：管理进度钟。

也可以复用 tracker/gm 的资源更新函数，但外部消息命名建议独立，避免未来维护时误判房间类型。

## UI 与手机端要求

这个房间的重点是“手机端适合跑团”，不要照搬 GM 面板的桌面双栏 iframe 设计。

布局建议：

- 顶部固定或半固定：房间名、邀请码、恐惧点、添加角色按钮。
- 主区域单列卡片流，每个角色一张移动端卡片。
- 角色卡顶部显示姓名、等级、职业/种族/社群摘要。
- 资源区放在最前：希望、HP、压力、护甲槽、熟练，用大点击目标。
- 详情区用折叠块：属性、经历、武器护甲、职业/希望特性、领域卡、背景文本。
- 领域卡只显示标题和内容，不显示卡图。
- 长文本需要良好换行，避免横向滚动。
- 底部或悬浮区域提供进度钟管理，手机上不遮挡资源按钮。

视觉建议：

- 延续 dhol 现有 Hope/Fear 氛围，但避免桌面大画布感。
- 使用清晰层级：资源追踪比装饰更优先。
- 触控目标建议不小于 44px。
- 字号和行高按手机阅读优化，长段落不要太密。
- 空房间状态要明确提示“粘贴 MyDHcharsheet 导出的角色码”。

## 导入器行为

- 导入入口是 textarea 或 modal，支持粘贴长角色码。
- 粘贴后显示解析预览：角色姓名、摘要、领域卡数量、资源最大值。
- 确认后发送给服务端导入。
- 导入失败时明确区分：前缀错误、版本不支持、内容损坏、字段缺失、文本过长。
- 不需要支持 HTML 文件导入，不需要支持二维码，不需要下载文件。

## 测试与验收

- 单测解析合法角色码并转换为房间角色数据。
- 单测拒绝错误前缀、坏 Base64URL、错误 `format`、错误 `version`、超长输入。
- 单测重复导入同一 `character_id` 会完整覆盖资料和资源。
- 集成验证多人房间同步：任意用户导入角色，其他用户能看到；任意用户修改资源，其他用户同步更新。
- 移动端验证：窄屏下没有横向滚动，领域卡文本可读，资源按钮可稳定点击。
- 运行 `npm run build`，必要时运行 realtime typecheck。

## 与 MyDHcharsheet 的一致性要求

- MyDHcharsheet 侧文档见 `D:\Dql\Desktop\MyDHcharsheet\docs\角色码修改路径.md`。
- 如果解析字段要调整，必须同步更新两边文档和测试。
- dhol 不负责生成角色码，只负责解析、导入、渲染和同步。
