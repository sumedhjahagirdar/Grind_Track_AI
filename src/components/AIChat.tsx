import { useEffect, useRef, useState, useCallback } from 'react'
import { sendChatMessage, fetchChatMessages, clearChatMessages } from '../lib/api'
import type { ChatMessage } from '../lib/types'
import { Send, Loader2, Trash2, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import clsx from 'clsx'
import FormattedMessage from './FormattedMessage'

const QUICK_PROMPTS = [
  'What should I practice today?',
  'What are my weak areas?',
  'Am I on track for my target date?',
  'Suggest a study plan for this week',
]

export default function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const m = await fetchChatMessages(50)
      setMessages(m.reverse())
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')
    setError(null)

    const optimistic: ChatMessage = {
      id: 'temp-' + Date.now(),
      user_id: '',
      role: 'user',
      content: msg,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setLoading(true)

    const result = await sendChatMessage(msg)
    if ('error' in result) {
      console.error('AI Coach request failed:', result.error)
      const friendly = result.error.includes('429') || result.error.includes('quota') || result.error.includes('RESOURCE_EXHAUSTED')
        ? 'AI coach is temporarily unavailable due to high demand. Please try again in a few minutes.'
        : result.error.includes('503') || result.error.toLowerCase().includes('overloaded')
        ? "Google's AI model is overloaded right now. This usually clears up within a minute — please try again."
        : result.error.includes('GEMINI_API_KEY')
        ? 'AI coach is not configured. Please contact support.'
        : 'AI coach is temporarily unavailable. Please try again in a moment.'
      setError(friendly)
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
    } else {
      const assistant: ChatMessage = {
        id: 'temp-ai-' + Date.now(),
        user_id: '',
        role: 'assistant',
        content: result.response,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistant])
    }
    setLoading(false)
  }

  const handleClear = async () => {
    if (clearing || loading) return
    if (!confirm('Clear the entire AI Coach conversation? This cannot be undone.')) return
    setClearing(true)
    try {
      await clearChatMessages()
      setMessages([])
      setError(null)
    } catch (e) {
      console.error(e)
    } finally {
      setClearing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="card p-0 flex flex-col h-[600px]">
      <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100">
        <h2 className="font-semibold text-ink-900 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-600" />
          AI Coach
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-ink-400">Powered by Gemini</span>
          <button
            onClick={handleClear}
            disabled={clearing || loading || messages.length === 0}
            title="Clear chat"
            className="flex items-center gap-1 text-xs text-ink-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Clear
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="text-center py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 mx-auto mb-3">
              <Sparkles className="h-6 w-6 text-brand-600" />
            </div>
            <p className="text-sm text-ink-600 font-medium mb-1">Ask your AI coach anything</p>
            <p className="text-xs text-ink-400 mb-4">Get personalized advice based on your progress data</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm mx-auto">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => handleSend(p)}
                  className="text-xs bg-ink-50 hover:bg-brand-50 hover:text-brand-700 text-ink-600 rounded-full px-3 py-1.5 transition border border-ink-100"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={m.id} className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={clsx(
              'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
              m.role === 'user'
                ? 'bg-brand-600 text-white rounded-br-md'
                : 'bg-ink-50 text-ink-800 rounded-bl-md border border-ink-100'
            )}>
              {m.role === 'assistant' ? (
                <FormattedMessage content={m.content} />
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              )}
              {m.created_at && !m.id.startsWith('temp') && (
                <p className={clsx('text-[10px] mt-1', m.role === 'user' ? 'text-brand-100' : 'text-ink-400')}>
                  {format(new Date(m.created_at), 'MMM d, h:mm a')}
                </p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-ink-50 text-ink-800 rounded-2xl rounded-bl-md border border-ink-100 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-ink-400" />
            </div>
          </div>
        )}

        {error && (
          <div className="text-center text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>

      <div className="border-t border-ink-100 px-4 py-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="input flex-1"
            placeholder="Ask about your progress, get study advice..."
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="btn-primary px-3"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
