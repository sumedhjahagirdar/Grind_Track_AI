import AIChat from '../components/AIChat'

export default function Coach() {
  return (
    <div className="max-w-4xl mx-auto px-4 md:px-10 py-8 md:py-12 space-y-8 md:space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">AI Coach</h1>
        <p className="text-sm text-ink-500">Chat with your AI coach about your progress, get study advice, and plan your next steps</p>
      </div>
      <AIChat />
    </div>
  )
}
