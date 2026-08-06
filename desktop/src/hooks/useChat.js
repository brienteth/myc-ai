import { useState, useEffect } from 'react';
import { queryAI } from '../services/aiService';

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
    setMessages([...newMessages, { role: 'myca', content: '', nodes: ['Myca Engine'] }]);
    
    let startTime = Date.now();

    const result = await queryAI({
      prompt,
      convId,
      onToken: (token) => {
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = { ...newMsgs[newMsgs.length - 1] };
          lastMsg.content += token;
          newMsgs[newMsgs.length - 1] = lastMsg;
          return newMsgs;
        });
      }
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    setMessages(prev => {
      const newMsgs = [...prev];
      const lastMsg = { ...newMsgs[newMsgs.length - 1] };
      if (!lastMsg.content) {
        lastMsg.content = result || "İşlem tamamlandı.";
      }
      lastMsg.duration = duration;
      lastMsg.node_display = "Myca Engine (0G)";
      newMsgs[newMsgs.length - 1] = lastMsg;
      return newMsgs;
    });
    setIsGenerating(false);
  };

  return { messages, isGenerating, sendMessage, convId, setMessages };
};
