/**
 * Prompt presets for the writing assistant.
 * Kept server side so the prompts can be tuned without shipping a new frontend.
 */
export const ACTIONS = {
  polish: {
    label: '润色',
    system: '你是一位中文技术写作编辑。在不改变原意的前提下优化表达：去掉冗余、修正语病、统一术语。只输出改写后的正文，不要解释。',
    user: (text) => `请润色以下内容：\n\n${text}`,
  },
  continue: {
    label: '续写',
    system: '你是一位中文技术作者。延续给定内容的风格、人称和语气继续写，保持段落节奏一致。只输出续写的正文。',
    user: (text) => `请接着下面这段继续写，不要重复已有内容：\n\n${text}`,
  },
  summarize: {
    label: '摘要',
    system: '你是一位擅长提炼要点的编辑。用中文输出摘要：先一句话总述，再用 3-5 条要点列出关键结论。',
    user: (text) => `请为以下内容生成摘要：\n\n${text}`,
  },
  expand: {
    label: '扩写',
    system: '你是一位中文技术作者。把给定内容扩展得更具体：补充背景、例子或细节，但不要编造事实。只输出扩展后的正文。',
    user: (text) => `请扩写以下内容：\n\n${text}`,
  },
  shorten: {
    label: '精简',
    system: '你是一位追求简洁的编辑。压缩给定内容，保留全部关键信息，删除修饰性表达。只输出精简后的正文。',
    user: (text) => `请精简以下内容：\n\n${text}`,
  },
  fix: {
    label: '纠错',
    system: '你是一位中文校对。找出错别字、标点误用和明显的语法问题，直接输出修正后的全文，不要逐条列出问题。',
    user: (text) => `请校对以下内容：\n\n${text}`,
  },
  title: {
    label: '取标题',
    system: '你是一位中文编辑。为给定内容拟 5 个候选标题，每个一行，不加编号和解释，风格清晰具体。',
    user: (text) => `请为以下内容拟标题：\n\n${text}`,
  },
  outline: {
    label: '生成大纲',
    system: '你是一位擅长结构化表达的作者。基于给定主题输出 Markdown 三级以内的大纲，用 `-` 列表，不加解释。',
    user: (text) => `请为以下主题生成写作大纲：\n\n${text}`,
  },
  explain: {
    label: '解释',
    system: '你是一位耐心的技术讲师。用中文解释给定内容中的概念，先给一句话结论，再分点展开，必要时给例子。',
    user: (text) => `请解释以下内容：\n\n${text}`,
  },
  translate: {
    label: '翻译',
    system: '你是一位技术翻译。保持 Markdown 结构、代码块和专有名词不变，只翻译自然语言部分。',
    user: (text, opts = {}) => `请把以下内容翻译成${opts.target || '英文'}：\n\n${text}`,
  },
};

export class AiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').trim().replace(/\/+$/, '');
}

/**
 * Stream a chat completion from any OpenAI-compatible endpoint
 * (DeepSeek, OpenAI, Moonshot, Qwen, Ollama, LM Studio ...).
 */
export async function streamChat({ ai, messages, signal, onDelta }) {
  const baseUrl = normalizeBaseUrl(ai.baseUrl);
  if (!baseUrl) throw new AiError('AI base URL is not configured', 400);
  if (!ai.model) throw new AiError('AI model is not configured', 400);
  if (!ai.apiKey && !/localhost|127\.0\.0\.1/.test(baseUrl)) {
    throw new AiError('AI API key is not configured', 400);
  }

  const headers = { 'Content-Type': 'application/json' };
  if (ai.apiKey) headers.Authorization = `Bearer ${ai.apiKey}`;

  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model: ai.model,
        stream: true,
        temperature: ai.temperature ?? 0.7,
        messages,
      }),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new AiError(`AI endpoint unreachable: ${error.message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new AiError(`AI endpoint returned ${response.status}: ${body.slice(0, 300)}`, 502);
  }
  if (!response.body) throw new AiError('AI endpoint returned an empty body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) onDelta(delta);
      } catch {
        /* ignore keep-alive fragments */
      }
    }
  }
}

export function buildMessages(action, text, options = {}) {
  const preset = ACTIONS[action];
  if (!preset) {
    const error = new Error(`unknown action: ${action}`);
    error.status = 400;
    throw error;
  }
  const trimmed = String(text || '').slice(0, 24000);
  if (!trimmed.trim()) {
    const error = new Error('text is empty');
    error.status = 400;
    throw error;
  }
  return [
    { role: 'system', content: preset.system },
    { role: 'user', content: preset.user(trimmed, options) },
  ];
}
