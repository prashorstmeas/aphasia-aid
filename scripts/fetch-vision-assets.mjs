// Copies the MediaPipe WASM runtime from node_modules and downloads the two task models into public/.
// Runs on `npm install`; safe to re-run (skips files that already exist).
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const models = {
  'gesture_recognizer.task': 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
  'face_landmarker.task': 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
}

mkdirSync(join(root, 'public/wasm'), { recursive: true })
mkdirSync(join(root, 'public/models'), { recursive: true })
cpSync(join(root, 'node_modules/@mediapipe/tasks-vision/wasm'), join(root, 'public/wasm'), { recursive: true })

for (const [name, url] of Object.entries(models)) {
  const dest = join(root, 'public/models', name)
  if (existsSync(dest)) continue
  process.stdout.write(`Downloading ${name}… `)
  const res = await fetch(url)
  if (!res.ok) { console.error(`failed (${res.status}) - camera features will not work until this file exists`); continue }
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
  console.log('done')
}
