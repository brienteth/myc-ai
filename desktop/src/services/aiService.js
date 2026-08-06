/**
 * Myca Execution OS - AI Inference Service
 * Connects to local engine (http://127.0.0.1:8420/query)
 * and seamlessly falls back to 0G Compute Network (gpt-5.6-sol API).
 */

const ZG_ROUTER_URL = 'https://router-api.0g.ai/v1/chat/completions';
const ZG_API_KEY = 'sk-be89b760-6b96-4828-b075-03566a5f50a4';
const DEFAULT_MODEL = 'gpt-5.6-sol';

const SYSTEM_PROMPT = `Sen Myca Execution OS'in resmi ve son derece yetenekli yapay zeka asistanısın.
Kullanıcının isteklerini açık, anlaşılır, doğru ve profesyonel bir şekilde yanıtla. 
Doküman analizi istendiğinde, sağlanan doküman bağlamını dikkate alarak detaylı ve faydalı yanıtlar üret.`;

export async function queryAI({ prompt, systemPrompt = SYSTEM_PROMPT, onToken, convId }) {
  // 1. First attempt: Local Myca Engine Backend
  try {
    const localRes = await fetch('http://127.0.0.1:8420/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, stream: !!onToken, conv_id: convId }),
    });

    if (localRes.ok) {
      if (onToken && localRes.body) {
        const reader = localRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(jsonStr);
              const token = parsed.token || parsed.response || '';
              if (token) {
                fullText += token;
                onToken(token);
              }
            } catch (e) {}
          }
        }
        return fullText;
      } else {
        const data = await localRes.json();
        return data.response || data.text || 'İşlem tamamlandı.';
      }
    }
  } catch (err) {
    console.warn("Local Myca engine offline. Falling back to 0G Compute Network (gpt-5.6-sol)...");
  }

  // 2. Direct Fallback: 0G Compute Network (gpt-5.6-sol)
  try {
    const payload = {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      stream: !!onToken
    };

    const zgRes = await fetch(ZG_ROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ZG_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!zgRes.ok) {
      const errText = await zgRes.text();
      throw new Error(`0G API HTTP ${zgRes.status}: ${errText}`);
    }

    if (onToken && zgRes.body) {
      const reader = zgRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              fullText += content;
              onToken(content);
            }
          } catch (e) {}
        }
      }
      return fullText;
    } else {
      const data = await zgRes.json();
      return data.choices?.[0]?.message?.content || 'Yanıt alınamadı.';
    }
  } catch (zgErr) {
    console.error("0G Compute Fallback Error:", zgErr);
    return `Üzgünüm, şu anda yanıt oluşturulamadı (${zgErr.message}). Lütfen bağlantınızı kontrol edin.`;
  }
}
