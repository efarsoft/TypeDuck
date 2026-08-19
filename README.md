<div align="center">

# 排版鸭 TypeDuck 🦆

**排版呀，交给我吧！**

专为微信公众号创作者打造的 Markdown 排版与发布工具

**本地优先 · 完全免费 · AI 赋能 · MIT 开源**

[![License: MIT](https://img.shields.io/badge/License-MIT-07c160.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933.svg)]()
[![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D.svg)]()
[![Vite](https://img.shields.io/badge/Vite-5-646CFF.svg)]()
[![在线使用](https://img.shields.io/badge/在线使用-typeduck.vercel.app-07c160.svg)](https://typeduck.vercel.app/)

[功能一览](#-核心功能day-1--web-mvp-已上线) · [快速开始](#-快速开始) · [开发路线](#️-开发路线) · [在线使用](https://typeduck.vercel.app/) · [关注公众号](#-关注公众号)

</div>

---

## 为什么做排版鸭？

如果你写公众号文章，尤其是技术文章，一定懂这种痛苦：

> AI 吐出来的是 Markdown，但公众号编辑器吃的是 HTML。

花一小时写完内容，再花半小时调格式——字号、行距、颜色、标题层级……代码块更是灾难现场。

**排版鸭** 只做一件事：你在左边写 Markdown，右边实时预览公众号效果，点击「一键复制」，粘贴到公众号后台——**所有样式完整保留**，一个格式都不用再调。

## ✨ 核心功能（Day 1 · Web MVP 已上线）

| 功能 | 说明 |
|------|------|
| ✍️ **双栏实时预览** | 左侧 Markdown（CodeMirror 6），右侧手机宽度公众号预览，同步滚动 |
| 🎨 **精选主题** | 极简白 / GitHub / 极夜黑 / 信笺，一键切换，持续增加中 |
| 💻 **代码高亮** | highlight.js 全语言支持，复制到公众号高亮样式完整保留 |
| ✅ **任务列表** | `- [x]` 语法渲染为勾选框（公众号侧降级为普通文本，属平台限制） |
| 📋 **一键复制到公众号** | 全部样式内联化，粘贴即用，与预览所见即所得 |
| 📤 **导出 HTML** | 导出独立 `.html` 文件，可直接在浏览器打开 |
| 📁 **多文档管理** | IndexedDB 本地存储，500ms 防抖自动保存，切换/关闭前兜底落盘 |
| 🕘 **历史版本** | 每文档保留最近 30 版快照，随时对比恢复（恢复前自动留快照） |
| 🔒 **本地优先** | 数据全部存在你自己的浏览器里，无需注册登录，不经过任何服务器 |

## 🚀 快速开始

```bash
# 克隆项目
git clone https://github.com/efarsoft/TypeDuck.git
cd TypeDuck

# 安装依赖（需要 Node 18+ 和 pnpm；没有 pnpm 可用 corepack enable pnpm）
pnpm install

# 启动开发服务器
pnpm dev:web
# 打开 http://localhost:5173

# 构建 Web 版
pnpm build:web
```

## 🗺️ 开发路线

排版鸭采用 **"一个核心，两套外壳"** 架构（`core` + `shared-ui` 为共享核心，Web 版与桌面版复用 80% 以上代码），并配套一套 **7 天连载实战教程**，完整记录从零到一的全过程：

| 天数 | 主题 | 核心产出 | 状态 |
|:---:|------|----------|:---:|
| **Day 0** | 开发工具与 AI 编程环境准备 | 开发环境就绪 | ✅ |
| **Day 1** | 核心引擎 + Web MVP 上线 | 输入 Markdown → 一键复制到公众号 | ✅ **当前版本** |
| **Day 2** | 桌面版 Electron 封装 | 三平台桌面应用 | ⏳ |
| **Day 3** | AI 辅助写作（BYOK 模式） | 润色 / 扩写 / 续写 / 标题生成 | ⏳ |
| **Day 4** | 高级功能：榜单 + 选题 + 配图 | 创作全流程覆盖 | ⏳ |
| **Day 5** | 自动运营：定时任务 + 微信草稿箱 | 排版鸭 7×24 自动工作 | ⏳ |
| **Day 6** | 收官：上线 + 开源 + 复盘 | 完整发布，教程完结 | ⏳ |

## 📦 项目结构

```
packages/
├── core/        # 核心引擎：Markdown 渲染、主题系统、内联样式转换、剪贴板、导出
├── shared-ui/   # 共享 Vue 组件：编辑器、预览、工具栏、主题选择器、文档列表
├── web/         # Web 版应用（Vue 3 + Vite + Pinia + IndexedDB）
└── desktop/     # 桌面版（Day 2 实现）
```

**技术栈**：Vue 3 · TypeScript · Vite · CodeMirror 6 · markdown-it · highlight.js · Pinia · IndexedDB

## 🙏 致谢与参考

排版鸭的诞生离不开社区里优秀的先行者：

- [doocs/md](https://github.com/doocs/md) —— 微信公众号 Markdown 编辑器的标杆
- [mdnice](https://mdnice.com) —— 主题系统的灵感来源之一
- [文颜 CORE](https://github.com/caol64/wenyan-core) —— 公众号排版核心库
- [WeiMD](https://github.com/maoruibin/WeiMD) —— 更优雅的 Markdown 公众号排版工具，本地优先 + 多图床 + 深色模式预览

**友情推荐**：如果你想要「说一句话，AI 自动完成选题、写作、排版、配图到发布」的全自动流程，可以看看 [wechat-article-skills](https://github.com/aiworkskills/wechat-article-skills) —— 一款开源的公众号 AI 运营助手（数字员工）。它和排版鸭刚好互补：**排版鸭适合「自己写、自己排」的创作者，它适合「AI 代办全流程」的运营者。**

**没有它们趟过的路，就没有排版鸭。** 排版鸭不是要取代谁，只是想做一个「我自己用着舒服」的工具。

## 📄 开源协议

**MIT License** —— 大白话版：这代码你随便用、随便改、随便分发、拿去商用都行，唯一的要求是保留版权声明。出了任何问题，别找我。

详见 [LICENSE](LICENSE)。

## 🤝 反馈交流

- 发现 bug 或有功能建议？欢迎提 [Issue](https://github.com/efarsoft/TypeDuck/issues)
- 觉得有用？点个 ⭐️ 支持一下

## 💬 关注公众号

教程连载、开发日志、使用技巧都会在公众号首发，欢迎关注「**AI猿叔**」一起交流。

<div align="center">

<img src="docs/images/wechat-qrcode.jpg" width="240" alt="关注公众号二维码" />

**「扫码关注，一起造轮子」**

</div>

---

<div align="center">

> "排版呀，交给我吧！" 🦆

</div>
