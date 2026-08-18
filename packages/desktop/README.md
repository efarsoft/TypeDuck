# @typeduck/desktop

排版鸭桌面版占位包。

按开发计划，桌面版将在 Web MVP 验证后（P2 阶段）使用 Electron 实现：

- 主进程：`src/main/`（窗口管理、本地文件系统、原生菜单）
- 渲染进程：`src/renderer/`（复用 `@typeduck/web` 与 `@typeduck/shared-ui`）
- 预加载脚本：`src/preload/`
- 打包：`electron-builder`（长期目标迁移到 Tauri）
