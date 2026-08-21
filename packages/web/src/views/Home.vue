<script setup lang="ts">
import { onMounted } from 'vue'

function goEditor() {
  location.hash = '#/editor'
}

/** 平滑滚动到页内区块（不修改路由 hash，避免与路由冲突） */
function scrollTo(id: string) {
  if (id === 'top') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// 支持从别的页面带 #/download 这类锚点进入首页时自动滚动到位
onMounted(() => {
  const h = window.location.hash
  if (h.startsWith('#/') && h.length > 2) scrollTo(h.slice(2))
})

const stats = [
  { num: '32+', label: '主题样式' },
  { num: '10', label: 'AI 能力' },
  { num: '50+', label: '热点源' },
  { num: '4', label: '导出格式' },
]

const features = [
  {
    icon: 'M9 7l-4 4 4 4M13 7l4 4-4 4',
    title: '一键复制到公众号',
    desc: 'Markdown 实时渲染成带内联样式的 HTML，点一下就能粘进微信编辑器，排版不丢失。',
  },
  {
    icon: 'M4 5h14v10H9l-5 4zM8 10h.01M12 10h.01M16 10h.01',
    title: 'AI 辅助写作（BYOK）',
    desc: '润色、扩写、续写、起标题、写摘要。用自己的 Key，DeepSeek / 豆包 / 千问 / GLM / Kimi 任选。',
  },
  {
    icon: 'M3 5h16v12H3zM3 14l4-4 3 3 3-4 6 6',
    title: '链接一键改写',
    desc: '粘贴文章链接，自动抓取正文、AI 流式改写成带出处的初稿，选题不再从零开始。',
  },
  {
    icon: 'M12 3c2 2.5-.5 4.5-.5 6.5 0 1.2.9 2 2 2s2-.8 2-2C17 11 18 12.8 18 15a6 6 0 0 1-12 0c0-3.5 3-5 4.5-8C11.3 5.7 11.5 4.4 12 3z',
    title: '热点选题',
    desc: '微博、知乎、百度等 50+ 热榜聚合一处，看到能写的，一键转选题或直接改写。',
  },
  {
    icon: 'M3 5h16v12H3zM8 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2M3 14l4-4 3 3 3-4 6 6',
    title: '配图助手',
    desc: 'AI 推荐关键词，搜索 Unsplash / Pexels 免费图库，封面一键裁成公众号 2.35:1。',
  },
  {
    icon: 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6zM9 12l2 2 4-4',
    title: '草稿箱直发',
    desc: '配置公众号开发者信息后，标题、正文、封面、摘要一键推进草稿箱——发布永远人工。',
  },
  {
    icon: 'M4 6h16v3H4zM4 11h16v3H4zM4 16h10v3H4z',
    title: '32+ 主题样式',
    desc: '日常写作、个性撞色、文艺叙事、深色沉浸四大场景分组，还能用 AI 生成专属主题。',
  },
  {
    icon: 'M6 10V7a4 4 0 0 1 8 0v3M5 10h12v10H5z',
    title: '本地优先 · 隐私',
    desc: '文档和密钥都存本地、不强制登录；桌面端离线可用。你的内容始终在你自己手里。',
  },
]

/** 迷你主题预览卡数据：中文名 + 签名色 */
const themes = [
  { name: '极简白', en: 'minimal-white', accent: '#1a1a1a' },
  { name: '微信绿', en: 'wechat-green', accent: '#07c160' },
  { name: 'GitHub', en: 'github', accent: '#0969da' },
  { name: '燕麦稿', en: 'claude-oat', accent: '#b5651d' },
  { name: '新中式', en: 'neo-chinese', accent: '#9e2b25' },
  { name: '孟菲斯', en: 'memphis', accent: '#ff5c8a' },
  { name: '全息镭射', en: 'holographic', accent: '#00cfe5' },
  { name: '赛博霓虹', en: 'cyber-neon', accent: '#ff2e97' },
]

const downloads = [
  { os: 'Windows', note: '支持 Windows 10/11 · x64 · exe 安装包', ready: true, icon: 'M3 4h14v9H3zM3 15h14v3H3zM5 6h.01M8 6h.01M11 6h.01M6 17v.01M12 17v.01' },
  { os: 'macOS', note: 'Apple Silicon / Intel · dmg', ready: false, icon: 'M12 3c2 2 3 4 3 6a4 4 0 1 1-8 0c0-2 1-4 3-6zM5 20h14v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4z' },
  { os: 'Linux', note: 'AppImage · x86_64', ready: false, icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 7v5l3 2' },
]
const releaseUrl = 'https://github.com/efarsoft/TypeDuck/releases'
</script>

<template>
  <div class="home">
    <!-- 顶部导航 -->
    <header class="nav">
      <a class="nav-brand" href="#/" @click.prevent="scrollTo('top')">
        <span class="nav-logo">🦆</span>
        <span class="nav-name">排版鸭</span>
        <span class="nav-slogan">TypeDuck</span>
      </a>
      <nav class="nav-links">
        <button class="nav-link" @click="scrollTo('features')">功能</button>
        <button class="nav-link" @click="scrollTo('themes')">主题</button>
        <button class="nav-link" @click="scrollTo('download')">下载</button>
      </nav>
      <button class="nav-cta" @click="goEditor">开始使用</button>
    </header>

    <!-- Hero -->
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-text">
          <span class="hero-tag">Markdown → 公众号精美排版</span>
          <h1 class="hero-title">排版呀，<span class="hl">交给我吧！</span></h1>
          <p class="hero-sub">
            写作者专用的公众号排版工具。左边写 Markdown，右边实时预览，点一下把带样式的文章粘进微信编辑器。
            从热点选题、AI 初稿到配图封面、草稿直发，一整个流程都在这里。
          </p>
          <div class="hero-actions">
            <button class="btn-primary" @click="goEditor">开始使用 →</button>
            <button class="btn-ghost" @click="scrollTo('download')">下载客户端</button>
          </div>
          <p class="hero-note">免费 · 本地优先 · 无需登录 · 开源 MIT</p>
        </div>
        <div class="hero-art">
          <div class="mascot-card">
            <img src="/logo-mascot.webp" alt="排版鸭吉祥物" class="mascot" width="210" height="210" />
            <div class="bubble bubble-1">一键复制 📋</div>
            <div class="bubble bubble-2">AI 帮你写 ✨</div>
            <div class="bubble bubble-3">32+ 主题 🎨</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 统计条 -->
    <section class="stats">
      <div class="stats-inner">
        <div v-for="s in stats" :key="s.label" class="stat">
          <span class="stat-num">{{ s.num }}</span>
          <span class="stat-label">{{ s.label }}</span>
        </div>
      </div>
    </section>

    <!-- 功能 -->
    <section id="features" class="section">
      <span class="eyebrow">功能</span>
      <h2 class="section-title">从选题到发布，一个工具全包了</h2>
      <p class="section-sub">
        写什么、怎么写、配什么图、怎么发——每一步都有顺手的功能接住你。
      </p>
      <div class="feature-grid">
        <div v-for="f in features" :key="f.title" class="feature-card">
          <span class="feature-icon">
            <svg viewBox="0 0 22 22" v-html="f.icon"></svg>
          </span>
          <h3 class="feature-title">{{ f.title }}</h3>
          <p class="feature-desc">{{ f.desc }}</p>
        </div>
      </div>
    </section>

    <!-- 主题展示 -->
    <section id="themes" class="section section-alt">
      <span class="eyebrow">主题</span>
      <h2 class="section-title">一套主题，一种语气</h2>
      <p class="section-sub">
        按使用场景分组：日常写作、个性撞色、文艺叙事、深色沉浸。描述一句话，AI 还能给你现造一套。
      </p>
      <div class="theme-grid">
        <div v-for="t in themes" :key="t.en" class="theme-card" @click="goEditor">
          <span class="tc-accent" :style="{ background: t.accent }"></span>
          <span class="tc-title" :style="{ color: t.accent }">{{ t.name }}</span>
          <span class="tc-line" :style="{ background: t.accent, opacity: 0.25 }"></span>
          <span class="tc-line" :style="{ background: t.accent, opacity: 0.18 }"></span>
          <span class="tc-line short" :style="{ background: t.accent, opacity: 0.12 }"></span>
        </div>
      </div>
      <div class="themes-cta">
        <button class="btn-primary" @click="goEditor">进编辑器挑主题 →</button>
      </div>
    </section>

    <!-- CTA 横幅 -->
    <section class="cta">
      <div class="cta-inner">
        <h2 class="cta-title">工具已经就位，就差你来写第一篇</h2>
        <p class="cta-sub">打开就是编辑器，不需要注册，不需要联网，先写两行试试手感。</p>
        <div class="cta-actions">
          <button class="btn-light" @click="goEditor">立即开始</button>
          <a class="btn-outline" :href="releaseUrl" target="_blank" rel="noopener">GitHub Star ⭐</a>
        </div>
      </div>
    </section>

    <!-- 下载 -->
    <section id="download" class="section">
      <span class="eyebrow">下载</span>
      <h2 class="section-title">带走一只鸭子</h2>
      <p class="section-sub">桌面端离线可用、文档存本地，还多出热点抓取、草稿直发等专属能力。</p>
      <div class="download-grid">
        <div v-for="d in downloads" :key="d.os" class="dl-card">
          <span class="dl-icon">
            <svg viewBox="0 0 24 24" v-html="d.icon"></svg>
          </span>
          <h3 class="dl-os">{{ d.os }}</h3>
          <p class="dl-note">{{ d.note }}</p>
          <a
            class="dl-btn"
            :class="{ soon: !d.ready }"
            :href="d.ready ? releaseUrl : undefined"
            target="_blank"
            rel="noopener"
          >
            {{ d.ready ? '去 GitHub 下载' : '即将推出' }}
          </a>
        </div>
      </div>
      <p class="dl-foot">所有安装包发布于 GitHub Releases · Windows v0.1.0 已就绪，随首个 Release 放出</p>
    </section>

    <!-- 页脚 -->
    <footer class="footer">
      <div class="footer-top">
        <div class="footer-brand">
          <span class="nav-logo">🦆</span>
          <div>
            <div class="footer-name">排版鸭 <span class="footer-en">TypeDuck</span></div>
            <div class="footer-slogan">排版呀，交给我吧！</div>
          </div>
        </div>
        <div class="footer-col">
          <span class="footer-head">产品</span>
          <button class="footer-link" @click="goEditor">在线使用</button>
          <button class="footer-link" @click="scrollTo('download')">下载客户端</button>
          <a class="footer-link" :href="releaseUrl" target="_blank" rel="noopener">GitHub</a>
        </div>
        <div class="footer-col">
          <span class="footer-head">关注</span>
          <span class="footer-link strong">公众号「AI猿叔」</span>
          <span class="footer-link dim-text">「人人可入门的 AI 开发课」连载中</span>
          <span class="footer-link dim-text">本工具就是课程实战项目</span>
        </div>
      </div>
      <p class="footer-copy">© 2026 排版鸭 TypeDuck · MIT License · 本地优先的公众号排版工具</p>
    </footer>
  </div>
</template>

<style scoped>
.home {
  min-height: 100%;
  background: #fff;
  color: #1a1a1a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', sans-serif;
}
/* ---------- 顶部导航 ---------- */
.nav {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 16px;
  height: 64px;
  padding: 0 32px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #f0f0f0;
}
.nav-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  text-decoration: none;
  cursor: pointer;
}
.nav-logo {
  font-size: 24px;
}
.nav-name {
  font-size: 18px;
  font-weight: 800;
  color: #1a1a1a;
}
.nav-slogan {
  font-size: 12px;
  font-weight: 600;
  color: #b0b3b8;
  letter-spacing: 0.5px;
}
.nav-links {
  margin-left: 28px;
  display: flex;
  gap: 4px;
}
.nav-link {
  border: none;
  background: transparent;
  font-size: 14px;
  color: #4e5969;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.nav-link:hover {
  background: #f3f4f6;
  color: #1a1a1a;
}
.nav-cta {
  margin-left: auto;
  height: 40px;
  padding: 0 22px;
  border: none;
  border-radius: 10px;
  background: #07c160;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
}
.nav-cta:hover {
  background: #06ad56;
}
.nav-cta:active {
  transform: scale(0.97);
}
/* ---------- Hero ---------- */
.hero {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(640px 320px at 82% 18%, rgba(7, 193, 96, 0.08), transparent 70%),
    radial-gradient(520px 280px at 12% 82%, rgba(9, 105, 218, 0.05), transparent 70%),
    linear-gradient(#fbfdfc, #fff);
}
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, #e6e8ec 1px, transparent 1px);
  background-size: 26px 26px;
  mask-image: radial-gradient(720px 420px at 60% 30%, rgba(0, 0, 0, 0.5), transparent 75%);
  -webkit-mask-image: radial-gradient(720px 420px at 60% 30%, rgba(0, 0, 0, 0.5), transparent 75%);
  pointer-events: none;
}
.hero-inner {
  position: relative;
  max-width: 1120px;
  margin: 0 auto;
  padding: 84px 32px 72px;
  display: grid;
  grid-template-columns: 1.12fr 0.88fr;
  gap: 48px;
  align-items: center;
}
.hero-tag {
  display: inline-block;
  font-size: 13px;
  font-weight: 600;
  color: #07c160;
  background: #e8f9ef;
  border: 1px solid #d3f2e0;
  padding: 6px 14px;
  border-radius: 999px;
  margin-bottom: 20px;
}
.hero-title {
  font-size: 54px;
  line-height: 1.14;
  font-weight: 800;
  margin: 0 0 20px;
  letter-spacing: -1px;
}
.hl {
  background: linear-gradient(120deg, #07c160 30%, #35d07f 70%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hero-sub {
  font-size: 17px;
  line-height: 1.85;
  color: #4e5969;
  margin: 0 0 30px;
  max-width: 540px;
}
.hero-actions {
  display: flex;
  gap: 14px;
  margin-bottom: 16px;
}
.btn-primary {
  height: 50px;
  padding: 0 30px;
  border: none;
  border-radius: 12px;
  background: #07c160;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 22px rgba(7, 193, 96, 0.28);
  transition: background 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
}
.btn-primary:hover {
  background: #06ad56;
  box-shadow: 0 10px 26px rgba(7, 193, 96, 0.34);
}
.btn-primary:active {
  transform: scale(0.98);
}
.btn-ghost {
  height: 50px;
  padding: 0 28px;
  border: 1.5px solid #d8dbe1;
  border-radius: 12px;
  background: #fff;
  color: #1a1a1a;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.btn-ghost:hover {
  border-color: #07c160;
  color: #07c160;
}
.hero-note {
  font-size: 13px;
  color: #9aa0a6;
  margin: 0;
}
/* Hero 插画 */
.hero-art {
  display: flex;
  justify-content: center;
}
.mascot-card {
  position: relative;
  width: 320px;
  height: 320px;
  border-radius: 32px;
  background: linear-gradient(135deg, #e8f9ef 0%, #eef6ff 100%);
  border: 1px solid #dcefe4;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 24px 56px rgba(7, 193, 96, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
.mascot {
  width: 210px;
  height: 210px;
  object-fit: contain;
}
.bubble {
  position: absolute;
  background: #fff;
  border: 1px solid #e7e9ee;
  border-radius: 999px;
  padding: 7px 14px;
  font-size: 12.5px;
  font-weight: 600;
  color: #1a1a1a;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.09);
  animation: float 3.4s ease-in-out infinite;
}
.bubble-1 {
  top: 18px;
  left: -22px;
}
.bubble-2 {
  top: 128px;
  right: -30px;
  animation-delay: 1.1s;
}
.bubble-3 {
  bottom: 10px;
  left: -12px;
  animation-delay: 2.2s;
}
@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}
/* ---------- 统计条 ---------- */
.stats {
  border-top: 1px solid #f0f0f0;
  border-bottom: 1px solid #f0f0f0;
  background: #fcfdfd;
}
.stats-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 30px 32px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  position: relative;
}
.stat:not(:first-child)::before {
  content: '';
  position: absolute;
  left: 0;
  top: 15%;
  bottom: 15%;
  width: 1px;
  background: #eceef1;
}
.stat-num {
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: #1a1a1a;
}
.stat-num::after {
  content: '';
  display: block;
  width: 28px;
  height: 4px;
  border-radius: 2px;
  background: #07c160;
  margin: 6px auto 0;
}
.stat-label {
  font-size: 13.5px;
  color: #6b7280;
  margin-top: 8px;
}
/* ---------- 通用区块 ---------- */
.section {
  max-width: 1120px;
  margin: 0 auto;
  padding: 84px 32px;
}
.section-alt {
  max-width: none;
  background: #fafbfc;
  border-top: 1px solid #f0f0f0;
  border-bottom: 1px solid #f0f0f0;
}
.section-alt > * {
  max-width: 1120px;
  margin-left: auto;
  margin-right: auto;
}
.eyebrow {
  display: block;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 4px;
  color: #07c160;
  text-transform: uppercase;
  margin-bottom: 12px;
}
.section-title {
  font-size: 34px;
  font-weight: 800;
  text-align: center;
  letter-spacing: -0.5px;
  margin: 0 0 12px;
}
.section-sub {
  font-size: 15.5px;
  line-height: 1.75;
  color: #6b7280;
  text-align: center;
  margin: 0 auto 48px;
  max-width: 620px;
}
/* ---------- 功能网格 ---------- */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}
.feature-card {
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 18px;
  padding: 26px 22px;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
.feature-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.07);
  border-color: #cdeede;
}
.feature-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 13px;
  background: linear-gradient(135deg, #e8f9ef, #f2fbf6);
  margin-bottom: 15px;
}
.feature-icon svg {
  width: 24px;
  height: 24px;
  stroke: #07c160;
  fill: none;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.feature-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 8px;
}
.feature-desc {
  font-size: 13.5px;
  line-height: 1.7;
  color: #6b7280;
  margin: 0;
}
/* ---------- 主题预览卡 ---------- */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
  margin-bottom: 36px;
}
.theme-card {
  position: relative;
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 16px;
  padding: 22px 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
.theme-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.07);
  border-color: #cdeede;
}
.tc-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
}
.tc-title {
  font-size: 15px;
  font-weight: 800;
}
.tc-line {
  height: 7px;
  border-radius: 4px;
  width: 100%;
}
.tc-line.short {
  width: 58%;
}
.themes-cta {
  text-align: center;
}
/* ---------- CTA 横幅 ---------- */
.cta {
  background:
    radial-gradient(560px 280px at 88% 10%, rgba(255, 255, 255, 0.14), transparent 70%),
    linear-gradient(130deg, #07c160 0%, #06b26f 55%, #059c63 100%);
}
.cta-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 72px 32px;
  text-align: center;
}
.cta-title {
  font-size: 32px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.5px;
  margin: 0 0 12px;
}
.cta-sub {
  font-size: 15.5px;
  color: rgba(255, 255, 255, 0.85);
  margin: 0 0 30px;
}
.cta-actions {
  display: flex;
  gap: 14px;
  justify-content: center;
}
.btn-light {
  height: 48px;
  padding: 0 32px;
  border: none;
  border-radius: 12px;
  background: #fff;
  color: #06ad56;
  font-size: 15.5px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16);
  transition: transform 0.1s ease;
}
.btn-light:active {
  transform: scale(0.98);
}
.btn-outline {
  display: inline-flex;
  align-items: center;
  height: 48px;
  padding: 0 28px;
  border: 1.5px solid rgba(255, 255, 255, 0.65);
  border-radius: 12px;
  color: #fff;
  font-size: 15.5px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.btn-outline:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: #fff;
}
/* ---------- 下载 ---------- */
.download-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.dl-card {
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 18px;
  padding: 32px 26px 26px;
  text-align: center;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.dl-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.06);
}
.dl-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: #f3f7f5;
  margin-bottom: 16px;
}
.dl-icon svg {
  width: 30px;
  height: 30px;
  stroke: #07c160;
  fill: none;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.dl-os {
  font-size: 19px;
  font-weight: 700;
  margin: 0 0 6px;
}
.dl-note {
  font-size: 13px;
  color: #9aa0a6;
  margin: 0 0 20px;
  min-height: 36px;
}
.dl-btn {
  display: inline-block;
  width: 100%;
  height: 44px;
  line-height: 44px;
  border-radius: 11px;
  background: #07c160;
  color: #fff;
  font-size: 14.5px;
  font-weight: 700;
  text-decoration: none;
  transition: background 0.15s ease;
}
.dl-btn:hover {
  background: #06ad56;
}
.dl-btn.soon {
  background: #f3f4f6;
  color: #9aa0a6;
  cursor: default;
}
.dl-foot {
  text-align: center;
  font-size: 13px;
  color: #9aa0a6;
  margin: 26px 0 0;
}
/* ---------- 页脚 ---------- */
.footer {
  border-top: 1px solid #f0f0f0;
  background: #fcfdfd;
}
.footer-top {
  max-width: 1120px;
  margin: 0 auto;
  padding: 48px 32px 36px;
  display: flex;
  gap: 64px;
  align-items: flex-start;
}
.footer-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.footer-name {
  font-size: 17px;
  font-weight: 800;
}
.footer-en {
  font-size: 12px;
  font-weight: 600;
  color: #b0b3b8;
  margin-left: 4px;
}
.footer-slogan {
  font-size: 12.5px;
  color: #9aa0a6;
  margin-top: 2px;
}
.footer-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.footer-col:nth-child(2) {
  margin-left: auto;
}
.footer-head {
  font-size: 13px;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 2px;
}
.footer-links a,
.footer-link {
  font-size: 13.5px;
  color: #6b7280;
  text-decoration: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-align: left;
}
.footer-links a:hover,
.footer-link:not(.dim-text):hover {
  color: #07c160;
}
.footer-link.strong {
  color: #1a1a1a;
  font-weight: 600;
}
.footer-link.dim-text {
  color: #9aa0a6;
  cursor: default;
}
.footer-copy {
  border-top: 1px solid #f0f0f0;
  padding: 18px 32px 22px;
  font-size: 12.5px;
  color: #b0b3b8;
  margin: 0;
  text-align: center;
}
/* ---------- 响应式 ---------- */
@media (max-width: 960px) {
  .hero-inner {
    grid-template-columns: 1fr;
    padding: 56px 24px 48px;
    text-align: center;
  }
  .hero-art {
    order: -1;
  }
  .hero-sub {
    margin-left: auto;
    margin-right: auto;
  }
  .hero-actions,
  .cta-actions {
    justify-content: center;
  }
  .hero-title {
    font-size: 40px;
  }
  .feature-grid,
  .theme-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .stats-inner {
    grid-template-columns: repeat(2, 1fr);
    gap: 22px 0;
  }
  .stat:nth-child(3)::before {
    display: none;
  }
  .nav-links {
    display: none;
  }
  .footer-top {
    flex-direction: column;
    gap: 28px;
  }
  .footer-col:nth-child(2) {
    margin-left: 0;
  }
}
@media (max-width: 560px) {
  .feature-grid,
  .theme-grid,
  .download-grid {
    grid-template-columns: 1fr;
  }
  .hero-title {
    font-size: 32px;
  }
  .section {
    padding: 60px 20px;
  }
  .hero-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
