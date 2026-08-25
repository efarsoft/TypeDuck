# 排版鸭 Skill 化方案

> 目标：把 core 的排版能力输出为 CLI + 多平台 Skill 定义文件
> 让 Claude Code / Codex / OpenClaw / WorkBuddy 的用户一句话调用排版鸭

## 整体架构

```
npm install -g typeduck          ← 用户装一次 CLI

AI Agent（Claude Code 等）
  → 用户说「帮我把这篇文章排版成公众号格式」
  → Agent 读到 Skill 定义文件
  → Agent 执行: typeduck format --theme wechat-green
  → 输出 WeChat 兼容 HTML（内联样式 + !important）
  → 用户复制粘贴到公众号后台
```

## 第一层：CLI 工具（packages/cli/）

```bash
# 排版
typeduck format --theme wechat-green --input article.md
# → 输出 article.html（WeChat 兼容，内联样式）

# 列出主题
typeduck themes
# → 32 套主题列表 + 每套的一句话描述

# 复制到剪贴板
typeduck format --theme claude-oat --copy
# → 直接读 stdin，排版后复制到剪贴板

# 管道模式（Agent 最常用）
cat article.md | typeduck format --theme github
# → stdout 输出 HTML
```

## 第二层：Skill 定义文件（skills/）

### Claude Code（.claude/skills/typeduck.md）

```markdown
---
name: typeduck-format
description: 用排版鸭将 Markdown 排版为公众号格式（32 套主题）
---

# 排版鸭格式化技能

当用户需要将 Markdown 文章排版为微信公众号格式时使用此技能。

## 使用方式

1. 确认用户想要的主题风格（默认 wechat-green）
2. 运行命令：
   \`\`\`bash
   typeduck format --theme {theme} --input {file.md}
   \`\`\`
3. 输出的 HTML 可直接粘贴到公众号编辑器

## 可用主题（32 套）

日常写作：minimal-white, wechat-green, github, medium, smartisan-note...
个性撞色：classic-blue, bauhaus, warm-orange, xiaohongshu, memphis...
文艺叙事：claude-oat, nyt-paper, neo-chinese, morandi, magazine...
深色沉浸：dark-night, linear-dark, terminal, cyber-neon...

运行 `typeduck themes` 查看完整列表。

## 注意事项

- 所有样式已内联化 + !important 加固，粘贴到公众号不丢样式
- 用户可描述风格，AI 生成自定义主题（typeduck theme --generate "莫兰迪灰绿"）
```

### Codex（AGENTS.md 或 .codex/skills/typeduck.md）

与 Claude Code 格式类似，但按 Codex 的技能文件规范。

### OpenClaw（skills/typeduck/）

```yaml
# skills/typeduck/skill.yaml
name: typeduck-format
version: 1.0.0
description: 用排版鸭将 Markdown 排版为公众号格式
instructions: |
  当用户需要排版公众号文章时：
  1. 读取 Markdown 内容
  2. 确定主题（默认 wechat-green）
  3. 执行: typeduck format --theme {theme}
  4. 返回 HTML 结果
commands:
  - name: format
    description: 排版 Markdown 为公众号 HTML
    parameters:
      - name: theme
        type: string
        default: wechat-green
      - name: input
        type: string
        description: Markdown 文件路径
    execute: |
      typeduck format --theme {theme} --input {input}
  - name: themes
    description: 列出所有可用主题
    execute: typeduck themes
```

### WorkBuddy（skill.md）

```markdown
# 排版鸭格式化

## 触发条件
用户提到「排版」「公众号格式」「美化文章」

## 执行步骤
1. 获取 Markdown 内容
2. 询问或推断主题偏好
3. 运行 typeduck format 命令
4. 返回格式化后的 HTML
```

## 第三层：分发

### npm 包

```json
{
  "name": "typeduck",
  "version": "0.3.0",
  "bin": {
    "typeduck": "./dist/cli.js"
  },
  "dependencies": {
    "@typeduck/core": "workspace:*"
  }
}
```

用户安装：`npm install -g typeduck` 或 `npx typeduck format ...`

### Skill 市场 / 一键安装

```bash
# Claude Code 用户
npx typeduck install-skill claude

# OpenClaw 用户
npx typeduck install-skill openclaw

# 自动检测当前环境并安装
npx typeduck install-skill
```

## 实现清单

| 步骤 | 内容 | 预估 |
|------|------|------|
| 1 | packages/cli/：CLI 入口 + format/themes 命令 | 2 小时 |
| 2 | core 导出 standalone 渲染（不需要浏览器 DOM） | 1 小时 |
| 3 | skills/：四平台 Skill 定义文件 | 1 小时 |
| 4 | install-skill 命令（自动检测环境 + 复制文件） | 1 小时 |
| 5 | npm 发布 + 文档 | 1 小时 |

总计约 **6 小时**。

## 关键技术问题

### core 的浏览器依赖

当前 `render()` 使用 `document.createElement` 做样式注入。CLI 环境没有 DOM。

**解法**：用 `cheerio`（Node.js jQuery）替代 DOM 操作，或直接用正则/字符串处理做样式注入。core 已经是纯逻辑，只需要替换 DOM 层。

### 剪贴板

Node.js 剪贴板：`clipboardy` 包（跨平台）或调用系统命令。

### 主题生成

`typeduck theme --generate "描述"` 可以调 AI 生成主题——但这需要用户的 API Key。CLI 可以接受环境变量 `DEEPSEEK_API_KEY` 等，或者让 Agent 自己调 AI 后传入 JSON。
