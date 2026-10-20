/**
 * 分片下载：把 dmg 切成多段并发请求，实时上报进度。
 *
 * 前提：服务端支持 Range（Worker 的 /api/download 已返回 206 + Content-Range）。
 * 收益来自「链路利用率」而不是「突破带宽」——单连接被限速时，并发能叠加。
 */

const CHUNK_COUNT_LARGE = 8;
const CHUNK_COUNT_SMALL = 4;
const LARGE_FILE = 50 * 1024 * 1024;

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 并发下载一个文件的所有分片，返回按顺序拼好的 Blob。
 * @param {string} url
 * @param {number} size 总字节数
 * @param {(loaded:number, total:number) => void} onProgress
 * @param {AbortSignal} signal
 */
export async function downloadFile(url, size, onProgress, signal) {
  const chunkCount = size >= LARGE_FILE ? CHUNK_COUNT_LARGE : CHUNK_COUNT_SMALL;
  const chunkSize = Math.ceil(size / chunkCount);

  const parts = new Array(chunkCount).fill(null);
  let loaded = 0;

  const downloadRange = async (index) => {
    const start = index * chunkSize;
    const end = Math.min(start + chunkSize - 1, size - 1);
    if (start > end) return;

    // 一个分片失败时重试两次，避免整次下载白费
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: { Range: `bytes=${start}-${end}` },
          signal,
        });
        if (response.status !== 206) throw new Error(`unexpected status ${response.status}`);

        const reader = response.body.getReader();
        const buffers = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffers.push(value);
          loaded += value.length;
          onProgress?.(loaded, size);
        }
        parts[index] = new Blob(buffers);
        return;
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        if (attempt === 2) throw error;
        await delay(400 * (attempt + 1));
      }
    }
  };

  await Promise.all(Array.from({ length: chunkCount }, (_, index) => downloadRange(index)));

  return new Blob(parts, { type: 'application/octet-stream' });
}

/** Trigger a normal browser download for the assembled blob. */
export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Whether the browser can stream straight to a user-picked file. */
export function canStreamToDisk() {
  return typeof window.showSaveFilePicker === 'function';
}

/**
 * Ask for a destination up front (inside the click gesture), then stream the
 * downloaded blob into it. Returns null when the user cancels the picker.
 */
export async function pickDestination(fileName) {
  if (!canStreamToDisk()) return null;
  try {
    return await window.showSaveFilePicker({ suggestedName: fileName });
  } catch (error) {
    if (error.name === 'AbortError') return null;
    throw error;
  }
}
