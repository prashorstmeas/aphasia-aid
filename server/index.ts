import express from 'express'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

const PORT = Number(process.env.PORT ?? 8787)
const MODEL = 'claude-opus-5'
const client = new Anthropic() // reads ANTHROPIC_API_KEY (or an `ant auth login` profile)

const app = express()
app.use(express.json({ limit: '12mb' }))

// ---------- Shared request shapes ----------

const Profile = z.object({
  name: z.string().default(''),
  about: z.string().default(''),
  interests: z.string().default(''),
  language: z.string().default('English'),
})
type Profile = z.infer<typeof Profile>

const Scenario = z.object({
  name: z.string(),
  role: z.string(), // who Claude plays, e.g. "a friendly barista"
  goal: z.string(), // what the patient is practising, e.g. "order a coffee and a cake"
})

const Turn = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string(),
})

const ChatRequest = z.object({
  mode: z.enum(['chat', 'scenario']),
  topic: z.string().optional(),
  scenario: Scenario.optional(),
  profile: Profile.default({ name: '', about: '', interests: '', language: 'English' }),
  history: z.array(Turn).max(60).default([]),
  userText: z.string(),
  /** How the patient's message was produced. */
  inputKind: z.enum(['speech', 'tile', 'gesture', 'vision']).default('speech'),
  /** Optional on-device observations from the camera. */
  cues: z.object({ mood: z.string().optional(), gesture: z.string().optional() }).optional(),
  attemptCount: z.number().int().min(0).default(0),
})

// ---------- Structured reply the app renders ----------

const CompanionReply = z.object({
  reply: z.string().describe('What the companion says aloud. 1-2 short, plain sentences. End with at most one simple question.'),
  suggestedWords: z.array(z.string()).max(4).describe('Up to 4 single words or 2-3 word phrases the patient could tap to answer. Empty if not useful.'),
  offeredWord: z.string().nullable().describe('If the patient seems stuck on a word, the most likely word they want, else null.'),
  understood: z.boolean().describe('Whether you could make sense of what the patient meant.'),
})
type CompanionReply = z.infer<typeof CompanionReply>

// Static prefix first so it caches; patient-specific text comes after.
const BASE_SYSTEM = `You are a warm, patient conversation partner for an adult with aphasia (an acquired language disorder, often after a stroke). Their intelligence is intact; finding and producing words is hard.

How to talk:
- One idea per sentence. Short, concrete, everyday words. Never more than two sentences.
- Ask one question at a time. Prefer yes/no or either/or questions when the person is struggling; open questions when they are doing well.
- Give them time. Never rush, never correct grammar, never point out mistakes.
- If their message is garbled or half a word, guess the most likely meaning, gently check it ("Do you mean the garden?"), and offer the word.
- Repeat back key words they said correctly - that is encouraging and useful practice.
- If they say a word that sounds like a mistaken but related word (e.g. "fork" for "spoon"), don't correct; keep the conversation going with the likely meaning.
- Praise real effort briefly and specifically. Avoid gushing or baby talk. Treat them as an adult peer.
- Never discuss their diagnosis or give medical advice; if asked, suggest they ask their therapist or doctor.
- If the patient shows distress or pain, stop the exercise, acknowledge it simply, and suggest telling their carer.
- Input may come from speech recognition (can be wrong), a tapped picture tile, a gesture (thumbs up = yes, thumbs down = no, open palm = stop/help), or a camera description. Treat gestures as reliable answers.
- Reply in the patient's language.

Output is JSON matching the schema. "reply" is spoken aloud by text-to-speech, so avoid symbols, lists and quotation marks.`

function buildSystem(req: z.infer<typeof ChatRequest>): Anthropic.TextBlockParam[] {
  const p = req.profile
  const patient = [
    p.name && `Patient's name: ${p.name}.`,
    p.about && `About them: ${p.about}`,
    p.interests && `Interests to draw on: ${p.interests}`,
    `Language: ${p.language}.`,
  ].filter(Boolean).join('\n')

  const mode =
    req.mode === 'scenario' && req.scenario
      ? `ROLE-PLAY. You are ${req.scenario.role}. The patient is practising: ${req.scenario.goal}. Stay in character and in the scene. Keep the scene realistic but simple; when the goal is achieved, close the scene warmly in one sentence and set understood=true.`
      : `FREE CONVERSATION${req.topic ? ` about: ${req.topic}` : ''}. Follow the patient's lead; if they run dry, offer a simple related question.`

  return [
    { type: 'text', text: BASE_SYSTEM, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: `${patient}\n\n${mode}` },
  ]
}

function userContent(req: z.infer<typeof ChatRequest>) {
  const meta: string[] = [`[input: ${req.inputKind}]`]
  if (req.cues?.gesture) meta.push(`[gesture seen: ${req.cues.gesture}]`)
  if (req.cues?.mood) meta.push(`[expression: ${req.cues.mood}]`)
  if (req.attemptCount > 1) meta.push(`[this is attempt ${req.attemptCount} at this turn]`)
  return `${meta.join(' ')}\n${req.userText || '(no words - only the cues above)'}`
}

app.post('/api/chat', async (rq, rs) => {
  const parsed = ChatRequest.safeParse(rq.body)
  if (!parsed.success) return rs.status(400).json({ error: parsed.error.flatten() })
  const req = parsed.data

  const messages: Anthropic.MessageParam[] = [
    ...req.history.map((t) => ({ role: t.role, content: t.text })),
    { role: 'user', content: userContent(req) },
  ]
  // Opening turn of a scenario: the patient hasn't spoken; the companion starts the scene.
  if (req.history.length === 0 && !req.userText.trim()) {
    messages[messages.length - 1] = { role: 'user', content: '[input: start] Please begin.' }
  }

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: buildSystem(req),
      messages,
      output_config: { effort: 'low', format: zodOutputFormat(CompanionReply) },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })
    if (response.stop_reason === 'refusal') {
      return rs.json(<CompanionReply>{ reply: "Let's talk about something else. What did you do today?", suggestedWords: ['Rest', 'Family', 'Food', 'TV'], offeredWord: null, understood: false })
    }
    const text = response.content.find((b) => b.type === 'text')?.text ?? ''
    const reply = CompanionReply.parse(JSON.parse(text))
    rs.json(reply)
  } catch (err) {
    rs.status(apiStatus(err)).json({ error: describe(err) })
  }
})

// ---------- Vision: what is the patient pointing at / holding? ----------

const VisionRequest = z.object({
  image: z.string().min(100), // base64 JPEG, no data: prefix
  profile: Profile.default({ name: '', about: '', interests: '', language: 'English' }),
  context: z.string().optional(), // e.g. last companion question
})

const VisionReply = z.object({
  description: z.string().describe('One short plain sentence describing what the person seems to be indicating or doing.'),
  intents: z.array(z.object({
    emoji: z.string().describe('One emoji for the tile'),
    label: z.string().describe('1-3 words shown on the tile'),
    phrase: z.string().describe('The full sentence spoken when tapped, first person'),
  })).min(1).max(4).describe('Most likely things the person is trying to communicate, most likely first.'),
  concern: z.string().nullable().describe('If the person appears to be in pain, distress or danger, say so plainly; else null.'),
})

app.post('/api/vision', async (rq, rs) => {
  const parsed = VisionRequest.safeParse(rq.body)
  if (!parsed.success) return rs.status(400).json({ error: parsed.error.flatten() })
  const req = parsed.data
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        { type: 'text', text: 'You help an adult with aphasia communicate. You see one camera frame of them. Work out what they are pointing at, holding, looking at, or gesturing, and offer the most likely things they want to say as short first-person phrases. Be concrete: name the actual object if visible. Never comment on their appearance, age or condition. If nothing is clear, offer common needs (water, toilet, help, pain).', cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `Language: ${req.profile.language}.${req.context ? ` The companion just said: "${req.context}"` : ''}` },
      ],
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: req.image } },
          { type: 'text', text: 'What is this person trying to communicate?' },
        ],
      }],
      output_config: { effort: 'low', format: zodOutputFormat(VisionReply) },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })
    if (response.stop_reason === 'refusal') return rs.status(422).json({ error: 'Could not interpret this image.' })
    const text = response.content.find((b) => b.type === 'text')?.text ?? ''
    rs.json(VisionReply.parse(JSON.parse(text)))
  } catch (err) {
    rs.status(apiStatus(err)).json({ error: describe(err) })
  }
})

app.get('/api/health', (_rq, rs) => rs.json({ ok: true, model: MODEL, keyConfigured: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) }))

const isCredentialError = (err: unknown) => err instanceof Anthropic.AnthropicError && /authentication method|apiKey/i.test(err.message)

function apiStatus(err: unknown) {
  if (err instanceof Anthropic.AuthenticationError || isCredentialError(err)) return 401
  if (err instanceof Anthropic.RateLimitError) return 429
  if (err instanceof Anthropic.APIError) return err.status ?? 502
  return 500
}
function describe(err: unknown) {
  if (err instanceof Anthropic.AuthenticationError || isCredentialError(err)) return 'The server has no valid Anthropic API key. Set ANTHROPIC_API_KEY in .env and restart.'
  if (err instanceof Anthropic.RateLimitError) return 'Too many requests right now. Try again in a moment.'
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status}: ${err.message}`
  console.error(err)
  return 'Unexpected server error.'
}

// In production, serve the built app from the same origin.
const dist = path.resolve(process.cwd(), 'dist')
app.use(express.static(dist))
app.get(/^(?!\/api\/).*/, (_rq, rs) => rs.sendFile(path.join(dist, 'index.html'), (e) => e && rs.status(404).end()))

app.listen(PORT, () => console.log(`Aphasia Aid server on http://localhost:${PORT} (model ${MODEL})`))
