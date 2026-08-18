# 排版鸭 TypeDuck

> 排版呀，交给我吧！🦆

排版鸭 是一款专为微信公众号创作者打造的 Markdown 排版与发布工具，定位为 “本地优先、完全免费、AI 赋能” 的内容创作全流程助手。

## 功能（Web MVP）

- ✅ Markdown 编辑 + 双栏实时预览（CodeMirror 6 + markdown-it + highlight.js）
- ✅ 4 套精选主题：极简白 / GitHub / 极夜黑 / 信笺（全内联样式，预览即所得）
- ✅ 一键复制到公众号（`text/html` 富文本，无 class 残留）
- ✅ 导出独立 HTML 文件
- ✅ 多文档管理（IndexedDB，500ms 防抖自动保存）
- ✅ 历史版本（每文档保留最近 30 版，支持恢复）

## 开发

```bash
pnpm install

# 开发 Web 版
pnpm dev:web

# 构建 Web 版
pnpm build:web
```

## 结构

```
packages/
├── core/        # Markdown 解析、主题引擎、剪贴板、导出
├── shared-ui/   # Vue 组件（编辑器、预览、工具栏等）
├── web/         # Web 版应用
└── desktop/     # 桌面版（占位，P2 阶段实现）
```

## License

MIT
