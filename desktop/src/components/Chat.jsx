import { useState, useRef, useEffect } from 'react'

const Chat = ({ apiUrl }) => {
  const [messages, setMessages] = useState([
    { role: 'system', content: 'Myca distributed inference pipeline ready. Send a prompt to begin.' }
  ])
  const [input, setInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || isGenerating) return

    const prompt = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: prompt }])
    setIsGenerating(true)

    // Add empty assistant message that we will stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const response = await fetch(`${apiUrl}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, stream: true }),
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        // SSE lines look like: data: {"token": "hello", "done": false}\n\n
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6))
              
              if (data.error) {
                setMessages(prev => {
                  const newMsgs = [...prev]
                  newMsgs[newMsgs.length - 1].content += `\n[Error: ${data.error}]`
                  return newMsgs
                })
                break
              }
              
              if (data.token) {
                setMessages(prev => {
                  const newMsgs = [...prev]
                  newMsgs[newMsgs.length - 1].content += data.token
                  return newMsgs
                })
              }
              
              if (data.done) {
                setIsGenerating(false)
              }
            } catch (err) {
              console.error("Parse error chunk:", line, err)
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => {
        const newMsgs = [...prev]
        newMsgs[newMsgs.length - 1].content += `\n[Network Error: ${error.message}]`
        return newMsgs
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <>
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>
            <span className="msg-label">{msg.role === 'user' ? 'YOU' : msg.role === 'system' ? 'SYSTEM' : 'MYCA'}</span>
            {msg.content}
            {isGenerating && i === messages.length - 1 && msg.role === 'assistant' && (
              <span className="chat-cursor"></span>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isGenerating ? "Inference running..." : "Type your prompt here..."}
          disabled={isGenerating}
          autoComplete="off"
        />
        <button 
          type="submit" 
          className="chat-send"
          disabled={!input.trim() || isGenerating}
        >
          SEND
        </button>
      </form>
    </>
  )
}

export default Chat
