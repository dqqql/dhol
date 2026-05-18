# GM面板开发文档

更新日期：2026-05-17

## 1. 项目目标

基于现有参考项目实现一个适用于《匕首之心》跑团的 GM 面板。

核心目标：

- 支持导入 `MyDHcharsheet` 导出的 HTML 角色卡
- 将角色卡按固定槽位展示，每页固定 4 个位置
- 每个位置独立滚动，便于同时查看多张长角色卡
- 支持多人实时同步修改资源、角色字段、恐惧点、进度钟
- 所有人权限相同，任意在线成员都可以修改任意角色卡内容
- 保留房间内变更记录
- 复制 `MyDHcharsheet` 的悬浮笔记和掷骰体验，但第一期只做本地笔记，不参与同步

## 2. 参考项目

## 2.1 同步与资源房间参考

项目路径：`D:\Dql\Desktop\dhgc`

重点参考：

- 前端资源面板：`D:\Dql\Desktop\dhgc\fronted\src\components\resource\ResourceTrackerBoard.tsx`
- 前端房间页：`D:\Dql\Desktop\dhgc\fronted\src\pages\RoomPage.tsx`
- 状态管理：`D:\Dql\Desktop\dhgc\fronted\src\store\useStore.ts`
- 实时通信：`D:\Dql\Desktop\dhgc\fronted\src\lib\realtime.ts`
- 后端房间逻辑：`D:\Dql\Desktop\dhgc\apps\realtime\src\index.ts`
- 类型定义：`D:\Dql\Desktop\dhgc\packages\shared\src\types.ts`

复用方向：

- Cloudflare Worker + Durable Object 房间同步架构
- WebSocket 快照同步与广播机制
- 资源修改与活动日志模型
- 恐惧点、进度钟的交互方式

## 2.2 悬浮笔记参考

项目路径：`D:\Dql\Desktop\MyDHcharsheet`

重点参考：

- 悬浮笔记入口：`D:\Dql\Desktop\MyDHcharsheet\components\notebook\floating-notebook.tsx`
- 页面内容：`D:\Dql\Desktop\MyDHcharsheet\components\notebook\notebook-page.tsx`
- 骰子行：`D:\Dql\Desktop\MyDHcharsheet\components\notebook\lines\dice-line.tsx`
- 类型定义：`D:\Dql\Desktop\MyDHcharsheet\lib\sheet-data.ts`

复用方向：

- 悬浮窗交互
- 本地笔记分页
- 文本 / 计数器 / 骰子三类笔记行
- 掷骰动画与编辑交互

## 3. 已确认的产品决策

## 3.1 页面与分页

- 同一页固定 4 个角色槽位
- 导入 1 张角色卡占 1 个槽位
- 超过 4 张角色卡后，使用分页处理
- 后续可能调整为每页 2 张或 3 张，因此布局实现必须参数化，不能把 “4” 写死在样式和逻辑里

建议：

- 抽象 `cardsPerPage` 配置，默认值为 `4`
- 分页逻辑、网格布局、空槽位占位都围绕该配置实现

## 3.2 槽位绑定规则

- 槽位绑定的是“角色卡”，不是“玩家”
- 不存在“谁上传就归谁”这种所有权模型
- 房间中的任意在线成员都可以修改任意槽位中的角色卡

## 3.3 权限模型

所有人权限相同，包含以下能力：

- 修改任意角色卡字段
- 修改任意角色资源
- 修改恐惧点
- 修改进度钟
- 调整角色卡顺序
- 导入或替换角色卡

因此本项目不保留 `dhgc` 里的：

- 房主 / GM 专属资源权限
- 列拥有者权限
- 资源审批开关
- 待审批请求队列

## 3.4 悬浮笔记

- 每人一份本地笔记
- 不同步到房间
- 掷骰结果只在本地显示
- 以轻量版优先，适配 Cloudflare Pages 部署

注意：

- 悬浮笔记与角色卡里的 `notebook` 字段不是同一件事
- 悬浮笔记是浏览器本地临时 / 持久数据
- 角色卡自带的 `notebook` 属于角色卡内容的一部分，需与悬浮笔记彻底分离

## 3.5 导入格式

- 第一版只支持 `MyDHcharsheet` 导出的 HTML 角色卡
- 不兼容其他 HTML 角色卡来源

理由：

- 当前角色卡 HTML 中已内嵌 `window.characterData`
- 直接提取内嵌对象，比 DOM 解析更稳定

## 3.6 角色卡笔记字段

- 保留角色卡原本的角色笔记字段
- 不与悬浮笔记共享存储字段
- 两套笔记系统独立存在

## 3.7 变更记录范围

第一版记录以下内容：

- HTML 可导入并可编辑的角色卡字段改动
- 资源改动
- 恐惧点改动
- 进度钟增删改
- 角色卡导入 / 替换
- 角色卡顺序调整

不记录：

- 悬浮笔记内容
- 本地掷骰结果

## 3.8 技术方向

- 前端继续采用 `dhgc` 当前 React + Vite 思路
- 后端继续采用 Cloudflare Worker + Durable Object
- 部署目标包含 Cloudflare Pages
- 实时同步按正式多人房间来设计，不做纯单机原型

## 4. 当前项目输入素材

当前目录：`D:\Dql\Desktop\dhol`

现有文件：

- `阿德兰-神使-人类-人类-博识之民-LV1.html`
- `克利夫-守护者-龙人-龙人-山岭之民-LV3.html`

已确认事实：

- HTML 不是纯静态展示页
- 文件内存在 `window.characterData = {...}`
- 数据中已包含角色基础信息、资源、装备、叙事字段
- 数据中还包含 `notebook`，但这部分属于角色卡原数据，不与悬浮笔记共用

## 5. 产品结构

## 5.1 房间类型

建议保留独立房间类型，例如：

- `gm-panel`

不要继续沿用 `resource-tracker` 原名称，避免和旧权限逻辑、旧页面文案混淆。

## 5.2 页面结构

房间主界面建议分为四块：

1. 顶栏
2. 全局资源区
3. 角色卡分页展示区
4. 变更记录区

### 顶栏

包含：

- 房间名
- 邀请码
- 连接状态
- 页面切换 / 当前页指示
- 导入角色卡入口
- 房间设置入口
- 悬浮笔记入口

### 全局资源区

包含：

- 恐惧点
- 进度钟列表

特点：

- 固定显示在页面上部
- 所有人可见可改
- 修改立即同步

### 角色卡展示区

包含：

- 当前页 4 个固定槽位
- 空槽位显示“导入角色卡”占位卡
- 每张角色卡单独垂直滚动
- 页面整体不应跟随某一张卡滚动

### 变更记录区

包含：

- 房间内最近活动流
- 按时间倒序或近似聊天流展示
- 支持展示操作人、操作对象、变更内容、时间

## 5.3 分页结构

分页规则：

- 第 1 页展示第 1 到第 4 张角色卡
- 第 2 页展示第 5 到第 8 张角色卡
- 以此类推

UI 建议：

- 顶部或底部提供页码切换
- 页签样式简单明确
- 保留“上一页 / 下一页”

开发要求：

- 分页基于角色卡数组切片，不复制数据
- 后期切换 `cardsPerPage` 时尽量不改动业务层

## 6. 数据模型设计

## 6.1 房间状态

建议新增或重构后的房间状态核心结构如下：

```ts
interface GmPanelRoomState {
  room_type: 'gm-panel'
  room_id: string
  room_name: string
  invite_code: string
  created_at: string
  expires_at: string
  players: Player[]
  gm_panel: GmPanelState
  snapshot_version: number
  updated_at: string
}
```

## 6.2 GM 面板状态

```ts
interface GmPanelState {
  cards_per_page: number
  fear: {
    value: number
    max: number
  }
  countdowns: Countdown[]
  sheets: GmPanelCharacterSheetEntry[]
  sheet_order: string[]
  activity_log: ActivityLogItem[]
}
```

说明：

- `cards_per_page` 默认 4
- `sheet_order` 决定全局排序
- 分页由前端根据 `sheet_order + cards_per_page` 计算

## 6.3 角色卡实体

```ts
interface GmPanelCharacterSheetEntry {
  id: string
  imported_at: string
  updated_at: string
  source_file_name: string
  source_format: 'mydhcharsheet-html'
  raw_character_data: ImportedCharacterData
  parsed_sheet: ResourceTrackerSheet
}
```

说明：

- `raw_character_data` 保留导入原始对象，便于后续扩展字段和重新解析
- `parsed_sheet` 提供当前 UI 直接消费的数据结构
- 如果后续要支持“导出回 HTML”或更完整字段编辑，保留原始数据很有价值

## 6.4 倒计时

可延用 `dhgc` 的思路：

```ts
interface Countdown {
  id: string
  name: string
  value: number
  max: number
  created_at: string
  updated_at: string
}
```

## 6.5 日志

```ts
interface ActivityLogItem {
  id: string
  created_at: string
  actor_player_id?: string
  actor_name: string
  kind:
    | 'sheet-import'
    | 'sheet-replace'
    | 'sheet-change'
    | 'resource-change'
    | 'fear-change'
    | 'countdown-create'
    | 'countdown-update'
    | 'countdown-delete'
    | 'sheet-reorder'
    | 'system'
  message: string
}
```

建议保留日志上限，例如最近 200 条。

## 7. HTML 导入方案

## 7.1 导入原则

第一版不解析页面 DOM，不读取视觉布局。

直接从 HTML 文本中提取：

- `window.characterData = {...}`

这是主解析路径。

## 7.2 解析流程

建议流程：

1. 读取 HTML 文件文本
2. 定位 `window.characterData =`
3. 提取对象字面量文本
4. 解析为 JS 对象
5. 将对象转换为当前面板使用的标准结构
6. 写入房间状态并广播

## 7.3 转换策略

优先复用 `dhgc` 当前 `buildTrackerSheetFromCharacterJson` 的映射规则，但输入改为 HTML 中提取出的 `characterData`。

需要注意：

- 当前函数名可改成更中性的 `buildSheetFromImportedCharacterData`
- 输入不再限定为 `.json` 文件
- `source_file_name` 保留原 HTML 文件名

## 7.4 notebook 字段处理

导入时：

- 原样保留在 `raw_character_data.notebook`
- 不映射到悬浮笔记
- 可作为未来扩展字段

第一版 UI 中可以不展示该字段，但必须避免丢失。

## 8. 角色卡展示与编辑

## 8.1 展示方式

每张角色卡建议采用“面板式摘要 + 可展开详情”结构，而不是完整还原原 HTML 页面。

原因：

- 原 HTML 很长
- 四列并排展示空间紧张
- GM 面板的目标是快速查看和改资源

建议结构：

1. 卡头
2. 资源区
3. 基础数值区
4. 叙事摘要区
5. 详情编辑入口

## 8.2 卡头

包含：

- 角色名
- 一行摘要
- 导入来源文件名
- 替换按钮

## 8.3 资源区

常驻显示并支持即时点击修改：

- 希望
- 熟练
- 生命
- 压力
- 护甲槽
- 金币

规则：

- 点击即提交
- 不走审批
- 修改后立即广播

## 8.4 基础数值区

显示：

- 等级
- 闪避
- 护甲值
- 重伤阈值
- 严重阈值
- 六维属性

编辑方式：

- 建议进入侧边抽屉或弹窗统一编辑
- 点击保存后一次性提交

## 8.5 叙事区

显示：

- 种族
- 职业
- 社群
- 子职业
- 主属性
- 经历
- 背景
- 外貌
- 动机
- 角色笔记

说明：

- `角色笔记` 是角色卡内容，不是悬浮笔记
- 应进入日志范围

## 9. 同步与权限策略

## 9.1 同步原则

沿用 `dhgc` 的核心思想：

- 同步业务结果
- 不同步编辑过程

即：

- 点击资源格时立即提交最终值
- 打开编辑面板时只在本地编辑
- 点击保存时一次性同步

## 9.2 权限判断

本项目后端应移除：

- `Only the owner or GM can change this resource`
- `requireTrackerColumnWritePermission`
- 审批相关条件判断

改为：

- 只要是房间内有效玩家，就可以改任意角色卡和全局资源

## 9.3 排序调整

因为没有“列所有者”，排序也允许所有人操作。

建议：

- 支持左右移动
- 或支持拖拽后提交

第一版优先左右移动，更稳。

## 10. 变更记录规则

## 10.1 记录原则

只记录真正提交到房间状态的变更。

不记录：

- 本地编辑中的中间状态
- 本地悬浮笔记
- 本地掷骰

## 10.2 推荐文案格式

### 导入 / 替换

- `Alice 导入了角色卡 阿德兰`
- `Bob 替换了角色卡 克利夫`

### 资源修改

- `Alice 将 阿德兰 的希望从 3 调整为 4`
- `Bob 将 克利夫 的生命从 5/7 调整为 4/7`

### 恐惧点

- `Alice 将恐惧点从 2 调整为 3`

### 进度钟

- `Bob 新增了进度钟“城门失守” (0/6)`
- `Alice 将进度钟“城门失守”从 2/6 调整为 3/6`
- `Bob 删除了进度钟“仪式完成”`

### 字段修改

- `Alice 更新了 阿德兰 的详细信息`

如果后续想更细，可以升级为字段级 diff。

## 11. 悬浮笔记设计

## 11.1 定位

悬浮笔记是本地辅助工具，不属于房间状态。

特征：

- 仅浏览器可见
- 不同步
- 不写入服务端
- 不进入活动日志

## 11.2 存储建议

建议使用浏览器本地存储：

- 优先 `localStorage`
- 若后续数据复杂度增加，可升级为 `IndexedDB`

建议 key：

- 按房间隔离，例如 `gm-panel:notebook:{roomId}`

这样同一浏览器进入不同房间时，笔记互不干扰。

## 11.3 数据模型

可直接参考 `MyDHcharsheet` 的笔记结构，但存储在单独模块中：

```ts
interface LocalNotebookData {
  pages: NotebookPage[]
  currentPageIndex: number
  isOpen: boolean
}
```

要求：

- 不写入角色卡数据
- 不依赖房间 WebSocket

## 11.4 功能范围

第一版保留：

- 文本行
- 计数器行
- 骰子行
- 分页
- 拖拽排序

第一版不做：

- 多端同步
- 共享笔记
- 房间日志集成

## 12. 前端实现建议

## 12.1 项目结构

建议参考 `dhgc/fronted` 新建独立前端应用结构：

- `src/pages`
- `src/components/gm-panel`
- `src/components/notebook`
- `src/store`
- `src/lib`
- `src/utils`

## 12.2 组件拆分建议

建议新增组件：

- `GmPanelBoard`
- `GlobalFearBar`
- `CountdownPanel`
- `CharacterSheetGrid`
- `CharacterSheetCard`
- `CharacterSheetEditor`
- `ActivityLogPanel`
- `HtmlImportButton`
- `PaginationBar`
- `FloatingNotebook`

## 12.3 布局要求

角色卡区建议：

- 桌面端四列网格
- 单卡内部 `overflow-y: auto`
- 页面外层固定高度

注意：

- 需要避免“双重滚动冲突”
- 角色卡内滚动与整页滚动要分离

## 12.4 可配置卡数

布局不要直接写：

```ts
gridTemplateColumns: 'repeat(4, 1fr)'
```

应改为根据 `cards_per_page` 推导：

- 2 张时：两列
- 3 张时：三列
- 4 张时：四列

## 13. 后端实现建议

## 13.1 路由与房间类型

建议在现有房间创建接口中新增：

- `room_type: 'gm-panel'`

创建后初始化 `gm_panel` 状态。

## 13.2 WebSocket 消息建议

建议消息类型：

- `gm.importHtmlCharacter`
- `gm.replaceHtmlCharacter`
- `gm.updateSheet`
- `gm.updateResource`
- `gm.updateFear`
- `gm.createCountdown`
- `gm.updateCountdown`
- `gm.deleteCountdown`
- `gm.moveSheet`
- `gm.updateCardsPerPage`

说明：

- 第一版 `cardsPerPage` 可先做后台字段保留，前端固定写 4
- 之后切换 2/3/4 时不必改协议

## 13.3 后端日志

每次提交后：

- 更新房间快照
- 写入活动日志
- 广播 `room.updated`

## 13.4 删除逻辑

建议补充：

- 删除某张角色卡

虽然当前需求未强制提出，但开发时最好预留，否则替换和重新整理会受限。

## 14. 部署建议

## 14.1 前端

- 使用 Cloudflare Pages 部署
- 通过环境变量配置实时后端地址

## 14.2 后端

- 使用 Cloudflare Worker + Durable Object

## 14.3 本地笔记

因为悬浮笔记不走服务端：

- 不增加后端负担
- 对 Cloudflare Pages 部署友好

## 15. 开发阶段建议

## 第一阶段：骨架迁移

- 从 `dhgc` 拷贝前后端基础架构
- 新增 `gm-panel` 房间类型
- 跑通创建房间 / 加入房间 / WebSocket 同步

## 第二阶段：HTML 导入

- 实现 HTML 文件上传
- 提取 `window.characterData`
- 转成标准角色卡结构
- 写入房间并展示

## 第三阶段：四槽位分页展示

- 实现固定 4 槽位
- 实现分页
- 实现每卡独立滚动

## 第四阶段：实时编辑

- 实现资源即时修改
- 实现角色卡编辑面板
- 实现恐惧点与进度钟
- 实现顺序调整

## 第五阶段：活动日志

- 接入所有提交类操作日志
- 打磨文案和展示样式

## 第六阶段：本地悬浮笔记

- 迁移 `MyDHcharsheet` 悬浮笔记
- 改造为按房间本地存储
- 验证不进入同步链路

## 16. 风险与注意事项

## 16.1 HTML 提取风险

风险：

- 角色卡 HTML 若导出格式变化，`window.characterData` 提取可能失效

应对：

- 提取逻辑做成独立工具函数
- 明确第一版仅支持当前导出格式
- 导入失败时给出清晰报错

## 16.2 四列拥挤风险

风险：

- 四列同时展示长角色卡时信息密度过高

应对：

- 第一版做参数化 `cardsPerPage`
- UI 上以“摘要常驻 + 详情编辑”降低拥挤度

## 16.3 日志过长风险

风险：

- 多人频繁点资源会快速刷屏

应对：

- 限制日志条数
- 视情况加入折叠或仅展示最近记录

## 16.4 笔记本地存储风险

风险：

- 用户清缓存后本地笔记丢失

应对：

- 在文档和 UI 上明确“本地笔记不参与同步”
- 后续如有需要再升级为可选同步版

## 17. 验收标准

满足以下条件视为第一版完成：

- 可创建 `gm-panel` 房间并多人加入
- 可导入 `MyDHcharsheet` 导出的 HTML 角色卡
- 房间内每页固定展示 4 个角色槽位
- 超过 4 张角色卡可翻页
- 每张角色卡独立滚动
- 所有人都能修改任意角色卡资源和字段
- 恐惧点和进度钟实时同步
- 角色卡编辑、资源修改、导入替换会写入活动日志
- 悬浮笔记可本地打开、记录、计数、掷骰
- 悬浮笔记不参与同步、不写入日志、不污染角色卡字段

## 18. 当前结论

本项目最合适的起步方式不是从零设计，而是：

- 用 `dhgc` 的实时房间架构做底座
- 把资源房间改造成“无所有权、按角色卡分页展示”的 GM 面板
- 用 `MyDHcharsheet` 的 HTML 内嵌 `characterData` 作为导入源
- 用 `MyDHcharsheet` 的悬浮笔记做本地辅助工具

这样能最大化复用已有成果，同时避开第一版最重的兼容性和同步复杂度。
