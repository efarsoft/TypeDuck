# Day 2：给排版鸭套上 Electron 的壳，13 分钟变身桌面应用

> 「造个轮子！排版鸭 TypeDuck」系列教程 · 第 4 篇
> 前置阅读：Day 1《核心引擎 + Web MVP 上线》（公众号内链接，发布后回填）

昨天 Day 1 结尾我说：「Web 版已经能用了，但每次开浏览器总觉得差了点意思。」今天就把这个「差了点意思」补上。

先报战果：

- **总耗时约 13 分钟**（含 50 秒依赖下载和启动验证）
- **产出**：一个能双击打开、带原生菜单、能直接编辑本地 `.md` 文件的桌面应用
- **新代码**：3 个文件，加起来不到 300 行

13 分钟把一个 Web 应用变成桌面应用——而且 **web 版的代码一行都没改**。这不是我快，是昨天架构的功劳。今天这篇就讲清楚这中间的原理。

---

## 一、第一个问题：Electron 还是 Tauri？

做桌面版，2026 年绕不开这道选择题。先把结论放这：

> **MVP 阶段用 Electron，跑通之后如果体积/内存成为痛点，再考虑迁 Tauri。**

对比一下硬指标：

| 维度 | Electron | Tauri |
|------|----------|-------|
| 安装包体积 | 80-200 MB | < 5 MB |
| 内存占用 | 150-300 MB | < 30 MB |
| 启动速度 | 2-5 秒 | < 0.5 秒 |
| 生态成熟度 | 极高（VS Code、 Slack、Figma……） | 快速成长中 |
| 前端代码复用 | ✅ 完全复用 | ✅ 完全复用 |
| 上手成本 | 很低（就是 Node.js + Chromium） | 较高（要碰 Rust） |

Tauri 的性能碾压是真的。但注意看最后两行——**对排版鸭这个项目，Electron 的决定性优势是「今天就能跑」**：

1. 我们的渲染进程就是现成的 Vue 应用，Electron 装上就能加载；
2. Tauri 需要装 Rust 工具链、理解它的构建体系，对连载教程来说门槛高了；
3. **排版鸭是排版工具，不是常驻后台的 IM**。用户打开、排版、复制、关闭，一次几分钟。80MB 的安装包和 150MB 内存，在这个使用模式下感知很弱。

> 💡 **选型方法论**：性能差距只有在「用户能感知」的时候才算数。先选能快速验证的，等真实的用户抱怨体积了，再付出迁移成本也不迟——而且我们昨天就把核心逻辑放在独立的 `core` 包里，真要换壳，壳才几个文件？

---

## 二、一张图看懂 Electron：主进程 vs 渲染进程

Electron 应用里跑着两种进程，理解它们的关系，就理解了 Electron 的一切：

```
┌─────────────────────────────────────────────┐
│  主进程（Main Process）— Node.js 世界        │
│                                             │
│  ✅ 独占系统级能力：                          │
│     窗口管理 / 原生菜单 / 文件对话框 /         │
│     文件读写 / 系统托盘 / 通知                │
│                                             │
│  ❌ 没有页面，看不见任何 UI                    │
└──────────────┬──────────────────────────────┘
               │  IPC（进程间通信）
               │  + preload（安全桥）
┌──────────────▼──────────────────────────────┐
│  渲染进程（Renderer）— 浏览器世界              │
│                                             │
│  ✅ 就是我们的 Vue 应用，跑在 Chromium 里      │
│     DOM / IndexedDB / 剪贴板 API 全可用       │
│                                             │
│  ❌ 碰不到 Node.js，摸不着文件系统             │
└─────────────────────────────────────────────┘
```

为什么要隔这么开？**安全。** 渲染进程加载的是网页内容，网页内容是可能被攻击的。如果它直接拿着 Node 的文件系统权限，页面上一段恶意脚本就能读你整个硬盘。所以 Electron 的安全模型是：

- 渲染进程默认 **关闭** `nodeIntegration`（不给 Node）
- 默认 **开启** `contextIsolation`（隔离执行环境）
- 想用系统能力？只能通过 preload 里**白名单暴露**的接口，一个个走 IPC 申请

这个设计理念值得记住：**能力不是默认拥有的，是逐项授权的。** 跟你手机上 App 的权限管理是一个思路。

---

## 三、Web 代码「原地变身」：到底怎么套壳？

昨天设计的 monorepo 在今天兑现了。看目录：

```
packages/
├── core/        # 渲染引擎、主题 —— 桌面版 100% 复用
├── shared-ui/   # Vue 组件 —— 桌面版 100% 复用
├── web/         # Web 应用 —— 桌面版复用约 90%（加了一层环境感知）
└── desktop/     # ★ 今天的新增，全部新代码都在这
    ├── src/main.js       # 主进程（约 180 行）
    ├── src/preload.js    # 安全桥（约 40 行）
    └── electron-builder.yml
```

**新代码就是两个 JS 文件加一份打包配置。** 逐个看。

### 3.1 主进程：创建窗口

```javascript
const { app, BrowserWindow } = require('electron')

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    title: '排版鸭 TypeDuck',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // 安全默认，一个都不能少
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')  // 开发：连 Vite dev server
  } else {
    mainWindow.loadFile(path.join(process.resourcesPath, 'web', 'dist', 'index.html'))
  }                                             // 生产：加载打包进去的构建产物
}
```

注意 `loadURL` 那行——**开发模式下桌面窗口加载的就是 Vite dev server**，所以改代码桌面窗口照样热更新。这是 Electron + Vite 开发的最爽体验：Web 版和桌面版同时开发，一个 HMR 两个窗口一起刷。

### 3.2 主进程：原生菜单 + 文件 IPC

菜单的「新建/打开/保存」点击后，通过 IPC 广播给渲染进程：

```javascript
const send = (channel) => (_, focusedWindow) =>
  focusedWindow?.webContents.send(channel)

// 菜单项示例
{ label: '打开 Markdown 文件…', accelerator: 'CmdOrCtrl+O', click: send('menu:open') }
{ label: '保存到文件', accelerator: 'CmdOrCtrl+S', click: send('menu:save') }
```

文件对话框和读写则是反向的——渲染进程发起请求，主进程干活后返回结果：

```javascript
ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    properties: ['openFile'],
  })
  if (result.canceled) return null
  const content = await fs.promises.readFile(result.filePaths[0], 'utf-8')
  return { filePath: result.filePaths[0], content }
})
```

### 3.3 preload：那座「安全桥」

```javascript
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (filePath, content) => ipcRenderer.invoke('file:save', { filePath, content }),
  saveFileDialog: (content, defaultPath) => ipcRenderer.invoke('file:save-as', { content, defaultPath }),
  onMenu: (channel, callback) => {
    const allowed = ['menu:new', 'menu:open', 'menu:save', 'menu:save-as']
    if (!allowed.includes(channel)) return () => {}   // 白名单，防伪造频道
    const listener = () => callback()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
})
```

注意渲染进程拿到的 `window.desktopAPI` 只是四个函数，**`ipcRenderer` 本体永远出不了 preload**。甚至 `onMenu` 还对频道做了白名单校验——桥可以过，但只能走指定的门。

### 3.4 Web 端：一处环境感知

Vue 这边唯一的改动，就是判断「我是否跑在桌面版里」：

```typescript
const isDesktop = !!window.desktopAPI

onMounted(() => {
  if (window.desktopAPI) {
    const api = window.desktopAPI
    api.onMenu('menu:new',  () => store.createDoc())
    api.onMenu('menu:open', () => store.openFromDisk())
    api.onMenu('menu:save', () => store.saveToDisk())
    api.onMenu('menu:save-as', () => store.saveToDisk(true))
  }
})
```

`window.desktopAPI` 存在 → 桌面版，接住菜单事件、提供文件保存；不存在 → 纯浏览器，行为和昨天一模一样。**同一套代码，两个平台，零 if-else 分叉（好吧，就一个 if）。**

---

## 四、本地文件系统集成

桌面版真正超越 Web 版的能力，就是直接读写本地 `.md` 文件：

- **Ctrl+O 打开**：弹系统文件对话框，选中的 `.md` 读进来，作为新文档载入（文件名自动成为文档标题）
- **Ctrl+S 保存**：记得路径就直接写回；不记得就先弹「另存为」
- **Ctrl+Shift+S 另存为**：随手把当前内容存成新文件

实现里有几个值得说的小细节：

1. **文件路径只存在内存里**（`Map<docId, filePath>`），不进 IndexedDB——路径属于这台机器的运行时状态，换个机器它毫无意义；
2. **打开文件创建的是普通文档**，照样走自动保存、历史版本那套体系——桌面版的文件系统和 Web 版的 IndexedDB 是并存的两条保存路径，不是替换；
3. Day 1 修的那个 `randomUUID` 兜底 bug 在这里兑现了价值：桌面版打包后跑在 `file://` 协议下（非安全上下文），如果当时没修，**桌面版一打开文件就崩**。

> 💡 昨天埋的因，今天结的果。代码审查不是走过场。

---

## 五、打包：三平台安装包

开发模式跑通了，最后一步是打成真正的安装包。`electron-builder.yml`：

```yaml
appId: cn.efarsoft.typeduck
productName: 排版鸭
win:
  target: nsis          # Windows 安装包
mac:
  target: dmg           # macOS 磁盘镜像
linux:
  target: AppImage      # Linux 免安装
extraResources:
  # 把 Web 版构建产物一起打进安装包
  - from: ../web/dist
    to: web/dist
```

一条命令：

```bash
pnpm build:desktop
# = pnpm build:web（先出 Web 产物）
# + electron-builder（套壳打包）
```

在 Windows 上会得到一个 `排版鸭-0.1.0-x64-setup.exe`，双击安装、开始菜单里叫「排版鸭」。

**这里有个小坑值得记录**：打包后主进程加载页面不能用相对路径 `../../web/dist`——应用被打进 `app.asar` 归档里了，而 `extraResources` 指定的资源放在归档**外面**的 `resources/` 目录。正确姿势是 `process.resourcesPath`：

```javascript
mainWindow.loadFile(path.join(process.resourcesPath, 'web', 'dist', 'index.html'))
```

这种坑文档里写得潦草，实际打包一次才踩得到。

**开发模式也有一个同款坑：白屏**。开发时桌面窗口加载的是 Vite dev server（`http://localhost:5173`），如果 Electron 比 Vite 先启动——或者 Vite 中途挂了——`loadURL` 会在服务不存在时执行，加载失败，窗口停在白屏，**而且永远不会自动重试**。第一天跑桌面版就撞上了：进程都活着，窗口就是一片白。

修法是让主进程「等服务器就绪再加载」：

```javascript
// 轮询等待 dev server 就绪（超时后仍尝试加载一次，让错误可见）
async function waitForServer(url, timeoutMs) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      await net.fetch(url)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 300))
    }
  }
}

// createWindow 里（注意 createWindow 要声明成 async）
if (isDev) {
  await waitForServer(DEV_URL, 15000)
  await mainWindow.loadURL(DEV_URL)
}
```

改动很小，但从这以后**无论先启动哪个，桌面端都会安静地等到 web 就绪再渲染**。生产打包版不受影响（走 `loadFile` 本地文件，没有启动顺序依赖）——这个修复纯粹是给开发体验的。

顺带记一个改主进程代码的教训：Electron 的入口是 CommonJS，**不支持顶层 `await`**。我把 `await waitForServer(...)` 写进 `createWindow()` 时忘了把它声明成 `async`，Electron 直接启动报错 `SyntaxError: await is only valid in async functions`。教训一句话：**改完主进程代码，必须重启 Electron 验证，别指望它热更新。**

---

## 六、今天没做什么（同样重要）

老规矩，诚实清单：

- **系统托盘**：排版工具用完即走，常驻托盘属于过度设计，砍；
- **文件关联**（双击 .md 用排版鸭打开）：有价值但涉及系统注册表/打包配置，放到 Day 6 收官一起做；
- **多窗口**：一个窗口够用，砍；
- **自动更新**（electron-updater）：等有真实用户再说。

砍功能不是偷懒，是保证 13 分钟交付的核心闭环：**双击图标 → 打开文件 → 编辑 → 保存/复制**。

---

## 六点五、当日番外：主题系统从 4 套到 19 套

写桌面版的间隙，今天还顺手干了一件大事：**把主题从 4 套扩到 19 套**。

起因是用户反馈「预览区想参考 WeDown 和 md2wechat」，研究着研究着就把四个开源项目的主题体系全部盘了一遍（wechat-article-skills、md2wechat、neurapress、WeChat-Markdown，合计 90+ 套主题的设计分析）。

最终方案：

- **三场景分组**替代视觉分类：日常写作 / 个性表达 / 文艺叙事——用户选主题想的是"我写什么文章"，不是"我要什么风格"
- **场景化命名**：不叫「棕色主题」，叫「咖啡屋」；每套带一句话定位（"午后慢读"）
- **移植 7 + 原创 8**：Medium/Notion/Linear/Claude 燕麦这些大 IP 主题自带信任感（"我就要 Medium 那个感觉"——用户说得出名字）
- **工程沉淀**：全部内联样式加 `!important`（微信编辑器会重置未加权的行内样式，这是 WeChat-Markdown 踩出来的实战经验）

其中最有意思的发现来自 md2wechat：**它的"AI 型主题"本质是一份详细的 AI 设计提示词**——mood + 色板 + 逐元素样式规范。这直接启发了排版鸭的下一步：既然主题能被 AI"描述"出来，那 Day 3 接上 AI 之后，**「描述你想要的风格 → AI 生成一套主题 → 立即应用」**完全可行。为此我们把主题结构重构成了每主题一个独立文件夹 + 运行时注册接口——这个话题留给 Day 3 展开。

---

## 今日总结

| 决策 | 理由 |
|------|------|
| Electron 而非 Tauri | MVP 阶段「能跑」优先；core 独立成包，换壳成本已预留 |
| 主进程/preload 用纯 JS | 免构建工具链，Electron 直接跑，三个文件就是全部 |
| contextIsolation + 白名单桥 | 安全默认全开，能力逐项授权 |
| `window.desktopAPI` 环境感知 | 一套代码两个平台，Web 版零影响 |
| 文件路径存内存不存 DB | 路径是机器相关的运行时状态 |

以及一个数字：**新增代码不到 300 行，桌面版上线。** 昨天说「80% 代码不用重写」，今天实测——复用率比 80% 还高。

这 300 行里最值得带走的知识点只有一个：

> **Electron 不是「把网页变成应用」，而是「给网页安全地开了一扇通往操作系统的门」。** 门开多大、谁能过门，由你的 preload 决定。

---

## 篇末钩子

桌面版搞定了。排版鸭现在「写」和「排」都利索了，但它还只是个听话的工具——你让它排什么它排什么，一个字都不会多帮你写。

可是写公众号最难的是什么？是**写**啊。标题不够抓人、开头改八遍、写到一半卡住……

明天，我们给排版鸭装上一个大脑：**AI 辅助写作**。润色、扩写、续写、起标题——而且是用 BYOK 模式（Bring Your Own Key，自带 API Key）：你的 Key 只存在你自己电脑上，请求直接发向 AI 供应商，**不经过任何第三方服务器，包括我们的**。

> **Day 3 预告：接上 AI 辅助写作——BYOK 模式、流式输出「一个字一个字往外蹦」、以及为什么首推 DeepSeek。**

---

## 附：Day 2 工作日志（2026-08-19，总用时约 83 分钟）

| 时段 | 工作 | 用时 |
|------|------|------|
| 09:20 – 09:34 | Electron 桌面版封装 + 验证 + 提交 | ~13 分钟 |
| 09:35 – 10:00 | Day 2 文章初稿、UI/UX 方案讨论、参考站分析 | ~25 分钟 |
| 10:00 – 10:35 | 四个开源项目主题体系全量研究 + 设计方案定稿 | ~35 分钟 |
| 10:35 – 10:42 | 19 套主题实施 + 分组改造 + !important 管线 | ~7 分钟 |

**桌面版成果**：主进程 + 中文原生菜单 + contextBridge 安全桥 + 本地 .md 读写 + 三平台打包配置；新增代码 <300 行，复用 web 80%+。

**主题系统成果**（4 → 19 套，三场景分组）：

- 移植 7 套（对标 WeChat-Markdown）：Medium / Notion / Claude 燕麦 / 新闻纸 / 羊皮纸 / Bauhaus / Linear
- 原创 8 套：微信绿 / 锤子便签 / 经典蓝 / 暖橙 / 极简黑 / 秋日暖光 / 咖啡屋 / 水墨
- 工程改造：Theme 加 description、场景化分组、全内联样式 `!important` 防微信覆盖、正文基准统一 16px/1.8

**研究沉淀**（Day 3+ 素材）：布局 DNA × 色彩皮肤矩阵扩展法；场景化命名优于颜色命名；md2wechat 的「AI 提示词即主题」思路（BYOK AI 生成自定义主题的雏形）。

### 归入 Day 3 的工作事项（课程开发完成后的优化）

以下主题相关工作**计入 Day 3**，定位为「Day 3 AI 辅助写作功能开发完成后的优化项」：

- [x] 主题文件结构重构：每主题独立文件夹（`themes/<id>/index.ts`）+ `registry.ts` 注册表 + `registerTheme()` 运行时注册接口（为 AI 生成主题铺路，已完成）
- [ ] 主题视觉细节优化（按核对反馈的截图逐项微调）
- [ ] AI 生成自定义主题：描述风格 → AI 产出 Theme 对象 → `registerTheme` 注册 → localStorage 持久化，形成完整闭环

---

*「排版鸭」开发教程连载中，关注公众号「**AI猿叔**」第一时间收到更新。*

*系列导航：Day 0 · Day 1 · Day 2（本文） · Day 3（均可在公众号历史消息中查看）*
