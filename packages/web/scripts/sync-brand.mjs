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
  await sharp(src, { density: 144 }).resize(512, 512).png().toFile(join(desktopIconDir, 'icon.png'))
  console.log('brand/logo.svg → logo.png / favicon.png / desktop icon.png')
}

// 横向 LOGO：套壳 SVG 为白底位图，栅格化后裁掉白边得到真实横向比例
if (existsSync(join(brandDir, 'logo-h.svg'))) {
  const buf = await sharp(join(brandDir, 'logo-h.svg'), { density: 144 }).png().toBuffer()
  await sharp(buf)
    .trim({ background: '#ffffff', threshold: 10 })
    .resize({ height: 200 })
    .png()
    .toFile(join(publicDir, 'logo-h.png'))
  console.log('brand/logo-h.svg → logo-h.png（白底裁边，高度 200）')
}
