/**
 * On-device camera understanding with MediaPipe. Nothing leaves the device.
 * Emits coarse, debounced intents: hand gestures, head nod/shake, facial mood, and "mouth moving" (trying to speak).
 */
import { FilesetResolver, GestureRecognizer, FaceLandmarker, type Category } from '@mediapipe/tasks-vision'

export type Mood = 'neutral' | 'happy' | 'sad' | 'pain' | 'confused' | 'surprised'
export type GestureIntent = { kind: 'gesture'; name: string; label: string; phrase: string }
export type HeadIntent = { kind: 'head'; name: 'nod' | 'shake'; label: string; phrase: string }
export type MoodEvent = { kind: 'mood'; mood: Mood; score: number }
export type SpeakingEvent = { kind: 'speaking' }
export type VisionEvent = GestureIntent | HeadIntent | MoodEvent | SpeakingEvent

/** MediaPipe canned gesture -> what it means for this user. Editable by the therapist later. */
export const GESTURE_MAP: Record<string, { label: string; phrase: string }> = {
  Thumb_Up: { label: 'Yes', phrase: 'Yes' },
  Thumb_Down: { label: 'No', phrase: 'No' },
  Open_Palm: { label: 'Stop / Help', phrase: 'Stop. I need help.' },
  Pointing_Up: { label: 'Wait', phrase: 'Wait, I want to say something.' },
  Victory: { label: 'Good', phrase: 'I am good, thank you.' },
  ILoveYou: { label: 'Love you', phrase: 'I love you.' },
}

const MODEL_BASE = '/models'
const WASM_BASE = '/wasm'
const FPS = 12
const DEBOUNCE_MS = 2500
const GESTURE_HOLD_FRAMES = 4

let filesetPromise: Promise<Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>> | null = null
const fileset = () => (filesetPromise ??= FilesetResolver.forVisionTasks(WASM_BASE))

export const cameraSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

function score(cats: Category[], name: string) {
  return cats.find((c) => c.categoryName === name)?.score ?? 0
}

export class VisionEngine {
  private gesture: GestureRecognizer | null = null
  private face: FaceLandmarker | null = null
  private raf = 0
  private lastTs = 0
  private lastFired = new Map<string, number>()
  private gestureStreak: { name: string; n: number } = { name: '', n: 0 }
  private noseTrail: { x: number; y: number; t: number }[] = []
  private mouthTrail: { open: number; t: number }[] = []
  private lastMood: Mood = 'neutral'
  stream: MediaStream | null = null

  constructor(private video: HTMLVideoElement, private onEvent: (e: VisionEvent) => void, private opts: { gestures: boolean; mood: boolean } = { gestures: true, mood: true }) {}

  async start() {
    const fs = await fileset()
    const [gesture, face] = await Promise.all([
      this.opts.gestures
        ? GestureRecognizer.createFromOptions(fs, { baseOptions: { modelAssetPath: `${MODEL_BASE}/gesture_recognizer.task` }, runningMode: 'VIDEO', numHands: 1 })
        : null,
      FaceLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: `${MODEL_BASE}/face_landmarker.task` }, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true }),
    ])
    this.gesture = gesture
    this.face = face
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false })
    this.video.srcObject = this.stream
    await this.video.play()
    this.loop()
  }

  stop() {
    cancelAnimationFrame(this.raf)
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.video.srcObject = null
    this.gesture?.close(); this.face?.close()
    this.gesture = null; this.face = null
  }

  /** Grab the current frame as base64 JPEG (no data: prefix) for cloud interpretation. */
  snapshot(maxWidth = 768): string | null {
    if (!this.video.videoWidth) return null
    const scale = Math.min(1, maxWidth / this.video.videoWidth)
    const c = document.createElement('canvas')
    c.width = Math.round(this.video.videoWidth * scale)
    c.height = Math.round(this.video.videoHeight * scale)
    c.getContext('2d')!.drawImage(this.video, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.8).split(',')[1] ?? null
  }

  private fire(key: string, e: VisionEvent, now: number) {
    const last = this.lastFired.get(key) ?? 0
    if (now - last < DEBOUNCE_MS) return
    this.lastFired.set(key, now)
    this.onEvent(e)
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    if (now - this.lastTs < 1000 / FPS || this.video.readyState < 2) return
    this.lastTs = now
    try {
      if (this.gesture) this.handleGestures(this.gesture.recognizeForVideo(this.video, now).gestures, now)
      if (this.face) {
        const r = this.face.detectForVideo(this.video, now)
        const lm = r.faceLandmarks[0]
        const bs = r.faceBlendshapes[0]?.categories
        if (lm) this.handleHead(lm[1], now) // landmark 1 = nose tip
        if (bs) { this.handleMouth(bs, now); if (this.opts.mood) this.handleMood(bs, now) }
      }
    } catch { /* a dropped frame is fine */ }
  }

  private handleGestures(gestures: Category[][], now: number) {
    const top = gestures[0]?.[0]
    const name = top && top.score > 0.6 ? top.categoryName : ''
    this.gestureStreak = name === this.gestureStreak.name ? { name, n: this.gestureStreak.n + 1 } : { name, n: 1 }
    const map = GESTURE_MAP[name]
    if (map && this.gestureStreak.n === GESTURE_HOLD_FRAMES) this.fire(`g:${name}`, { kind: 'gesture', name, ...map }, now)
  }

  /** Nod = vertical oscillation of the nose over ~1.2s; shake = horizontal. */
  private handleHead(nose: { x: number; y: number }, now: number) {
    this.noseTrail.push({ x: nose.x, y: nose.y, t: now })
    this.noseTrail = this.noseTrail.filter((p) => now - p.t < 1200)
    if (this.noseTrail.length < 8) return
    const xs = this.noseTrail.map((p) => p.x), ys = this.noseTrail.map((p) => p.y)
    const range = (a: number[]) => Math.max(...a) - Math.min(...a)
    const reversals = (a: number[]) => { let n = 0; for (let i = 2; i < a.length; i++) if ((a[i] - a[i - 1]) * (a[i - 1] - a[i - 2]) < 0 && Math.abs(a[i] - a[i - 1]) > 0.004) n++; return n }
    const rx = range(xs), ry = range(ys)
    if (ry > 0.035 && ry > rx * 1.6 && reversals(ys) >= 2) { this.fire('h:nod', { kind: 'head', name: 'nod', label: 'Yes (nod)', phrase: 'Yes' }, now); this.noseTrail = [] }
    else if (rx > 0.035 && rx > ry * 1.6 && reversals(xs) >= 2) { this.fire('h:shake', { kind: 'head', name: 'shake', label: 'No (shake)', phrase: 'No' }, now); this.noseTrail = [] }
  }

  /** Mouth opening/closing repeatedly = trying to speak. */
  private handleMouth(bs: Category[], now: number) {
    const open = score(bs, 'jawOpen') + score(bs, 'mouthPucker') * 0.5
    this.mouthTrail.push({ open, t: now })
    this.mouthTrail = this.mouthTrail.filter((p) => now - p.t < 1500)
    if (this.mouthTrail.length < 10) return
    const vals = this.mouthTrail.map((p) => p.open)
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length
    if (variance > 0.004 && mean > 0.05) this.fire('speaking', { kind: 'speaking' }, now)
  }

  private handleMood(bs: Category[], now: number) {
    const smile = (score(bs, 'mouthSmileLeft') + score(bs, 'mouthSmileRight')) / 2
    const frown = (score(bs, 'mouthFrownLeft') + score(bs, 'mouthFrownRight')) / 2
    const browDown = (score(bs, 'browDownLeft') + score(bs, 'browDownRight')) / 2
    const browUp = score(bs, 'browInnerUp')
    const squint = (score(bs, 'eyeSquintLeft') + score(bs, 'eyeSquintRight')) / 2
    const wide = (score(bs, 'eyeWideLeft') + score(bs, 'eyeWideRight')) / 2
    const jaw = score(bs, 'jawOpen')

    let mood: Mood = 'neutral', s = 0
    if (smile > 0.45) { mood = 'happy'; s = smile }
    else if (browDown > 0.5 && squint > 0.35) { mood = 'pain'; s = (browDown + squint) / 2 }
    else if (frown > 0.3 && browUp > 0.3) { mood = 'sad'; s = (frown + browUp) / 2 }
    else if (wide > 0.5 && jaw > 0.3) { mood = 'surprised'; s = (wide + jaw) / 2 }
    else if (browDown > 0.4 && smile < 0.1 && frown < 0.15) { mood = 'confused'; s = browDown }

    if (mood !== this.lastMood) { this.lastMood = mood; this.fire(`m:${mood}`, { kind: 'mood', mood, score: s }, now) }
  }
}
