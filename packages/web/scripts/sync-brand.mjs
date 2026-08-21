/**
 * 品牌资产同步：仓库根 brand/ 是唯一源，构建/开发时同步到各包的约定位置。
 * - brand/*.png|jpg|webp|gif     → 直接复制到 packages/web/public/
 * - brand/logo.svg（透明底方标）→ 栅格化为 logo.png(512) / favicon.png(64) / desktop 图标(512)
 * - brand/logo-h.svg（白底横标）→ 栅格化 + 白底裁边 → logo-h.png（高度 200 的横向 LOGO）
 * 用法：node scripts/sync-brand.mjs（web 的 dev/build 脚本已自动前置执行）
 */
import sharp from 'sharp'
import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const brandDir = join(root, 'brand')
const publicDir = join(root, 'packages/web/public')
const desktopIconDir = join(root, 'packages/desktop/build')

if (!existsSync(brandDir)) {
  console.log('brand/ 目录不存在，跳过同步')
  process.exit(0)
}

mkdirSync(publicDir, { recursive: true })
mkdirSync(desktopIconDir, { recursive: true })

// 位图资产直接复制
const bitmaps = readdirSync(brandDir).filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f))
for (const f of bitmaps) {
  copyFileSync(join(brandDir, f), join(publicDir, f))
  console.log(`brand/${f} → web/public/`)
}

// 方形 LOGO（透明底）：栅格化出各尺寸位图
if (existsSync(join(brandDir, 'logo.svg'))) {
  const src = join(brandDir, 'logo.svg')
  await sharp(src, { density: 144 }).resize(512, 512).png().toFile(join(publicDir, 'logo.png'))
  await sharp(src, { density: 144 }).resize(64, 64).png().toFile(join(publicDir, 'favicon.png'))
  await sharp(src, { density: 144 }).resize(512, 512).webp({ quality: 90 }).toFile(join(publicDir, 'logo.webp'))
  await sharp(src, { density: 144 }).resize(512, 512).png().toFile(join(desktopIconDir, 'icon.png'))
  console.log('brand/logo.svg → logo.png / logo.webp / favicon.png / desktop icon.png')
}

// 横向 LOGO：套壳 SVG 为白底位图，栅格化后裁掉白边得到真实横向比例
if (existsSync(join(brandDir, 'logo-h.svg'))) {
  const buf = await sharp(join(brandDir, 'logo-h.svg'), { density: 144 }).png().toBuffer()
  const trimmed = await sharp(buf)
    .trim({ background: '#ffffff', threshold: 10 })
    .resize({ height: 200 })
    .png()
    .toBuffer()
  await sharp(trimmed).png().toFile(join(publicDir, 'logo-h.png'))
  await sharp(trimmed).webp({ quality: 90 }).toFile(join(publicDir, 'logo-h.webp'))
  console.log('brand/logo-h.svg → logo-h.png / logo-h.webp（白底裁边，高度 200）')
}

// og 分享卡 1200×630：绿渐变底 + slogan + LOGO 合成
if (existsSync(join(brandDir, 'logo.svg'))) {
  const logoBuf = await sharp(join(brandDir, 'logo.svg'), { density: 144 })
    .resize(190, 190)
    .png()
    .toBuffer()
  const card = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#07c160"/><stop offset="0.6" stop-color="#06b26f"/><stop offset="1" stop-color="#059c63"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.85" cy="0.15" r="0.6">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#g)"/>
    <rect width="1200" height="630" fill="url(#glow)"/>
    <text x="120" y="300" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="84" font-weight="bold" fill="#ffffff">排版呀，交给我吧！</text>
    <text x="122" y="372" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="30" fill="#d9f5e5">Markdown → 公众号精美排版 · 32+ 主题 · AI 辅助写作 · 永久免费开源</text>
    <text x="122" y="520" font-family="Consolas, monospace" font-size="26" letter-spacing="4" fill="rgba(255,255,255,0.75)">TypeDuck · typeduck.vercel.app</text>
  </svg>`
  await sharp(Buffer.from(card))
    .composite([{ input: logoBuf, left: 890, top: 220 }])
    .png()
    .toFile(join(publicDir, 'og-cover.png'))
  console.log('brand/logo.svg → og-cover.png（1200×630 分享卡）')
}
