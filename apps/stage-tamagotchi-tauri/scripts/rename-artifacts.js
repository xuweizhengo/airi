import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

const require = createRequire(import.meta.url)
const packageJson = require('../package.json')

const version = packageJson.version
const target = process.argv[2]
const dirname = import.meta.dirname

console.log('version: ', version)
console.log('target: ', target)

if (!target) {
  console.error('Target is required')
  process.exit(1)
}

switch (target) {
  case 'x86_64-pc-windows-msvc':
    fs.renameSync(
      path.join(dirname, 'src-tauri', 'target', target, 'release', 'bundle', 'nsis', `airi-windows-amd64-${version}-setup.exe`),
      path.join(dirname, 'bundle', `airi-windows-amd64-${version}-setup.exe`),
    )
    break
  case 'x86_64-unknown-linux-gnu':
    fs.renameSync(
      path.join(dirname, 'src-tauri', 'target', target, 'release', 'bundle', 'appimage', `airi-linux-x64-${version}.AppImage`),
      path.join(dirname, 'bundle', `airi-linux-amd64-${version}.AppImage`),
    )
    break
  case 'aarch64-unknown-linux-gnu':
    fs.renameSync(
      path.join(dirname, 'src-tauri', 'target', target, 'release', 'bundle', 'appimage', `airi-linux-aarch64-${version}.AppImage`),
      path.join(dirname, 'bundle', `airi-linux-arm64-${version}.AppImage`),
    )
    break
  case 'aarch64-apple-darwin':
    fs.renameSync(
      path.join(dirname, 'src-tauri', 'target', target, 'release', 'bundle', 'dmg', `airi-macos-aarch64-${version}.dmg`),
      path.join(dirname, 'bundle', `airi-macos-arm64-${version}.dmg`),
    )
    break
  case 'x86_64-apple-darwin':
    fs.renameSync(
      path.join(dirname, 'src-tauri', 'target', target, 'release', 'bundle', 'dmg', `airi-macos-x64-${version}.dmg`),
      path.join(dirname, 'bundle', `airi-macos-amd64-${version}.dmg`),
    )
    break
  default:
    console.error('Target is not supported')
    process.exit(1)
}
