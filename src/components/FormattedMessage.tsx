// Lightweight formatter for AI Coach responses.
// Handles **bold**, "* " / "- " bullet lines, and paragraph breaks —
// deliberately not a full markdown parser, just enough for Gemini's
// typical chat-style output, with zero added dependencies.

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-ink-900">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export default function FormattedMessage({ content }: { content: string }) {
  const lines = content.split('\n')
  const blocks: { type: 'bullet' | 'text'; text: string }[][] = []
  let current: { type: 'bullet' | 'text'; text: string }[] = []

  for (const raw of lines) {
    const line = raw.trim()
    if (line === '') {
      if (current.length) {
        blocks.push(current)
        current = []
      }
      continue
    }
    const isBullet = /^[*-]\s+/.test(line)
    current.push({
      type: isBullet ? 'bullet' : 'text',
      text: isBullet ? line.replace(/^[*-]\s+/, '') : line,
    })
  }
  if (current.length) blocks.push(current)

  return (
    <div className="space-y-2">
      {blocks.map((block, bi) => {
        const allBullets = block.every((l) => l.type === 'bullet')
        if (allBullets) {
          return (
            <ul key={bi} className="list-disc list-outside pl-4 space-y-1">
              {block.map((l, li) => (
                <li key={li}>{renderInline(l.text)}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={bi} className="leading-relaxed">
            {block.map((l, li) => (
              <span key={li}>
                {li > 0 && <br />}
                {renderInline(l.text)}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}
