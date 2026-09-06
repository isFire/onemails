/**
 * 出站 fetch 重试补丁：只针对 github.com / api.github.com。
 * 服务器所在网络对 github.com 的 TLS 连接被按概率切断，
 * GitHub OAuth 的 access_token 交换大概率失败，这里仅在网络层
 * 异常（fetch 抛错）时重试；拿到 HTTP 响应（任何状态码）立即原样返回。
 * 单次尝试限 8s 超时，防止挂起型失败拖爆反向代理超时。
 */

const RETRY_HOSTS = new Set(['github.com', 'api.github.com']);
const MAX_ATTEMPTS = 6; // 首次 + 5 次重试
const RETRY_DELAY_MS = 300;
const ATTEMPT_TIMEOUT_MS = 8000;

let patched = false;

const getHostname = (input: RequestInfo | URL): string | null => {
  try {
    if (input instanceof Request) return new URL(input.url).hostname;
    return new URL(input.toString()).hostname;
  } catch {
    return null;
  }
};

export function patchFetchWithRetry(): void {
  if (patched) return;
  patched = true;

  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const hostname = getHostname(input);
    if (!hostname || !RETRY_HOSTS.has(hostname)) {
      return originalFetch(input, init);
    }

    // 调用方已带 signal（含 Request 对象自带 signal）时原样透传，尊重其取消语义；
    // 否则注入 8s 超时 signal，防止挂起型失败长时间占用。
    const callerHasSignal =
      init?.signal != null || (input instanceof Request && input.signal != null);
    const attemptInit: RequestInit | undefined = callerHasSignal
      ? init
      : { ...init, signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS) };

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await originalFetch(input, attemptInit);
      } catch (err) {
        lastError = err;
        if (attempt < MAX_ATTEMPTS) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`[fetch-retry] ${hostname} attempt ${attempt} failed: ${message}, retrying...`);
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }
    }
    throw lastError;
  };
}
