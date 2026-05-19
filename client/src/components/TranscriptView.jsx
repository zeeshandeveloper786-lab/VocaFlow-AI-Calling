
const parseTranscript = (transcript) => {
  if (!transcript) return []
  if (Array.isArray(transcript)) return transcript
  return transcript.split('\n')
    .filter(line => line.trim())
    .map(line => {
      if (line.startsWith('Caller:')) {
        return { role: 'caller', text: line.replace('Caller:', '').trim(), content: line.replace('Caller:', '').trim() }
      }
      if (line.startsWith('AI:')) {
        return { role: 'assistant', text: line.replace('AI:', '').trim(), content: line.replace('AI:', '').trim() }
      }
      return { role: 'assistant', text: line.trim(), content: line.trim() }
    })
}

export default function TranscriptView({ transcript }) {
  const msgs = parseTranscript(transcript)

  if (!msgs || msgs.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
        No transcript available
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
      {msgs.map((msg, idx) => (
        <div key={idx} className={`flex ${msg.role === 'assistant' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'assistant' ? 'bg-blue-100 text-blue-900' : 'bg-white border'}`}>
            <p className="text-xs text-gray-500 mb-1">{msg.role === 'assistant' ? 'AI' : 'Caller'}</p>
            <p>{msg.content}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
