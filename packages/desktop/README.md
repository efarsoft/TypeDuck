# @typeduck/desktop

排版鸭桌面版 —— Electron 封装，复用 `@typeduck/web` 应用与全部核心代码。

## 开发

```bash
# 需要两个终端（或先起 web 再起桌面）
pnpm dev:web        # 1. 先启动 Vite dev server（localhost:5173）
pnpm dev:desktop    # 2. Electron 窗口加载 dev server，支持 HMR
```

## 打包

```bash
pnpm build:desktop   # 先构建 web 产物，再 electron-builder 出安装包
# 或分平台：
pnpm --filter @typeduck/desktop build:win    # Windows NSIS 安装包
pnpm --filter @typeduck/desktop build:mac    # macOS DMG
pnpm --filter @typeduck/desktop build:linux  # Linux AppImage
```

产物输出到 `packages/desktop/release/`。

## 架构

```
src/main.js     主进程：窗口管理、原生菜单（文件/编辑/视图/帮助）、
                文件对话框与读写 IPC、外链转系统浏览器
src/preload.js  预加载脚本：contextBridge 白名单暴露 desktopAPI
                （openFile / saveFile / saveFileDialog / onMenu），
                contextIsolation 开启、nodeIntegration 关闭
```

渲染进程复用 `packages/web`：通过 `window.desktopAPI` 是否存在感知桌面环境，
提供「打开 .md 文件 / 保存到本地 / 另存为」能力；Web 版（无 desktopAPI）不受影响。
