/**
 * 小程序工程结构校验（代替微信开发者工具的编译检查）
 * 用法：node scripts/check-miniprogram.js
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..', 'miniprogram')
const errors = []

function mustExist(file) {
  if (!fs.existsSync(path.join(root, file))) {
    errors.push(`缺少文件: miniprogram/${file}`)
  }
}

mustExist('project.config.json')
mustExist('app.json')
mustExist('app.js')
mustExist('sitemap.json')

// 校验 app.json 中声明的页面四件套齐全
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
for (const page of appJson.pages || []) {
  for (const ext of ['.js', '.json', '.wxml', '.wxss']) {
    if (!fs.existsSync(path.join(root, page + ext))) {
      errors.push(`页面缺少文件: miniprogram/${page}${ext}`)
    }
  }
}

// 校验所有 JSON 可解析
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
    } else if (entry.name.endsWith('.json')) {
      try {
        JSON.parse(fs.readFileSync(full, 'utf8'))
      } catch (e) {
        errors.push(`JSON 解析失败: ${path.relative(root, full)} (${e.message})`)
      }
    }
  }
}
walk(root)

if (errors.length) {
  console.error('小程序工程校验失败:')
  errors.forEach((e) => console.error('  - ' + e))
  process.exit(1)
}
console.log('小程序工程结构校验通过 ✓')
