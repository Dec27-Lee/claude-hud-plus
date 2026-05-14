# 贡献指南

感谢你为 Claude HUD Plus 贡献代码。这个仓库基于上游 Claude HUD，并在其基础上维护 Plus 增强能力；我们优先保持变更清晰、范围聚焦、便于 review。

## 如何贡献

1. Fork 并克隆仓库。
2. 创建独立分支。
3. 完成修改。
4. 运行测试，并在行为变化时更新文档。
5. 提交 pull request。

## 开发

```bash
npm ci
npm run build
npm test
```

## 测试

完整测试策略、fixture 和快照更新方式见 `TESTING.md`。

## 代码风格

- 保持修改范围小而聚焦。
- 行为变化应优先补测试。
- 除非必要，不要引入新依赖。
- 新增 Plus 能力优先放入 `src/plus/`，不要继续堆进上游核心入口文件。

## 构建产物

`src/` 是源码事实，`dist/` 是构建产物。开发时不要把 `dist/` 当源码修改；发布前通过 `npm run build` 重新生成。

```text
修改源码 → npm run build → 验证 → 发布时携带构建产物
```

## Pull Request

- 说明要解决的问题和修复方式。
- 包含测试，或说明为什么不需要测试。
- 行为变化需要同步更新相关文档。
- 相关 issue 存在时请链接。

## 发布新版本

发布新版本时：

1. 更新版本号：
   - `package.json` → `"version": "X.Y.Z"`
   - `.claude-plugin/plugin.json` → `"version": "X.Y.Z"`
   - `.claude-plugin/marketplace.json` → `"version": "X.Y.Z"`
2. 更新 `CHANGELOG.md`。
3. 运行构建和测试。
4. 提交、打 tag，并创建 GitHub release。

## 用户如何获得更新

Claude Code 插件通过 `/plugin` 界面支持更新：

- **立即更新**：从主分支获取最新版本并立即安装。
- **标记待更新**：暂存更新，稍后再安装。

Claude Code 会比较 `plugin.json` 中的 `version` 字段和本地已安装版本。提升版本号（例如 `0.1.0` → `0.1.1`）后，用户就能看到可用更新。

## 版本策略

使用语义化版本（`MAJOR.MINOR.PATCH`）：

- **PATCH**（`0.1.x`）：bug 修复、小改进。
- **MINOR**（`0.x.0`）：新功能、非破坏性变更。
- **MAJOR**（`x.0.0`）：破坏性变更。
