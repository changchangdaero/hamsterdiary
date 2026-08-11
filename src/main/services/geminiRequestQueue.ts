const GEMINI_MIN_REQUEST_INTERVAL_MS = 4_100
const GEMINI_MAX_RATE_LIMIT_RETRIES = 3
const GEMINI_INITIAL_BACKOFF_MS = 500

let queueTail: Promise<void> = Promise.resolve()
let lastRequestStartedAt = 0

const wait = (milliseconds: number, signal?: AbortSignal | null): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
      return
    }

    const finish = (): void => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }
    const timer = setTimeout(finish, milliseconds)
    const abort = (): void => {
      clearTimeout(timer)
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', abort, { once: true })
  })

const parseRetryAfterMilliseconds = (value: string | null): number | null => {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000

  const retryAt = Date.parse(value)
  if (!Number.isFinite(retryAt)) return null
  return Math.max(0, retryAt - Date.now())
}

const isRateLimited = async (response: Response): Promise<boolean> => {
  if (response.status === 429) return true
  if (response.status !== 403) return false

  const body = await response.clone().text().catch(() => '')
  return /rate.?limit|resource_exhausted|quota/i.test(body)
}

const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const result = queueTail.then(task, task)
  queueTail = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

export const fetchGeminiQueued = (
  input: string,
  init: RequestInit
): Promise<Response> =>
  enqueue(async () => {
    for (let attempt = 0; attempt <= GEMINI_MAX_RATE_LIMIT_RETRIES; attempt += 1) {
      const throttleDelay = Math.max(
        0,
        GEMINI_MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestStartedAt)
      )
      if (throttleDelay > 0) {
        console.log('[gemini:queue] throttled', { waitMs: throttleDelay })
        await wait(throttleDelay, init.signal)
      }

      lastRequestStartedAt = Date.now()
      console.log('[gemini:queue] request started', { attempt: attempt + 1 })
      const response = await fetch(input, init)
      if (!(await isRateLimited(response)) || attempt === GEMINI_MAX_RATE_LIMIT_RETRIES) {
        return response
      }

      const retryAfter = parseRetryAfterMilliseconds(
        response.headers.get('retry-after')
      )
      const backoff = GEMINI_INITIAL_BACKOFF_MS * 2 ** attempt
      const retryDelay = retryAfter ?? backoff
      console.warn('[gemini:queue] rate limited; retry scheduled', {
        status: response.status,
        attempt: attempt + 1,
        retryInMs: retryDelay
      })
      await wait(retryDelay, init.signal)
    }

    throw new Error('Gemini rate limit retry loop ended unexpectedly')
  })
