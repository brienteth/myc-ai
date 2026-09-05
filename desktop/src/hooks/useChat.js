import { useState, useEffect } from 'react';
import { queryAI } from '../services/aiService';

export const useChat = (initialConvId = null) => {
  const [messages, setMessages] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [convId, setConvId] = useState(initialConvId || crypto.randomUUID());

  useEffect(() => {
    const backendUrl = window.getBackendUrl ? window.getBackendUrl() : `${window.getBackendUrl ? window.getBackendUrl() : 'http://127.0.0.1:8420'}`;
    if (initialConvId) {
      fetch(`${backendUrl}/history/${initialConvId}`)
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

  const sendMessage = async (prompt, options = {}) => {
    if (!prompt.trim() || isGenerating) return;

    const skipPlanner = options.skipPlanner !== undefined ? options.skipPlanner : false;
    const newMessages = [...messages, { role: 'user', content: prompt }];

    setIsGenerating(true);
    setMessages([...newMessages, { role: 'myca', content: '', nodes: ['Myca Engine'] }]);

    let startTime = Date.now();
    let metaData = {};

    const result = await queryAI({
      prompt,
      convId,
      skipPlanner,
      onToken: (token) => {
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = { ...newMsgs[newMsgs.length - 1] };
          lastMsg.content += token;
          newMsgs[newMsgs.length - 1] = lastMsg;
          return newMsgs;
        });
      },
      onMeta: (meta) => {
        metaData = meta;
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
      lastMsg.node_display = metaData.node_display || "Myca Engine (LOCAL)";
      lastMsg.node_used = metaData.node_used || "LOCAL";
      lastMsg.tps = metaData.tps || null;
      lastMsg.tokens_per_second = metaData.tps || null;
      lastMsg.latency_ms = metaData.latency_ms || null;
      lastMsg.context_details = metaData.context_details || {};
      lastMsg.mode = metaData.mode || "KNOWLEDGE_MODE";
      lastMsg.cost = metaData.cost || 0.00;
      newMsgs[newMsgs.length - 1] = lastMsg;
      return newMsgs;
    });
    setIsGenerating(false);
  };

    const startNewChat = () => {
    setMessages([]);
    setConvId(crypto.randomUUID());
  };

  return { messages, isGenerating, sendMessage, convId, setMessages, startNewChat };
};
