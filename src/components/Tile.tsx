interface Props {
  emoji: string
  label: string
  onClick: () => void
  selected?: boolean
  className?: string
}

export default function Tile({ emoji, label, onClick, selected, className = '' }: Props) {
  return (
    <button
      type="button"
      className={`tile ${selected ? 'border-blue-700 bg-blue-50' : ''} ${className}`}
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
    >
      <span className="tile-emoji" aria-hidden="true">{emoji}</span>
      <span className="tile-label">{label}</span>
    </button>
  )
}
