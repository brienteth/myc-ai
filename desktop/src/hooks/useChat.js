import { useState, useEffect } from 'react';
import { nodeNickname } from './useNodes';

export const useChat = (initialConvId = null) => {
  const [messages, setMessages] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [convId, setConvId] = useState(initialConvId || crypto.randomUUID());

  useEffect(() => {
    if (initialConvId) {
      fetch(`http://127.0.0.1:8420/history/${initialConvId}`)
        .then(res => res.json())
        .then(data => {
          if (data.messages) {
            setMessages(data.messages);
            setConvId(initialConvId);
          }
        })
        .catch(err => console.error("Failed to load history:", err));
    } else {
      setMessages([]);
      setConvId(crypto.randomUUID());
    }
  }, [initialConvId]);

  const sendMessage = async (prompt) => {
    if (!prompt.trim() || isGenerating) return;

    const newMessages = [...messages, { role: 'user', content: prompt }];
    setIsGenerating(true);
    setMessages([...newMessages, { role: 'myca', content: '', nodes: [] }]);
    try {
      const response = await fetch('http://127.0.0.1:8420/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: prompt,
          stream: true,
          conv_id: convId
        }),
      });

      if (!response.ok) throw new Error('Network error');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let startTime = Date.now();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const json_str = line.slice(6).trim();
          if (json_str === '[DONE]') {
            setIsGenerating(false);
            return;
          }
          try {
            const data = JSON.parse(json_str);

            // Token event (new Need Protocol format)
            if (data.type === 'token') {
              const tokenValue = data.token || '';
              if (tokenValue) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  const lastMsg = { ...newMsgs[newMsgs.length - 1] };
                  lastMsg.content += tokenValue;
                  newMsgs[newMsgs.length - 1] = lastMsg;
                  return newMsgs;
                });
              }
            }

            // Done event with metadata
            else if (data.type === 'done') {
              const duration = ((Date.now() - startTime) / 1000).toFixed(1);
              setMessages(prev => {
                const newMsgs = [...prev];
                const lastMsg = { ...newMsgs[newMsgs.length - 1] };
                lastMsg.duration = duration;
                lastMsg.source = data.source;
                lastMsg.node_used = data.node_used;
                lastMsg.node_display = data.node_display;
                lastMsg.compute_avoided = data.compute_avoided;
                lastMsg.cache_score = data.cache_score;
                lastMsg.latency_ms = data.latency_ms;
                lastMsg.tokens_per_second = data.tokens_per_second;
                lastMsg.nodes = [data.node_used || 'local'];
                newMsgs[newMsgs.length - 1] = lastMsg;
                return newMsgs;
              });
              setIsGenerating(false);
              return;
            }

            // Legacy format fallback (response field)
            else if (data.response) {
              setMessages(prev => {
                const newMsgs = [...prev];
                const lastMsg = { ...newMsgs[newMsgs.length - 1] };
                lastMsg.content += data.response;
                newMsgs[newMsgs.length - 1] = lastMsg;
                return newMsgs;
              });
            }
          } catch (err) {
            // ignore parse errors
          }
        }

      }
    } catch (e) {
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1].content += "\nConnection error.";
        return newMsgs;
      });
      setIsGenerating(false);
    }
  };

  return { messages, isGenerating, sendMessage, convId, setMessages };
};
