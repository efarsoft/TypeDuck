# Day 1：48 分钟，从空仓库到「输入 Markdown → 一键复制到公众号」

> 「造个轮子！排版鸭 TypeDuck」系列教程 · 第 3 篇
> 前置阅读：[Day 0：开发工具与 AI 编程环境准备]()

上一篇文章聊了选题和设计文档，今天正式开工：**把排版鸭从一个想法，变成一个你自己就能用的 Web 工具。**

先报战果：

- **总耗时约 48 分钟**（含环境排障、代码审查、修 bug、写 README）
- **产出**：一个可以本地跑起来的 Web 版排版鸭——左边写 Markdown，右边实时预览，一键复制，粘贴到公众号样式完整保留
- **代码**：pnpm monorepo，4 个包，核心闭环全部可用

48 分钟写完一个工具，放五年前我想都不敢想。这不是我厉害，是时代变了——而这正是这套教程想展示的东西：**AI 编程时代，一个人怎么从零做出一个真实产品。**

好，开始今天的正文。

---

## 一、排版鸭到底要做什么？一句话说清核心价值

动手之前，必须先把这个想清楚。不是因为方法论高尚，而是因为**想不清楚，后面每一步都在返工。**

我给自己的答案是一句话：

> **你负责把想法写成 Markdown，剩下的交给排版鸭——主题、预览、复制、粘贴，样式一个都不会丢。**

拆开看，这句话包含了三个承诺：

1. **写作的归写作**：你在左侧用 Markdown 写，工具不挡路；
2. **所见即所得**：右侧实时预览公众号的真实效果，不用猜；
3. **零损耗搬运**：一键复制，粘贴过去什么样就是什么样。

其中第 3 条是命门。市面上不少工具的痛点就在这：预览挺好看，粘到公众号就变形。所以整个 Day 1，我们的核心技术攻坚只有一个——**内联样式转换**（后面第三节专门拆解）。

还有一件事同样重要：**今天不做什么。**

设计文档里列了一大堆功能——AI 辅助写作、热门榜单、图床、定时发布……我全部砍掉了，Day 1 只做最小闭环：

```
输入 Markdown → 实时预览 → 一键复制到公众号
```

为什么敢砍？因为 MVP 的唯一任务是**验证核心价值**。如果「复制过去样式不丢」这件事做不爽，加一百个功能也留不住用户；反过来，只要这一件事做到位，其他功能都可以慢慢长。

> 💡 **AI 时代的工作技巧**：不要跟 AI 说「帮我做个公众号排版工具」，它会给你返回一个什么都有的四不像。要把约束说清楚。我当时的原话大概是三句话：「只做 Web 版 MVP」「本地优先，不要服务端」「主题先做 4 套精品，不追求数量」。**AI 需要边界，人负责画边界。**

---

## 二、Markdown 编辑器选型：为什么是 CodeMirror 6？

编辑器是这类工具的心脏，选型纠结了很久。候选名单：

| 候选 | 类型 | 淘汰 / 入选理由 |
|------|------|------|
| **CodeMirror 6** | 源码编辑 | ✅ 最终选择 |
| Milkdown / TipTap | 所见即所得 | 体验好，但「源码 → 公众号 HTML」的转换链路反而更绕 |
| textarea + 自己高亮 | 裸写 | 省依赖，但快捷键、撤销、语法高亮全是天坑 |
| Monaco | 源码编辑 | VS Code 同款，太重了，为写文章引一个 IDE 有点夸张 |

最后选 CodeMirror 6，三个理由：

**1. 它是为「Markdown 源码」而生的。** 排版鸭的用户写的是 Markdown 源码，不是富文本。源码编辑器给用户的安全感是「我写的每个字符都在掌控之中」——这对技术作者尤其重要。

**2. 架构是积木式的。** CodeMirror 6 没有单体包，全是可组合的扩展：想要 Markdown 语法加 `markdown()` 扩展，想要快捷键加 `keymap`，想要改主题加一个 `EditorView.theme()`。包体积按需增长。

**3. 和 markdown-it 是绝配。** 编辑区管「写」，渲染区管「看」，两边各司其职。这个组合后面会反复出现。

接入代码出奇地短：

```typescript
import { EditorView, basicSetup } from 'codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'

const view = new EditorView({
  doc: initialContent,
  extensions: [
    basicSetup,
    markdown({ codeLanguages: languages, base: markdownLanguage }),
    // 监听文档变化，驱动右侧预览
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onInput(update.state.doc.toString())
      }
    }),
  ],
  parent: editorHost,
})
```

十几行，一个带语法高亮、行号、撤销重做的专业编辑器就有了。这在手写时代是不可想象的。

---

## 三、双栏预览如何实现同步滚动？

双栏预览本身不难：监听编辑器变化 → markdown-it 渲染 → 塞进右侧容器。难的是**同步滚动**——左边往下滚，右边要跟着走，反过来也一样。

这有个经典难题：**左右两边的文档长度不成比例。** 左边一行 `# 标题`，右边渲染出来可能只占同样一行；但左边一行表格代码，右边渲染出来是三倍高。所以「滚 100px 对面也滚 100px」这种像素级同步一定是错的。

我的方案是**比例同步**：

```typescript
function setupSyncScroll() {
  let lock = false  // 锁，防止 A 滚 → 带 B 滚 → 又带 A 滚 的死循环
  const sync = (from: HTMLElement, to: HTMLElement) => {
    if (lock) return
    lock = true
    requestAnimationFrame(() => {
      const fromMax = from.scrollHeight - from.clientHeight   // from 的可滚动总量
      const toMax = to.scrollHeight - to.clientHeight         // to 的可滚动总量
      if (fromMax > 0 && toMax > 0) {
        to.scrollTop = (from.scrollTop / fromMax) * toMax     // 按百分比映射
      }
      lock = false
    })
  }
  // 两侧互相监听（略）
}
```

两个细节值得说：

- **`lock` 锁**：滚动事件是会互相触发的，A 带动 B 之后，B 的 scroll 事件又回来带动 A……没有锁就是无限循环抖动。
- **`requestAnimationFrame`**：把赋值推迟到下一帧渲染，避免一帧内连续触发多次同步，滚动更顺滑。

效果不是逐行精确对应（那需要解析 AST 做锚点映射，成本高很多），但对「写长文时大致对齐视野」完全够用。**先做 80 分的方案，够用就别过度设计。**

---

## 四、公众号「一键复制」到底怎么做到的？（本文核心）

终于到了今天的重头戏。也是排版鸭存在的理由。

### 4.1 先搞清楚敌人是谁

微信公众号编辑器有一个要命的约束：

> **它会清洗掉 `<style>` 标签和 `class` 属性。**

这意味着你在网页上习以为常的 CSS 方案——外部样式表、`<style>` 块、class 选择器——在公众号里**全部失效**。唯一活下来的是写在元素身上的内联样式：

```html
<!-- ❌ 粘到公众号会被清洗 -->
<style>.title { color: red; }</style>
<h1 class="title">标题</h1>

<!-- ✅ 公众号唯一认的写法 -->
<h1 style="color: red; font-size: 20px;">标题</h1>
```

所以「一键复制」的本质就是一句话：**在生成 HTML 的最后一步，把所有样式转成内联的，并把所有 class 干掉。**

### 4.2 渲染管线

排版鸭的完整管线长这样：

```
Markdown 源码
   │  markdown-it 解析
   ▼
带 class 的 HTML（hljs-keyword、hljs-string……）
   │  DOM 后处理：注入内联样式 + 移除所有 class
   ▼
全内联、零 class 的 HTML ──► 预览区直接展示（所见即所得）
                        ──► 复制到剪贴板（text/html 格式）
```

关键在中间那步 DOM 后处理，核心代码：

```typescript
function injectInlineStyles(html: string, theme: Theme): string {
  const container = document.createElement('div')
  container.innerHTML = html

  container.querySelectorAll('*').forEach((el) => {
    const tag = el.tagName.toLowerCase()
    let style = ''

    // 1. 按标签名注入主题样式（h1、p、blockquote……）
    if (theme.styles[tag] !== undefined) {
      style = theme.styles[tag]
    }

    // 2. 把 hljs 的 class 映射成内联颜色
    const classes = (el.getAttribute('class') || '').split(/\s+/)
    for (const cls of classes) {
      if (theme.hljsStyleMap[cls]) style += theme.hljsStyleMap[cls]
    }

    if (style) el.setAttribute('style', style)
    el.removeAttribute('class')  // 3. 斩草除根
    el.removeAttribute('id')
  })

  return container.innerHTML
}
```

代码高亮是重灾区：highlight.js 输出的代码 token 全是 class（`hljs-keyword`、`hljs-string`……），需要一个映射表把它们翻译成内联颜色：

```typescript
const HLJS_STYLE_MAP = {
  'hljs-keyword':  'color:#d73a49;font-weight:600;',
  'hljs-string':   'color:#032f62;',
  'hljs-comment':  'color:#6a737d;font-style:italic;',
  'hljs-number':   'color:#005cc5;',
  // ……几十项
}
```

这个映射表每个主题一套（浅色主题用 GitHub 配色，暗色主题用 Atom One Dark 配色），所以「极夜黑」主题复制过去的代码块，到了公众号依然是暗色的。

### 4.3 一个容易漏掉的设计：预览和复制共用同一份 HTML

实现时有个偷懒但正确的设计：**预览区展示的、和复制到剪贴板的，是同一份全内联 HTML。**

好处是天然的所见即所得——你在预览里看到什么，粘到公众号就是什么，不存在「两张皮」。很多工具的翻车就在这：预览用一套 CSS 渲染，复制时再做一次转换，两套逻辑稍有出入就变形。

我们就真踩过一个这方面的坑（下一节详述）。

### 4.4 复制动作本身

复制用的是浏览器原生的异步剪贴板 API，写入 `text/html` 格式：

```typescript
async function copyHtmlToClipboard(html: string): Promise<boolean> {
  const blob = new Blob([html], { type: 'text/html' })
  await navigator.clipboard.write([
    new ClipboardItem({ 'text/html': blob })
  ])
  return true
}
```

注意必须是 **`text/html`** 而不是纯文本——公众号编辑器接收的是富文本。粘贴时它读到的就是那份全内联 HTML，样式自然完整保留。

---

## 五、代码审查：一次揪出 2 个 P0 的「事故现场」

按理说写到这该庆祝了，但我做了一件事：**让 AI 把整个代码库静态审查了一遍。**

结果不太好看——审查报告列了十几个问题，其中两个是 P0 级：

### P0-1：切换文档会丢数据（数据丢失！）

当时的保存逻辑是 500ms 防抖：

```typescript
// ❌ 有 bug 的版本
function markUnsaved() {
  saveState.value = 'unsaved'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveActive, 500)  // 500ms 后才执行 saveActive
}

async function saveActive() {
  const doc = activeDoc.value   // ← 灾难在这：执行时才读"当前活动文档"
  await db.putDoc(doc)
}
```

看出问题了吗？场景复现：

1. 你在文档 A 里打字，触发了 500ms 防抖定时器；
2. 你手快，第 300ms 就点了文档 B——`activeDoc` 变成了 B；
3. 第 500ms，定时器到点执行 `saveActive()`，读到的 `activeDoc` 已经是 **B**；
4. **A 的改动从未写入 IndexedDB。** 此时刷新页面，A 的内容回退。

修复的思路只有一句话：**保存目标在创建定时器时就捕获，不要在执行时才去找。**

```typescript
// ✅ 修复后
function markUnsaved() {
  const doc = activeDoc.value     // 立刻捕获
  saveState.value = 'unsaved'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveDoc(doc), 500)   // 存的就是当时那个 doc
}
```

再加两道保险：切换文档前强制 flush 一次；监听 `visibilitychange` / `beforeunload`，页面隐藏或关闭前兜底落盘。

### P0-2：导出的 HTML 缺了主题基础样式

预览和复制都用了 `<section style="主题root样式">` 包裹正文，但导出文件的 `<section>` 忘了注入这个 root 样式——导出的 HTML 用的是浏览器默认 16px 字体，和预览完全两回事。一个参数的事，但用户拿到手的就是「货不对板」。

### 这一节想说的观点

**AI 写的代码也要审，而且 AI 可以审 AI。**

第一遍开发是 AI 写的，审查也是 AI 做的，修复还是 AI 做的——一轮下来 9 个问题清零。人在其中的作用是：看懂审查报告、判断哪些是真问题（P0-1 数据丢失，必须修）、哪些可以缓（原生 `confirm` 弹窗丑，不影响功能）。

**AI 时代开发者的核心技能，正在从「写代码」变成「审代码」。**

---

## 六、Web MVP 部署到 Vercel，3 分钟上线

代码写完只是半成品，**能被别人点开的链接才是产品。** 部署 Vercel 全程不超过 3 分钟：

1. 打开 [vercel.com](https://vercel.com)，用 GitHub 账号登录；
2. `Add New Project` → 选中 TypeDuck 仓库；
3. 因为是 monorepo，设置一下 **Root Directory** 为 `packages/web`（Vite 项目 Vercel 会自动识别，构建命令 `pnpm build`、产物目录 `dist` 都是自动带出的）；
4. 点 Deploy，等一杯咖啡凉一半的时间，上线。

部署完成后你会得到一个 `xxx.vercel.app` 的域名，并且——这是最爽的部分——**以后每次 `git push`，Vercel 自动重新部署**。写代码、推送、刷新网页，新版本就到了。

几个小提示：

- 免费额度对个人项目绰绰有余，流量大了再考虑别的；
- 国内访问 vercel.app 时快时慢，讲究的话可以绑自己的域名；
- 剪贴板 API 要求安全上下文（https 或 localhost），Vercel 天然是 https，正好满足。

**至此，Day 1 的核心产出达成：**

> 🦆 **在线地址**：https://typeduck.vercel.app/
> 📦 **代码仓库**：https://github.com/efarsoft/TypeDuck
> **输入 Markdown → 选主题 → 一键复制 → 粘贴到公众号，样式完整保留。**

---

## 今日总结

回顾一下今天的关键决策，供你参考：

| 决策 | 理由 |
|------|------|
| MVP 只做「复制闭环」 | 先验证核心价值，其他功能后置 |
| CodeMirror 6 + markdown-it | 源码编辑的安心感 + 插件化渲染，各司其职 |
| 全内联样式 + 预览复制共用一份 HTML | 从根上消灭「预览和实际两张皮」 |
| monorepo（core / shared-ui / web / desktop） | 为明天桌面版铺路，80% 代码直接复用 |
| AI 开发 + AI 审查 + 人来拍板 | 审出 2 个 P0，一轮修复清零 |

还有一个数字想留给你：**48 分钟**。五年前，这个工作量以「人日」为单位；今天以「分钟」计。变化的不是我会写代码了，而是**流程变了**——需求裁剪、约束表达、方案拍板、结果审查，人只做这四件事。

这也是这套教程真正想教的东西。

---

## 篇末钩子

Web 版已经能用了，但每次开浏览器总觉得差了点意思：

- 得先打开浏览器、输网址，没有「双击图标就开写」的顺滑；
- 文章存在浏览器的 IndexedDB 里，换个浏览器就找不到了；
- 想直接编辑本地的 `.md` 文件？做不到。

明天，我们给排版鸭套上一个壳——**用 Electron 把它变成真正的桌面应用**。好消息是：得益于今天的 monorepo 架构，80% 的代码一行都不用改。

> **Day 2 预告：桌面版 Electron 封装——主进程与渲染进程、原生菜单、本地文件系统，以及那个经典问题：为什么不用 Tauri？**

---

*「排版鸭」开发教程连载中，关注公众号「**AI猿叔**」第一时间收到更新。*

*系列导航：[Day 0]() · [Day 1（本文）]() · Day 2（明天见）*
