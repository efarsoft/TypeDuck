/**
 * 打包钩子（afterPack）：把鸭子图标写入主程序 exe。
 *
 * 为什么需要手动注入：electron-builder 的 winCodeSign 工具包内含 macOS 符号链接
 * （darwin/*.dylib），在本机（无开发者模式/符号链接权限）解压会失败，导致自动
 * rcedit 注入被中止，所以 `signAndEditExecutable: false` 跳过该步骤；
 * 打包完成后在这里用项目内置的 rcedit-x64.exe 手动完成图标注入
 * （执行时机在 win-unpacked 生成之后、NSIS 安装器制作之前）。
 */
const { execFileSync } = require('child_process')
const path = require('path')

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return
  const pkg = require('../package.json')
  const rcedit = path.join(__dirname, '..', 'build', 'rcedit-x64.exe')
  const exe = path.join(context.appOutDir, '排版鸭.exe')
  const icon = path.join(__dirname, '..', 'build', 'icon.ico')
  execFileSync(
    rcedit,
    [
      exe,
      '--set-icon', icon,
      '--set-version-string', 'CompanyName', 'TypeDuck',
      '--set-version-string', 'ProductName', '排版鸭',
      '--set-version-string', 'FileDescription', '排版鸭',
      '--set-version-string', 'FileVersion', pkg.version,
      '--set-version-string', 'ProductVersion', pkg.version,
    ],
    { stdio: 'inherit' },
  )
  console.log(`[after-pack] 已注入鸭子图标与版本信息（${pkg.version} / TypeDuck）→ ${exe}`)
}
