# 排版鸭（TypeDuck）Web MVP 代码审查报告

> 审查范围：对照 `开发文档` 核对 `packages/{core,shared-ui,web}` 现有实现
> 审查方式：静态通读全部源码（按文件:行号定位），未跑实时构建（见下方「验证状态」）
> 结论概览：**P0 阻断级 bug 2 个（含 1 个数据丢失风险），P1 文档声称但未实现 3 处，P2 健壮性/一致性问题 8 处，P3 增强项若干**

---

## 一、验证状态（重要）

- 本沙箱内 `pnpm` / `corepack` 不可用（corepack 找不到 `pnpm.js`），`node_modules` 也未安装，因此**未能跑实时构建/类型检查**。
- 以下结论均基于源码静态分析，建议你本地执行以下命令做代码级验证：

```bash
pnpm install
pnpm build:web          # 验证 Web 版可编译
# 类型与规范校验（仓库当前未配置，建议补充）
npx vue-tsc --noEmit -p packages/web/tsconfig.json
```

---

## 二、P0 —— 阻断级（务必先修）

### 🔴 P0-1 切换文档会丢失上一文档的「未保存改动」（数据丢失风险）

- **位置**：`packages/web/src/stores/editor.ts:112-129`（`markUnsaved` / `saveActive`）
- **根因**：
  - `markUnsaved()` 用全局 `saveTimer` 延迟 500ms 后调用 `saveActive()`；
  - `saveActive()` 在执行时才取 `const doc = activeDoc.value`（**当前活动文档**）。
  - 场景：在文档 A 编辑中（500ms 防抖未触发）→ 切到文档 B（`selectDoc` 直接替换 `activeDoc` 引用）→ 500ms 到点 `saveActive` 取到的已是 B，于是 **A 的内存改动从未写入 IndexedDB**。若此时刷新/关闭页面，A 的改动回退到上次持久化版本。
- **修复**：保存时**捕获目标文档引用**，不要在执行时才读 `activeDoc`：

```ts
function markUnsaved() {
  const doc = activeDoc.value
  if (!doc) return
  saveState.value = 'unsaved'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveDoc(doc), 500)   // 捕获 doc
}

async function saveDoc(doc: Doc) {
  if (!doc) return
  saveState.value = 'saving'
  doc.updatedAt = Date.now()
  doc.wordCount = countWords(doc.content)
  doc.estimatedReadTime = Math.max(1, Math.ceil(doc.wordCount / 400))
  await db.putDoc(doc)
  if (activeDoc.value?.id === doc.id) saveState.value = 'saved'  // 仅当前文档才置 saved
  scheduleHistorySnapshot(doc)
}
```
（同步把 `saveActive` 的其它调用点替换为 `saveDoc(doc)`；`scheduleHistorySnapshot(doc)` 已接收 doc 参数，无需改。）
- **验证**：编辑 A 中途切到 B，等 1 秒后重载页面，确认 A 的改动已持久化；切换时状态栏不误报。

### 🟠 P0-2 导出 HTML 缺失主题基础样式 `root`（复制/导出表现不一致）

- **位置**：`packages/core/src/exporter/exportHtml.ts:2-16` 与 `packages/web/src/App.vue:68-76`
- **根因**：预览（`Preview.vue:6-8`）和复制（`App.vue:64`）都用 `<section style="root">` 包了一层主题基础样式（字号/行高/字色/`letter-spacing`）。但 `exportHtmlFile` 生成的 `<section>` 只写了 `max-width/margin/padding/background`，**没有注入 `root` 样式**。导出的 `.html` 正文会使用浏览器默认字体（16px 等），与预览/复制效果不一致。
- **修复**：给 `exportHtmlFile` 增加 `rootStyle` 参数并注入 section：

```ts
export function exportHtmlFile(title: string, bodyHtml: string, background: string, rootStyle = ''): void {
  const sectionStyle =
    `max-width:677px;margin:0 auto;padding:24px;` +
    `background:${background === '#242424' ? '#242424' : '#ffffff'};${rootStyle}`
  // <section style="${sectionStyle}">${bodyHtml}</section>
}
```
`App.vue` 调用处补传：`, store.theme.styles.root`。
- **验证**：导出极夜黑/信笺主题，浏览器打开 `.html`，确认字号/行高/字色与预览一致。

---

## 三、P1 —— 文档声称支持，但实现缺失

### 🟠 P1-1 任务列表（`- [x]`）未渲染为勾选框

- **位置**：`packages/core/src/markdown/render.ts:5-18`
- **根因**：`markdown-it` 默认**不渲染 GFM 任务列表**，需引入 `markdown-it-task-lists` 插件。当前 Welcome 文档里的 `- [x] 自动保存` 会渲染成普通文本列表项。
- **修复**：
  ```ts
  import taskLists from 'markdown-it-task-lists'
  const md = new MarkdownIt({ html:true, linkify:true }).use(taskLists, { enabled:true, label:true })
  ```
  并在 `injectInlineStyles` 中对含 `<input type="checkbox">` 的 `<li>` 补 `list-style:none`（否则会出现「圆点+勾选框」）。
- **注意**：微信公众号编辑器会清洗 `<input>`，勾选框在公众号里大概率不显示——这是平台限制，建议文档里注明「任务列表在公众号侧降级为普通文本」。
- **验证**：预览 `- [x]` 项显示勾选框；复制到公众号后降级为文本（可接受）。

### 🟠 P1-2 同步滚动未实现

- **位置**：`packages/shared-ui/src/Editor/Editor.vue`、`packages/shared-ui/src/Preview/Preview.vue`
- **根因**：文档 2.1.1 明确要求「支持同步滚动」，但两端都无滚动监听与比例映射逻辑。
- **修复**：在 Editor 暴露 `getScroller()`（`.cm-scroller`），Preview 暴露滚动容器；监听一侧 `scroll`，按 `scrollTop / scrollHeight` 比例同步另一侧。注意用 `requestAnimationFrame` 防抖并加「锁」避免回环。
- **验证**：编辑长文档，滚动任一侧，另一侧按比例跟随。

### 🟡 P1-3 文档列入「基础功能」但实现为 0 的项（需与文档对齐）

| 文档章节 | 声称 | 现状 | 建议 |
|---|---|---|---|
| 2.1.2 脚注 / 数学公式 / Mermaid | ✅ 支持 | 未实现（无 footnote / KaTeX / mermaid 插件） | 移到 P4 roadmap，或文档标注「规划中」 |
| 2.3 图片处理（粘贴/拖拽/图床/画廊） | 基础模块 | 仅有「插入图片链接」按钮 | 明确为 P2+，避免误导 |
| 2.2.1 主题数量 15-20 套 | 提供 | 仅 4 套（极简白/GitHub/极夜黑/信笺） | 下调预期为「MVP 4 套，长期补齐」 |

---

## 四、P2 —— 健壮性与一致性

### 🟡 P2-1 历史版本快照策略与文档不符

- **位置**：`packages/web/src/stores/editor.ts:131-142`（`scheduleHistorySnapshot`）
- **根因**：文档 2.4.3 要求「保留最近 30 个自动保存版本」。当前逻辑是**每次保存后启动一个 5 分钟定时器**，只有在「保存后安静 5 分钟」才会落一版。连续编辑 1 小时可能只产生 1 个快照，远低于「30 版」预期。
- **修复（任选其一）**：
  1. 每次 `saveDoc` 都落一版历史（带「内容相同则跳过」去重），更贴合文档；
  2. 改为「切换文档 / 页面失焦(visibilitychange) / 关闭前」落一版，兼顾频率与价值。
- **验证**：连续编辑并手动触发多次保存，确认历史列表按预期增长且超过旧版阈值后自动淘汰。

### 🟡 P2-2 `crypto.randomUUID()` 在非安全上下文会抛错

- **位置**：`packages/web/src/db.ts:88`（`addHistory`）、`stores/editor.ts:82`（`createDoc`）
- **根因**：`crypto.randomUUID()` 仅在 `https` / `localhost` 安全上下文可用。`file://`（Electron 渲染进程、本地双击 html）下会抛 `TypeError`，导致**新建文档/存历史直接失败**。
- **修复**：封装一个 `uuid()` 兜底：
  ```ts
  const uuid = () => (crypto?.randomUUID?.() ?? 'xxxxxxxx'.replace(/x/g, () => (Math.random()*16|0).toString(16)))
  ```
- **验证**：`file://` 下打开页面（模拟桌面版）能正常新建文档、存历史。

### 🟡 P2-3 主题选择器取色 hack 脆弱

- **位置**：`packages/shared-ui/src/ThemeSelector/ThemeSelector.vue:41`
- **根因**：`theme.styles.strong.split('color:')[1] || '#333'` 依赖 strong 样式里恰好含 `color:`。GitHub 主题的 `strong` 仅有 `font-weight:600;`（无 color），会回退到 `#333`，与主题字色不一致。
- **修复**：改用 `theme.styles.root` 的 color 作为 swatch 文字色（更稳）。
- **验证**：GitHub 主题卡片文字颜色与主题主色一致。

### 🟡 P2-4 CodeMirror 全量引入语言包，体积偏大

- **位置**：`packages/shared-ui/src/Editor/Editor.vue:5,18`
- **根因**：`import { languages } from '@codemirror/language-data'` + `codeLanguages: languages` 会一次性注册上百种语言，与文档 2.1.3「按需引入语言包」相悖，增大 bundle。
- **修复**：改为按需（仅引入常用 8-10 种：js/ts/py/java/go/rust/json/css/bash），或保留全量但确认 Vite 已做 code-split。
- **验证**：`pnpm build:web` 后对比产物体积。

### 🟡 P2-5 `core` / `shared-ui` 无独立构建产物

- **位置**：`packages/core/package.json`、`packages/shared-ui/package.json`（`main`/`types` 直接指向 `src/*.ts`）
- **根因**：Web 版靠 Vite 直接吃 TS 源文件能跑，但**桌面版（P2）/ 发布 npm 包时**没有 `dist` 与 `.d.ts`，复用会受限。
- **修复**：为 `core` / `shared-ui` 增加 `build` 脚本（Vite library mode 或 `tsc -p tsconfig.build.json --declaration`）。
- **验证**：`pnpm --filter @typeduck/core build` 产出 `dist/` 与类型声明。

### 🟡 P2-6 复制降级路径对富文本不可靠

- **位置**：`packages/core/src/clipboard/copy.ts:16-34`
- **根因**：降级用 `contentEditable + execCommand('copy')`，对 `text/html` 富文本在多数浏览器只会复制纯文本或行为不确定（且 `execCommand` 已废弃）。仅作兜底，主流浏览器有 `ClipboardItem` 时不受影响。
- **修复**：保留为兜底并加注释说明限制；可选引入 `copy-to-clipboard` 等成熟库。
- **验证**：在不支持 `ClipboardItem` 的环境（旧浏览器）确认至少有纯文本降级。

### 🟡 P2-7 删除确认用原生 `confirm`

- **位置**：`packages/web/src/App.vue:79`
- **根因**：阻断式原生弹窗样式割裂、无法自定义。属体验问题。
- **修复**：改用项目内已有的 toast/modal 组件。
- **验证**：删除流程无原生弹窗。

### 🟡 P2-8 hljs token 映射不完整

- **位置**：`packages/core/src/theme/themes.ts:4-55`
- **根因**：`hljsStyleMap` 覆盖约 27 个类，缺 `hljs-operator` / `hljs-punctuation` / `hljs-char` / `hljs-section` / `hljs-bullet` / `hljs-link` / `hljs-emphasis` / `hljs-strong` / `hljs-template-tag` 等。未命中类回退父级颜色，不影响功能但一致性略差。
- **修复**：补全常用 token 映射。
- **验证**：多语言代码块高亮配色无明显「无色」token。

---

## 五、P3 —— 增强项

| 项 | 位置 | 说明 |
|---|---|---|
| 暗色模式适配 | 2.2.3 / `exportHtml.ts` | `<head>` 已有 `color-scheme: light dark`，但正文未做 `@media (prefers-color-scheme: dark)` 适配；浅色主题用了近黑 `#1a1a1a`/`#333`，在微信暗色背景下会被反色。建议浅色主题改用灰阶、并补充暗色覆盖样式 |
| 类型/规范校验 | 仓库全局 | 缺 `eslint` + `vue-tsc` 校验；P0-1 这类逻辑 bug 靠类型/单测更易拦截 |
| 历史恢复不可撤销 | `stores/editor.ts:149-155` | `restoreHistory` 直接覆盖当前文档，恢复前版本未留快照，无法「撤销恢复」。可在恢复前先存一版当前内容 |

---

## 六、工程与构建建议（汇总）

1. **最优先修 P0-1 / P0-2**（数据丢失 + 导出不一致），二者都是小改动、高风险。
2. **补齐校验链路**：`eslint` + `vue-tsc` + 单测（至少覆盖 `saveDoc` 文档切换场景与 `render` 主题注入）。
3. **core / shared-ui 增加 library 构建**，为 P2 桌面版复用铺路。
4. **文档与实现对齐**：把脚注/公式/Mermaid/图片处理/15-20 套主题明确标记为「规划中(P4+)」，避免 MVP 阶段预期错位。
5. **桌面版（P2）**：当前 `dev:desktop`/`build:desktop` 为占位 echo，且 Electron 渲染进程走 `file://`，需提前处理 P2-2（`crypto.randomUUID`）与剪贴板权限。

---

## 七、优先级总表

| 级别 | 编号 | 问题 | 风险 |
|---|---|---|---|
| 🔴 P0 | P0-1 | 切换文档丢失未保存改动 | 数据丢失 |
| 🟠 P0 | P0-2 | 导出 HTML 缺 root 样式 | 表现不一致 |
| 🟠 P1 | P1-1 | 任务列表未渲染勾选框 | 功能缺失 |
| 🟠 P1 | P1-2 | 同步滚动未实现 | 功能缺失 |
| 🟡 P1 | P1-3 | 文档/实现范围错位（公式/图片/主题数） | 预期管理 |
| 🟡 P2 | P2-1 | 历史快照策略不符文档 | 体验 |
| 🟡 P2 | P2-2 | `crypto.randomUUID` 非安全上下文报错 | 桌面版崩 |
| 🟡 P2 | P2-3 | 主题卡取色 hack | 展示 |
| 🟡 P2 | P2-4 | 语言包全量引入 | 体积 |
| 🟡 P2 | P2-5 | core/shared-ui 无独立构建 | 架构债 |
| 🟡 P2 | P2-6 | 复制降级不可靠 | 兼容性 |
| 🟡 P2 | P2-7 | 原生 confirm | 体验 |
| 🟡 P2 | P2-8 | hljs 映射不全 | 一致性 |
| 🟢 P3 | — | 暗色适配 / 类型校验 / 恢复可撤销 | 增强 |
