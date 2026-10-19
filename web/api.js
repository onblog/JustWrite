const token = document.querySelector('meta[name="jw-token"]')?.content ?? '';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-JW-Token': token,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new ApiError(data.error || `request failed (${response.status})`, response.status);
  }
  return data;
}

export const api = {
  config: () => request('/api/config'),
  saveConfig: (patch) => request('/api/config', { method: 'PUT', body: patch }),
  actions: () => request('/api/actions'),

  tree: () => request('/api/tree'),
  read: (path) => request(`/api/file?path=${encodeURIComponent(path)}`),
  write: (path, content) => request('/api/file', { method: 'PUT', body: { path, content } }),
  create: (path, content = '') => request('/api/file', { method: 'POST', body: { path, content } }),
  mkdir: (path) => request('/api/mkdir', { method: 'POST', body: { path } }),
  remove: (path) => request(`/api/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),
  rename: (from, to) => request('/api/rename', { method: 'POST', body: { from, to } }),
  search: (q) => request(`/api/search?q=${encodeURIComponent(q)}`),

  /**
   * Stream one AI action. onDelta receives raw text chunks.
   * Resolves when the stream ends; rejects on transport or upstream errors.
   */
  async streamAi({ action, text, options, onDelta, signal }) {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-JW-Token': token },
      body: JSON.stringify({ action, text, options }),
      signal,
    });

    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => '');
      throw new ApiError(body || `AI request failed (${response.status})`, response.status);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let index;
      while ((index = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 2);
        if (!chunk.startsWith('data:')) continue;
        const payload = chunk.slice(5).trim();
        if (!payload) continue;
        const event = JSON.parse(payload);
        if (event.error) throw new ApiError(event.error, 502);
        if (event.delta) onDelta(event.delta);
      }
    }
  },
};

export { ApiError };
