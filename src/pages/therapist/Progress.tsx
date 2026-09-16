import { useMemo, useState } from 'react'
import { useAttempts } from '../../hooks'
import { EXERCISE_LABELS, EXERCISE_TYPES, type Attempt, type ExerciseType } from '../../db'

const DAY = 86_400_000
const DAYS = 14

function dayKey(ts: number) {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function pct(n: number, d: number) { return d === 0 ? null : Math.round((n / d) * 100) }

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <div className="text-sm font-semibold uppercase tracking-wide text-gray-600">{label}</div>
      <div className="mt-1 text-4xl font-bold">{value}</div>
      {sub && <div className="text-sm text-gray-600">{sub}</div>}
    </div>
  )
}

/** Daily accuracy for the last 14 days: one series, thin rounded bars, hover tooltip, table toggle. */
function DailyAccuracy({ attempts }: { attempts: Attempt[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)

  const days = useMemo(() => {
    const today = dayKey(Date.now())
    return Array.from({ length: DAYS }, (_, i) => {
      const day = today - (DAYS - 1 - i) * DAY
      const inDay = attempts.filter((a) => dayKey(a.ts) === day)
      const correct = inDay.filter((a) => a.correct).length
      return { day, total: inDay.length, correct, acc: pct(correct, inDay.length) }
    })
  }, [attempts])

  const W = 640, H = 220, padL = 40, padR = 12, padT = 12, padB = 32
  const plotW = W - padL - padR, plotH = H - padT - padB
  const slot = plotW / DAYS
  const barW = Math.min(28, slot - 8)
  const x = (i: number) => padL + i * slot + (slot - barW) / 2
  const y = (v: number) => padT + plotH - (v / 100) * plotH
  const fmt = (d: number) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xl font-bold">Daily accuracy, last {DAYS} days</h2>
        <button type="button" className="rounded-lg border-2 border-gray-300 px-3 py-1 font-semibold" onClick={() => setTable((t) => !t)}>
          {table ? 'Show chart' : 'Show table'}
        </button>
      </div>
      {table ? (
        <table className="w-full text-left">
          <thead><tr className="text-gray-600"><th className="py-1">Day</th><th>Attempts</th><th>Correct</th><th>Accuracy</th></tr></thead>
          <tbody>{days.map((d) => (
            <tr key={d.day} className="border-t border-gray-200"><td className="py-1">{fmt(d.day)}</td><td>{d.total}</td><td>{d.correct}</td><td>{d.acc == null ? '—' : `${d.acc}%`}</td></tr>
          ))}</tbody>
        </table>
      ) : (
        <div className="relative overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Bar chart of daily practice accuracy" onMouseLeave={() => setHover(null)}>
            {[0, 50, 100].map((v) => (
              <g key={v}>
                <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#e5e5e2" strokeWidth={1} />
                <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize={12} fill="var(--text-secondary)">{v}%</text>
              </g>
            ))}
            <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="#c8c8c4" strokeWidth={1} />
            {days.map((d, i) => {
              const v = d.acc ?? 0
              const top = y(v), h = Math.max(0, y(0) - top)
              return (
                <g key={d.day}>
                  {d.acc != null && (
                    <path
                      d={`M${x(i)},${y(0)} v${-(h - Math.min(4, h))} q0,-${Math.min(4, h)} 4,-${Math.min(4, h)} h${barW - 8} q4,0 4,${Math.min(4, h)} v${h - Math.min(4, h)} z`}
                      fill="var(--series-1)" opacity={hover == null || hover === i ? 1 : 0.55}
                    />
                  )}
                  {(i % 2 === 0 || i === DAYS - 1) && (
                    <text x={x(i) + barW / 2} y={H - 10} textAnchor="middle" fontSize={11} fill="var(--text-secondary)">{fmt(d.day)}</text>
                  )}
                  {/* Oversized hit target */}
                  <rect x={padL + i * slot} y={padT} width={slot} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
                </g>
              )
            })}
          </svg>
          {hover != null && (
            <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow">
              <strong>{fmt(days[hover].day)}</strong> · {days[hover].total} attempts · {days[hover].acc == null ? 'no practice' : `${days[hover].acc}% correct`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Progress() {
  const attempts = useAttempts()
  const [typeFilter, setTypeFilter] = useState<ExerciseType | ''>('')
  const weekAgo = Date.now() - 7 * DAY
  const recent = attempts.filter((a) => a.ts >= weekAgo)
  const recentCorrect = recent.filter((a) => a.correct).length
  const recentAcc = pct(recentCorrect, recent.length)

  const streak = useMemo(() => {
    const days = new Set(attempts.map((a) => dayKey(a.ts)))
    let n = 0, d = dayKey(Date.now())
    if (!days.has(d)) d -= DAY
    while (days.has(d)) { n++; d -= DAY }
    return n
  }, [attempts])

  const byItem = useMemo(() => {
    const m = new Map<string, { total: number; correct: number; cued: number }>()
    for (const a of attempts) {
      if (typeFilter && a.type !== typeFilter) continue
      const e = m.get(a.itemText) ?? { total: 0, correct: 0, cued: 0 }
      e.total++; if (a.correct) e.correct++; if (a.cueUsed) e.cued++
      m.set(a.itemText, e)
    }
    return [...m.entries()].map(([item, e]) => ({ item, ...e, acc: pct(e.correct, e.total)! }))
      .sort((a, b) => a.acc - b.acc || b.total - a.total)
  }, [attempts, typeFilter])

  const byType = useMemo(
    () => EXERCISE_TYPES.map((type) => {
      const all = attempts.filter((a) => a.type === type)
      const week = recent.filter((a) => a.type === type)
      return {
        type,
        total: all.length,
        acc: pct(all.filter((a) => a.correct).length, all.length),
        weekTotal: week.length,
        weekAcc: pct(week.filter((a) => a.correct).length, week.length),
      }
    }),
    [attempts, recent],
  )

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Attempts (7 days)" value={String(recent.length)} />
        <StatTile label="Accuracy (7 days)" value={recentAcc == null ? '—' : `${recentAcc}%`} sub={recent.length ? `${recentCorrect} of ${recent.length}` : 'No practice yet'} />
        <StatTile label="Items practised" value={String(new Set(attempts.map((a) => a.itemText)).size)} sub="all time" />
        <StatTile label="Day streak" value={String(streak)} />
      </div>

      <DailyAccuracy attempts={attempts} />

      <div className="card">
        <h2 className="mb-2 text-xl font-bold">By exercise</h2>
        <table className="w-full text-left">
          <thead><tr className="text-gray-600"><th className="py-1">Exercise</th><th>Attempts (7 days)</th><th>Accuracy (7 days)</th><th>Attempts (all time)</th><th>Accuracy (all time)</th></tr></thead>
          <tbody>{byType.map((t) => (
            <tr key={t.type} className="border-t border-gray-200">
              <td className="py-2 font-semibold">{EXERCISE_LABELS[t.type]}</td>
              <td>{t.weekTotal}</td>
              <td>{t.weekAcc == null ? '—' : `${t.weekAcc}%`}</td>
              <td>{t.total}</td>
              <td>
                {t.acc == null ? '—' : (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-2 w-24 overflow-hidden rounded bg-gray-200"><span className="block h-full rounded" style={{ width: `${t.acc}%`, background: 'var(--series-1)' }} /></span>
                    {t.acc}%
                  </span>
                )}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div className="card">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold">Items, hardest first</h2>
          <select className="field ml-auto w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as ExerciseType | '')} aria-label="Filter by exercise">
            <option value="">All exercises</option>
            {EXERCISE_TYPES.map((t) => <option key={t} value={t}>{EXERCISE_LABELS[t]}</option>)}
          </select>
        </div>
        {byItem.length === 0 ? <p className="text-gray-600">No attempts recorded yet.</p> : (
          <table className="w-full text-left">
            <thead><tr className="text-gray-600"><th className="py-1">Item</th><th>Attempts</th><th>Correct</th><th>Hint used</th><th>Accuracy</th></tr></thead>
            <tbody>{byItem.map((w) => (
              <tr key={w.item} className="border-t border-gray-200">
                <td className="py-2 font-semibold">{w.item}</td><td>{w.total}</td><td>{w.correct}</td><td>{w.cued}</td>
                <td>
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-2 w-24 overflow-hidden rounded bg-gray-200"><span className="block h-full rounded" style={{ width: `${w.acc}%`, background: 'var(--series-1)' }} /></span>
                    {w.acc}%
                  </span>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 className="mb-2 text-xl font-bold">Recent attempts</h2>
        {attempts.length === 0 ? <p className="text-gray-600">Nothing yet.</p> : (
          <ul className="divide-y divide-gray-200">
            {[...attempts].reverse().slice(0, 25).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 py-2">
                <span>{a.correct ? '✅' : '❌'}</span>
                <span className="font-semibold">{a.itemText}</span>
                <span className="text-gray-600">{EXERCISE_LABELS[a.type]}</span>
                {a.heard && <span className="text-gray-600">heard “{a.heard.split('|')[0].trim()}”</span>}
                {a.cueUsed && <span className="rounded bg-amber-100 px-2 text-sm">hint</span>}
                {a.selfMarked && <span className="rounded bg-gray-100 px-2 text-sm">self-marked</span>}
                <span className="ml-auto text-sm text-gray-500">{new Date(a.ts).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
