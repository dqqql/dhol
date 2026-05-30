# dhol 手机角色码房间协议说明

更新日期：2026-05-30

## 1. 文档定位

这份文档描述的是 `dhol` 项目里“手机角色码房间（`mobile-panel`）”所采用的 `dhc2_` 角色码解析协议，以及当前实现边界。

它不是旧版“给外部 agent 的迁移草稿”，而是当前项目成员的正式对接说明。

截至 2026-05-30：

- `dhol` 当前桌面 GM 面板仍然主要消费 HTML 角色卡
- 新增的手机角色码房间改为直接消费 `dhc2_` 角色码
- `dhol` 内部的共享解码实现位于：
  - `packages/shared/src/mobile-panel-code.ts`
- 当前 vendoring 的上游字典快照位于：
  - `packages/shared/src/data/builtin-base.json`

## 2. 上游真相源

`dhol` 不自己发明另一套角色码协议解释，当前唯一真相源是上游车卡器项目 `MyDHcharsheet`。

上游参考位置：

- 协议实现：`D:\Dql\Desktop\MyDHcharsheet\lib\character-code.ts`
- 字典构建：`D:\Dql\Desktop\MyDHcharsheet\lib\character-code-dictionary.ts`
- 字典源数据：`D:\Dql\Desktop\MyDHcharsheet\data\cards\builtin-base.json`
- 协议测试：`D:\Dql\Desktop\MyDHcharsheet\tests\unit\character-code.test.ts`

`dhol` 手机角色码房间只支持上游截至 2026-05-30 的“新版 v2”角色码。

## 3. 当前支持范围

### 3.1 支持

- 前缀为 `dhc2_` 的角色码
- 版本字节为 `2`
- 包含以下静态数据：
  - 等级
  - 熟练度总数
  - 闪避
  - 护甲值
  - 六个属性
  - 重伤 / 严重阈值
  - 希望上限
  - 压力上限
  - 金币当前值
  - 生命上限
  - 护甲槽总数
  - 职业 / 子职业 / 种族 / 社群 / 领域卡文本

### 3.2 不支持

- 2026-05-30 之前那批“短版 v2”角色码
- 自定义职业卡
- 自定义领域卡
- 自定义卡包字典

如果用户贴入旧短码，`dhol` 应直接报错，并提示重新在车卡器导出新版角色码。

## 4. 字典快照校验

当前 `dhol` vendoring 的 `builtin-base.json` 必须与上游快照一致。

校验点：

- 包名：`系统内置卡牌包`
- 版本：`V20251114`
- SHA256：`446F7FBB4C3C0A371D737ABAEDAEC7F5F57A69AC28D55871E1C7101498ED03C6`

条目数量应为：

- `profession`: `9`
- `subclass`: `54`
- `ancestry`: `36`
- `community`: `9`
- `domain`: `189`

只要版本、哈希、数量或数组顺序任一项不一致，都不能保证旧角色码反解正确。

## 5. 字典规则

角色码本体不存卡牌正文，只存字典索引。

因此解析器必须满足以下规则：

- 所有索引都是 `0` 基
- 索引顺序严格等于 `builtin-base.json` 原始数组顺序
- 绝对不能自行排序
- 绝对不能按名称排序
- 绝对不能按 `id` 排序

五组字典字段映射如下。

### 5.1 Profession

来源：`builtin-base.json.profession`

```ts
type ProfessionEntry = {
  id: string
  title: string
  text: string
  hopeFeature: string
}
```

- `id = raw.id`
- `title = raw["名称"]`
- `text = raw["职业特性"]`
- `hopeFeature = raw["希望特性"]`

### 5.2 Subclass

来源：`builtin-base.json.subclass`

```ts
type CardEntry = {
  id: string
  title: string
  text: string
}
```

- `id = raw.id`
- `title = raw["名称"]`
- `text = raw["描述"]`

### 5.3 Ancestry

- `id = raw.id`
- `title = raw["名称"]`
- `text = raw["效果"]`

### 5.4 Community

- `id = raw.id`
- `title = raw["名称"]`
- `text = raw["描述"]`

### 5.5 Domain

- `id = raw.id`
- `title = raw["名称"]`
- `text = raw["描述"]`

## 6. 外层格式

完整角色码格式：

```txt
dhc2_<base64url(body)>
```

说明：

- 固定前缀：`dhc2_`
- 前缀后是一个 `base64url` 编码后的二进制体
- 解码时需要先恢复成普通 Base64：
  1. `-` 还原成 `+`
  2. `_` 还原成 `/`
  3. 尾部补齐 `=` 到 4 的倍数长度

## 7. 字节序与整体布局

所有 `u16` / `i16` 都是小端序。

当前新版 v2 的最短长度是 `41` 字节。

整体布局如下：

| 偏移 | 长度 | 类型 | 含义 |
| --- | --- | --- | --- |
| 0 | 1 | `u8` | 版本，固定 `2` |
| 1 | 1 | `u8` | 等级 |
| 2 | 1 | `u8` | 熟练度总数 |
| 3 | 2 | `i16` | 闪避 |
| 5 | 2 | `i16` | 护甲 |
| 7 | 2 | `i16` | 敏捷 |
| 9 | 2 | `i16` | 力量 |
| 11 | 2 | `i16` | 灵巧 |
| 13 | 2 | `i16` | 本能 |
| 15 | 2 | `i16` | 风度 |
| 17 | 2 | `i16` | 知识 |
| 19 | 2 | `i16` | 重伤阈值 |
| 21 | 2 | `i16` | 严重阈值 |
| 23 | 1 | `u8` | 希望上限 |
| 24 | 1 | `u8` | 压力上限 |
| 25 | 1 | `u8` | 金币当前值 |
| 26 | 1 | `u8` | 生命上限 |
| 27 | 1 | `u8` | 护甲槽总数 |
| 28 | 2 | `u16?` | 职业索引，可空 |
| 30 | 2 | `u16?` | 子职业索引，可空 |
| 32 | 2 | `u16?` | 种族 1 索引，可空 |
| 34 | 2 | `u16?` | 种族 2 索引，可空 |
| 36 | 2 | `u16?` | 社群索引，可空 |
| 38 | 1 | `u8` | 领域卡数量 |
| 39 | `2 * N` | `u16[]` | 领域卡索引数组 |
| 尾部 | 2 | `u16` | 校验和 |

其中：

- `N = domainCount`
- 总长度 = `39 + 2 * N + 2`

## 8. 空值与校验

### 8.1 可空索引

特殊卡索引使用 `u16` 存储。

空值哨兵：

- 十进制：`65535`
- 十六进制：`0xFFFF`

含义：

- `0xFFFF` 表示该槽位没有卡
- 其余值表示字典下标

### 8.2 校验和

最后两个字节是校验和，规则为：

```ts
checksum = sum(all previous bytes) & 0xffff
```

也就是：

1. 取除最后 2 字节外的所有字节
2. 按无符号字节求和
3. 最终写成一个小端 `u16`

校验失败说明角色码已损坏、复制不完整或被改动。

## 9. 业务语义

### 9.1 特殊卡槽位

五个槽位语义固定：

- `profession` = 职业卡
- `subclass` = 子职业卡
- `ancestry1` = 第一张种族卡
- `ancestry2` = 第二张种族卡
- `community` = 社群卡

### 9.2 领域卡

领域卡是一个顺序数组。

导出端会扫描角色卡中的所有 `type === "domain"` 卡牌，并按扫描顺序写入。

接收方只需要：

1. 读取 `domainCount`
2. 依次读取 `domainCount` 个 `u16`
3. 按顺序映射到领域字典

### 9.3 存储的是显示值

角色码里存的是页面最终显示值，不是原始表单值：

- 熟练度存“总数”
- 闪避存“总值”
- 护甲存“总值”
- 伤害阈值存“总值”
- `hpMax` 存页面显示生命上限
- `armorMax` 存页面显示护甲槽总数

`dhol` 解析器不需要重新执行车卡器侧的派生计算。

## 10. dhol 内部角色状态模型

手机角色码房间里的单个角色条目由四层组成：

### 10.1 `source`

- 原始角色码
- 导入时间
- 最近替换时间
- 协议版本

### 10.2 `decoded`

角色码反解后的静态结构化结果。

### 10.3 `custom`

房间内自定义信息：

- `display_name`
- `experiences[]`

每条经历包含：

- `id`
- `name`
- `value`

### 10.4 `tracker`

房间内独立维护的实时资源状态：

- `hopeCurrent`
- `stress`
- `hp`
- `armor_slots`
- `goldCurrent`

## 11. 导入与替换规则

### 11.1 首次导入

导入角色码后，`tracker` 默认值为：

- `hopeCurrent = 0`
- `stress = [false ...]`，长度等于 `stressMax`
- `hp = [false ...]`，长度等于 `hpMax`
- `armor_slots = [false ...]`，长度等于 `armorMax`
- `goldCurrent = decoded.resources.goldCurrent`

### 11.2 替换角色码

替换角色码时：

- 保留角色条目 `id`
- 保留自定义名称
- 保留经历列表
- 保留资源当前进度
- 若新版上限变小，则按新上限裁剪布尔数组
- 若新版上限变大，则补空位

## 12. 推荐的解码结果结构

`packages/shared/src/types.ts` 中的 `MobilePanelDecodedCode` 即当前统一输出结构。

实现约束：

- 所有卡牌文本在解码阶段直接展开到 `specialCards` / `domains`
- 若索引越界，必须报错
- 不允许静默忽略未知索引

## 13. 错误处理要求

以下情况必须直接报错：

- 前缀不是 `dhc2_`
- 内容为空
- 长度小于 `41` 字节
- 校验和不匹配
- 版本不是 `2`
- 领域卡字节长度与 `domainCount` 不一致
- 任意特殊卡索引越界
- 任意领域卡索引越界

对旧短码的报错文案应明确提示：

- 当前 `dhol` 只支持 2026-05-30 之后的新版 v2 角色码
- 需要回到车卡器重新导出

## 14. 当前实现位置

`dhol` 当前与手机角色码房间直接相关的文件：

- 共享类型：`packages/shared/src/types.ts`
- 共享协议：`packages/shared/src/protocol.ts`
- 共享解码器：`packages/shared/src/mobile-panel-code.ts`
- 上游字典快照：`packages/shared/src/data/builtin-base.json`
- Worker 房间逻辑：`apps/realtime/src/index.ts`
- 前端房间组件：`fronted/src/components/mobile-panel/MobilePanelRoom.tsx`

## 15. 实施边界总结

当前版本的结论可以概括为：

1. `dhol` 手机房间只认新版 `dhc2_`
2. 静态角色信息来自角色码反解
3. 动态资源状态在房间内独立维护
4. 字典必须与上游快照严格一致
5. 出错时宁可明确报错，也不要静默容错
