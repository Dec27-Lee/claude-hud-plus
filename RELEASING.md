# 发布流程

本项目以 Claude Code 插件形式发布。发布版本应包含通过 `npm run build` 生成的 `dist/` 构建产物。

## 发布检查清单

1. 更新版本号：
   - `package.json`
   - `.claude-plugin/plugin.json`
   - `.claude-plugin/marketplace.json`
   - `CHANGELOG.md`

2. 安装依赖并验证：
   ```bash
   npm ci
   npm run build
   npm test
   npm run test:coverage
   ```

3. 验证插件入口：
   - `package.json` 的 `main` 指向 `dist/index.js`。
   - `.claude-plugin/plugin.json` 中的命令路径仍指向 `commands/` 下的 slash command 提示词。

4. 提交并打 tag：
   ```bash
   git tag vX.Y.Z
   ```

5. 发布：
   - 推送 tag。
   - 使用 `CHANGELOG.md` 中对应版本的内容创建 GitHub release。
