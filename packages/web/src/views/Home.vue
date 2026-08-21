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

const features = [
  {
    icon: 'M9 7l-4 4 4 4M13 7l4 4-4 4',
    title: '一键复制到公众号',
    desc: 'Markdown 实时渲染成带内联样式的 HTML，点一下就能粘进微信编辑器，排版不丢失。',
  },
  {
    icon: 'M4 5h14v10H9l-5 4zM8 10h.01M12 10h.01M16 10h.01',
    title: 'AI 辅助写作（BYOK）',
    desc: '润色、扩写、续写、生成标题、一键改写外链文章。用自己的 Key，厂商任选，数据不过第三方。',
  },
  {
    icon: 'M12 3c2 2.5-.5 4.5-.5 6.5 0 1.2.9 2 2 2s2-.8 2-2C17 11 18 12.8 18 15a6 6 0 0 1-12 0c0-3.5 3-5 4.5-8C11.3 5.7 11.5 4.4 12 3z',
    title: '32+ 主题样式',
    desc: '从干净极简到文艺衬线、深色沉浸，再到首字下沉、全息镭射等大招，覆盖你写的所有场景。',
  },
  {
    icon: 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6zM9 12l2 2 4-4',
    title: '公众号安全内联',
    desc: '样式全部用内联方案，避开微信会剥离的 class/style 标签，粘贴后所见即所得。',
  },
  {
    icon: 'M3 5h16v12H3zM3 14l4-4 3 3 3-4 6 6',
    title: '链接一键改写',
    desc: '粘贴文章链接，自动抓取正文、提取核心、AI 流式改写并带出处，选题不再从零开始。',
  },
  {
    icon: 'M6 10V7a4 4 0 0 1 8 0v3M5 10h12v10H5z',
    title: '本地优先 · 隐私',
    desc: '文档存本地、不强制登录；桌面端离线可用。你的内容始终在你自己手里。',
  },
]

// 主题色板：从现有分组中各取代表色，做视觉预览（非完整主题）
const themeSwatches = [
  { name: 'minimal-white', c: '#1a1a1a' },
  { name: 'wechat-green', c: '#07c160' },
  { name: 'github', c: '#0969da' },
  { name: 'claude-oat', c: '#b5651d' },
  { name: 'neo-chinese', c: '#9e2b25' },
  { name: 'cyber-neon', c: '#ff2e97' },
  { name: 'holographic', c: '#00e5ff' },
  { name: 'memphis', c: '#ff5c8a' },
]

const downloads = [
  { os: 'Windows', note: '支持 Windows 10/11 · x64', status: 'soon', icon: 'M3 4h14v9H3zM3 15h14v3H3zM5 6h.01M8 6h.01M11 6h.01M6 17v.01M12 17v.01' },
  { os: 'macOS', note: 'Apple Silicon / Intel · dmg', status: 'soon', icon: 'M12 3c2 2 3 4 3 6a4 4 0 1 1-8 0c0-2 1-4 3-6zM5 20h14v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4z' },
  { os: 'Linux', note: 'AppImage · x86_64', status: 'soon', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 7v5l3 2' },
]
const releaseUrl = 'https://github.com/efarh/TypeDuck/releases'
</script>

<template>
  <div class="home">
    <!-- 顶部导航 -->
    <header class="nav">
      <a class="nav-brand" href="#/" @click.prevent="scrollTo('top')">
        <span class="nav-logo">🦆</span>
        <span class="nav-name">排版鸭</span>
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
      <div class="hero-text">
        <span class="hero-tag">Markdown → 公众号精美排版</span>
        <h1 class="hero-title">排版呀，<span class="hl">交给我吧！</span></h1>
        <p class="hero-sub">
          写作者专用的微信公众号排版工具。左边写 Markdown，右边实时预览，
          点一下把带样式的文章粘进微信编辑器。32+ 主题、AI 辅助写作、链接一键改写，
          免费、本地优先、开源 MIT。
        </p>
        <div class="hero-actions">
          <button class="btn-primary" @click="goEditor">开始使用 →</button>
          <button class="btn-ghost" @click="scrollTo('download')">下载客户端</button>
        </div>
        <p class="hero-note">免费 · 本地优先 · 无需登录 · 开源 MIT</p>
      </div>
      <div class="hero-art">
        <div class="mascot-card">
          <img src="/logo-mascot.png" alt="排版鸭吉祥物" class="mascot" />
          <div class="bubble bubble-1">一键复制 📋</div>
          <div class="bubble bubble-2">32+ 主题 🎨</div>
          <div class="bubble bubble-3">AI 帮你写 ✨</div>
        </div>
      </div>
    </section>

    <!-- 功能 -->
    <section id="features" class="section">
      <h2 class="section-title">为什么用排版鸭</h2>
      <p class="section-sub">把排版这件麻烦事，变成一件顺手的事。</p>
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
      <h2 class="section-title">一套主题，一种语气</h2>
      <p class="section-sub">
        按使用场景分组：日常写作、个性撞色、文艺叙事、深色沉浸，还有首字下沉、全息镭射等"炸场"大招。
      </p>
      <div class="swatch-row">
        <div v-for="s in themeSwatches" :key="s.name" class="swatch" :title="s.name">
          <span class="swatch-dot" :style="{ background: s.c }"></span>
          <span class="swatch-name">{{ s.name }}</span>
        </div>
      </div>
      <div class="themes-cta">
        <button class="btn-primary" @click="goEditor">进编辑器挑主题 →</button>
      </div>
    </section>

    <!-- 下载 -->
    <section id="download" class="section">
      <h2 class="section-title">下载客户端</h2>
      <p class="section-sub">桌面端离线可用，文档存在本地。当前 v0.1.0，全平台陆续放出。</p>
      <div class="download-grid">
        <div v-for="d in downloads" :key="d.os" class="dl-card">
          <span class="dl-icon">
            <svg viewBox="0 0 24 24" v-html="d.icon"></svg>
          </span>
          <h3 class="dl-os">{{ d.os }}</h3>
          <p class="dl-note">{{ d.note }}</p>
          <a class="dl-btn" :class="{ soon: d.status === 'soon' }" :href="releaseUrl" target="_blank" rel="noopener">
            {{ d.status === 'soon' ? '即将推出' : '下载' }}
          </a>
        </div>
      </div>
      <p class="dl-foot">所有版本将发布在 GitHub Releases · 当前仅 Windows 安装包已就绪（v0.1.0）</p>
    </section>

    <!-- 页脚 -->
    <footer class="footer">
      <div class="footer-brand">
        <span class="nav-logo">🦆</span>
        <span class="nav-name">排版鸭</span>
        <span class="footer-slogan">排版呀，交给我吧！</span>
      </div>
      <div class="footer-links">
        <a :href="releaseUrl" target="_blank" rel="noopener">下载</a>
        <a :href="releaseUrl" target="_blank" rel="noopener">GitHub</a>
        <button class="footer-link" @click="goEditor">在线使用</button>
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
/* 顶部导航 */
.nav {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 16px;
  height: 60px;
  padding: 0 24px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid #f0f0f0;
}
.nav-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  cursor: pointer;
}
.nav-logo {
  font-size: 22px;
}
.nav-name {
  font-size: 17px;
  font-weight: 800;
  color: #1a1a1a;
}
.nav-links {
  margin-left: 24px;
  display: flex;
  gap: 4px;
}
.nav-link {
  border: none;
  background: transparent;
  font-size: 14px;
  color: #4e5969;
  padding: 8px 12px;
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
  height: 38px;
  padding: 0 20px;
  border: none;
  border-radius: 9px;
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
/* Hero */
.hero {
  max-width: 1080px;
  margin: 0 auto;
  padding: 72px 24px 56px;
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 40px;
  align-items: center;
}
.hero-tag {
  display: inline-block;
  font-size: 13px;
  font-weight: 600;
  color: #07c160;
  background: #e8f9ef;
  padding: 6px 12px;
  border-radius: 999px;
  margin-bottom: 18px;
}
.hero-title {
  font-size: 46px;
  line-height: 1.15;
  font-weight: 800;
  margin: 0 0 18px;
  letter-spacing: -0.5px;
}
.hl {
  color: #07c160;
}
.hero-sub {
  font-size: 16px;
  line-height: 1.8;
  color: #4e5969;
  margin: 0 0 28px;
  max-width: 520px;
}
.hero-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
}
.btn-primary {
  height: 46px;
  padding: 0 26px;
  border: none;
  border-radius: 10px;
  background: #07c160;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
}
.btn-primary:hover {
  background: #06ad56;
}
.btn-primary:active {
  transform: scale(0.98);
}
.btn-ghost {
  height: 46px;
  padding: 0 24px;
  border: 1.5px solid #d0d3d9;
  border-radius: 10px;
  background: #fff;
  color: #1a1a1a;
  font-size: 15px;
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
  width: 280px;
  height: 280px;
  border-radius: 28px;
  background: linear-gradient(135deg, #e8f9ef 0%, #f3f9ff 100%);
  border: 1px solid #e3f3ea;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 18px 40px rgba(7, 193, 96, 0.15);
}
.mascot {
  width: 200px;
  height: 200px;
  object-fit: contain;
}
.bubble {
  position: absolute;
  background: #fff;
  border: 1px solid #e7e9ee;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #1a1a1a;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  animation: float 3.4s ease-in-out infinite;
}
.bubble-1 {
  top: 16px;
  left: -18px;
}
.bubble-2 {
  top: 110px;
  right: -26px;
  animation-delay: 1.1s;
}
.bubble-3 {
  bottom: 8px;
  left: -8px;
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
/* 通用区块 */
.section {
  max-width: 1080px;
  margin: 0 auto;
  padding: 64px 24px;
}
.section-alt {
  max-width: none;
  background: #fafbfc;
  border-top: 1px solid #f0f0f0;
  border-bottom: 1px solid #f0f0f0;
}
.section-alt > * {
  max-width: 1080px;
  margin-left: auto;
  margin-right: auto;
}
.section-title {
  font-size: 30px;
  font-weight: 800;
  text-align: center;
  margin: 0 0 8px;
}
.section-sub {
  font-size: 15px;
  line-height: 1.7;
  color: #6b7280;
  text-align: center;
  margin: 0 auto 40px;
  max-width: 640px;
}
/* 功能网格 */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.feature-card {
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 16px;
  padding: 24px;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.07);
  border-color: #cdeede;
}
.feature-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #e8f9ef;
  margin-bottom: 14px;
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
  font-size: 17px;
  font-weight: 700;
  margin: 0 0 8px;
}
.feature-desc {
  font-size: 14px;
  line-height: 1.7;
  color: #6b7280;
  margin: 0;
}
/* 主题色板 */
.swatch-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  justify-content: center;
  margin-bottom: 32px;
}
.swatch {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 999px;
  padding: 8px 14px 8px 8px;
}
.swatch-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.08);
}
.swatch-name {
  font-size: 13px;
  color: #4e5969;
  font-weight: 500;
}
.themes-cta {
  text-align: center;
}
/* 下载 */
.download-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.dl-card {
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 16px;
  padding: 28px 24px;
  text-align: center;
}
.dl-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: #f3f4f6;
  margin-bottom: 14px;
}
.dl-icon svg {
  width: 28px;
  height: 28px;
  stroke: #07c160;
  fill: none;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.dl-os {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 6px;
}
.dl-note {
  font-size: 13px;
  color: #9aa0a6;
  margin: 0 0 18px;
  min-height: 34px;
}
.dl-btn {
  display: inline-block;
  width: 100%;
  height: 42px;
  line-height: 42px;
  border-radius: 10px;
  background: #07c160;
  color: #fff;
  font-size: 14px;
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
  margin: 24px 0 0;
}
/* 页脚 */
.footer {
  border-top: 1px solid #f0f0f0;
  padding: 36px 24px;
  max-width: 1080px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.footer-brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.footer-slogan {
  font-size: 12px;
  color: #b0b3b8;
}
.footer-links {
  display: flex;
  gap: 18px;
}
.footer-links a,
.footer-link {
  font-size: 14px;
  color: #4e5969;
  text-decoration: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.footer-links a:hover,
.footer-link:hover {
  color: #07c160;
}
.footer-copy {
  font-size: 12px;
  color: #b0b3b8;
  margin: 0;
  text-align: center;
}
/* 响应式 */
@media (max-width: 860px) {
  .hero {
    grid-template-columns: 1fr;
    padding: 48px 20px 40px;
  }
  .hero-art {
    order: -1;
  }
  .hero-title {
    font-size: 36px;
  }
  .feature-grid,
  .download-grid {
    grid-template-columns: 1fr 1fr;
  }
  .nav-links {
    display: none;
  }
}
@media (max-width: 540px) {
  .feature-grid,
  .download-grid {
    grid-template-columns: 1fr;
  }
  .hero-title {
    font-size: 30px;
  }
}
</style>
