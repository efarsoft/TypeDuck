/**
 * 品牌资产同步：仓库根 brand/ 是唯一源，构建/开发时同步到各包的约定位置。
 * - brand/*.{png,jpg,jpeg,webp,svg} → packages/web/public/（网页与编辑器引用）
 * - brand/logo.png ≥256×256        → packages/desktop/build/icon.png（窗口图标 + electron-builder）
 * 用法：node scripts/sync-brand.mjs（web 的 dev/build 脚本已自动前置执行）
 */
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

const images = readdirSync(brandDir).filter((f) => /\.(png|jpe?g|webp|svg|ico)$/i.test(f))
for (const f of images) {
  copyFileSync(join(brandDir, f), join(publicDir, f))
  console.log(`brand/${f} → web/public/`)
}

// 桌面应用图标（electron-builder 约定 build/icon.png，需 ≥256×256）
if (images.includes('logo.png')) {
  copyFileSync(join(brandDir, 'logo.png'), join(desktopIconDir, 'icon.png'))
  console.log('brand/logo.png → desktop/build/icon.png')
}
