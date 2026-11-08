// Generate build/icon.ico from resources/icon.png using Pillow (via mise python).
// Requires: mise python with Pillow installed (mise use python && pip install Pillow)
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { writeFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const srcPng = resolve(root, 'resources/icon.png')
const dstIco = resolve(root, 'build/icon.ico')

// Write a small temp Python script to avoid shell quoting issues on Windows.
const tmpPy = resolve(root, '.tmp-gen-icon.py')
writeFileSync(tmpPy, `
from PIL import Image
import os

src = r'${srcPng.replace(/\\/g, '\\\\')}'
dst = r'${dstIco.replace(/\\/g, '\\\\')}'
img = Image.open(src).resize((256, 256), Image.LANCZOS).convert('RGBA')
img.save(dst, format='ICO', sizes=[(256, 256)])
print(f"Generated build/icon.ico ({os.path.getsize(dst)} bytes)")
`)

try {
  execSync(`mise exec -- python "${tmpPy}"`, { stdio: 'inherit', cwd: root })
} finally {
  // Clean up temp file
  try { execSync(`del /f /q "${tmpPy}" 2>nul`, { stdio: 'ignore' }) } catch {}
}
