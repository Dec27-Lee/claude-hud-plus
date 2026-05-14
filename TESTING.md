# 测试策略

本项目运行在终端环境中，大多数逻辑应保持确定性。测试策略重点关注快速、可靠地验证核心行为，并为 PR 合并提供安全门禁。

## 目标

- 确定性验证核心逻辑，包括解析、聚合和格式化。
- 捕捉 HUD 输出回归，减少依赖人工检查。
- 保持测试执行足够快，方便贡献者频繁运行。

## 测试层级

1. 单元测试（快速、确定性）
   - 纯辅助函数：`getContextPercent`、`getModelName`、Token/耗时格式化。
   - 渲染辅助函数：字符串组装、截断行为。
   - Transcript 解析：工具、Agent、待办聚合和会话起点识别。

2. 集成测试（CLI 行为）
   - 用示例 stdin JSON 和 fixture transcript 运行 CLI。
   - 验证渲染输出包含预期标记，例如模型、百分比、工具名称。
   - 断言应对轻微格式变化保持稳健，避免严格匹配完整行。

3. 快照测试
   - 对已知 fixture 比较完整输出快照，用于捕捉细微 UI 回归。
   - 只有在输出变化是有意为之时才更新快照。

## 优先测试内容

- Transcript 解析：工具调用/结果映射、待办提取。
- 上下文百分比计算，包括 cache token。
- 截断和聚合：工具、待办、Agent 的显示逻辑。
- 异常或不完整输入：错误 JSON 行、缺失字段。
- Plus 能力：路由模型读取、上下文窗口覆盖、宽度兜底。

## Fixture

- 共享测试数据放在 `tests/fixtures/` 下。
- 使用小型 JSONL 文件，每个文件只覆盖一个行为，例如基础工具流、Agent 生命周期、待办更新。

## 本地运行测试

```bash
npm test
```

该命令会先运行 `npm run build`，然后执行 Node.js 内置测试运行器。

生成覆盖率：

```bash
npm run test:coverage
```

更新快照：

```bash
npm run test:update-snapshots
```

## CI 门禁建议

- `npm ci`
- `npm run build`
- `npm test`

GitHub Actions 工作流应在 Node.js 18 和 20 上运行 `npm run test:coverage`。

这些步骤应作为 PR 检查要求，确保新变更不会破坏现有行为。

## 贡献要求

- 行为变化需要新增或更新测试。
- 新辅助函数优先写单元测试。
- 用户可见输出变化优先写集成测试或快照测试。
- 测试应保持确定性；除非时间来源可控，否则避免依赖时间的断言。
