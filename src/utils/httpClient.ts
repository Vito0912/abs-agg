import axios from 'axios'
import { SpanKind, trace } from '@opentelemetry/api'
import { observeOperation } from '../telemetry/operations'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { remainingRequestMs } from './requestContext'
import { setTimeout as delay } from 'node:timers/promises'
import { Agent } from 'node:https'
import { OutboundPolicyError, validateUpstreamUrl } from './outboundPolicy'

type UpstreamRequestOptions = Pick<AxiosRequestConfig, 'headers' | 'params' | 'responseType'> & {
  maxRedirects?: 0
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'UpstreamError'
  }
}

interface WaitingRequest {
  resolve: () => void
  timeout: NodeJS.Timeout
}

class HostQueue {
  private active = 0
  private readonly waiting: WaitingRequest[] = []

  async acquire(): Promise<() => void> {
    if (this.active < 4) {
      this.active++
      return () => this.release()
    }

    if (this.waiting.length >= 32) throw new UpstreamError('Upstream request queue is full')

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          const index = this.waiting.findIndex((request) => request.timeout === timeout)
          if (index >= 0) this.waiting.splice(index, 1)
          reject(new UpstreamError('Upstream request queue timed out'))
        },
        Math.min(10000, remainingRequestMs())
      )

      this.waiting.push({ resolve, timeout })
    })

    return () => this.release()
  }

  private release(): void {
    const next = this.waiting.shift()
    if (next) {
      clearTimeout(next.timeout)
      next.resolve()
      return
    }

    this.active--
  }
}

const client = axios.create({
  adapter: 'http',
  proxy: false,
  httpsAgent: new Agent({ maxSockets: 4, maxTotalSockets: 32, maxFreeSockets: 4 }),
  timeout: 15000,
  maxContentLength: 32 * 1024 * 1024,
  maxBodyLength: 1024 * 1024,
  maxRedirects: 3,
  headers: {
    'User-Agent': 'AudiobookshelfMetadataProvider/2.0',
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9'
  },
  validateStatus: (status) => (status >= 200 && status < 300) || status === 404
})
const queues = new Map<string, HostQueue>()

function hostQueue(url: string): HostQueue {
  const host = new URL(url).host
  const existing = queues.get(host)
  if (existing) return existing
  if (queues.size >= 100) throw new UpstreamError('Too many upstream hosts')

  const queue = new HostQueue()
  queues.set(host, queue)
  return queue
}

function canRetry(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  if (error.code === 'ERR_UPSTREAM_DESTINATION' || error.code === 'ERR_FR_REDIRECTION_FAILURE') return false
  const status = error.response?.status

  return status === 429 || status === 502 || status === 503 || status === 504 || !error.response
}

async function request<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
  if (!config.url) throw new Error('Upstream URL is required')
  const url = validateUpstreamUrl(config.url)
  config.url = url.href
  config.beforeRedirect = (options) => {
    const destination = validateUpstreamUrl(
      `${options.protocol}//${options.hostname}${options.port ? `:${options.port}` : ''}${options.path || '/'}`
    )
    if (destination.origin !== url.origin || options.auth) throw new OutboundPolicyError()
  }
  const release = await hostQueue(config.url).acquire()

  try {
    return await send<T>(config)
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new UpstreamError('Upstream HTTP request failed', error.response?.status, {
        cause: new Error(error.code || 'Upstream transport error')
      })
    }
    throw error
  } finally {
    release()
  }
}

async function send<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
  try {
    return await sendWithinDeadline<T>(config)
  } catch (error) {
    if (config.method !== 'GET' || !canRetry(error)) throw error

    const waitMs = retryDelayMs(error)
    if (waitMs === undefined || waitMs >= remainingRequestMs()) throw error

    await delay(waitMs)
    return sendWithinDeadline<T>(config)
  }
}

function retryDelayMs(error: unknown): number | undefined {
  if (axios.isAxiosError(error)) {
    const retryAfter = error.response?.headers['retry-after']

    if (typeof retryAfter === 'string') {
      const seconds = Number(retryAfter)
      const delayMs = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now()
      if (!Number.isFinite(delayMs) || delayMs > 5000) return undefined

      return Math.max(0, delayMs)
    }
  }

  return 200 + Math.round(Math.random() * 300)
}

async function sendWithinDeadline<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
  const remainingMs = remainingRequestMs()
  if (remainingMs === 0) throw new UpstreamError('Metadata request deadline exceeded')

  const timeout = Math.min(15000, remainingMs)

  const attributes = {
    'http.request.method': config.method || 'GET',
    'server.address': new URL(config.url || '').hostname
  }

  return observeOperation(
    'upstream.request',
    attributes,
    async () => {
      const response = await client.request<T>({ ...config, timeout, signal: AbortSignal.timeout(timeout) })
      trace.getActiveSpan()?.setAttribute('http.response.status_code', response.status)

      return response
    },
    SpanKind.CLIENT
  )
}

export const httpClient = {
  get<T = unknown>(url: string, config: UpstreamRequestOptions = {}): Promise<AxiosResponse<T>> {
    return request<T>({ ...config, url, method: 'GET' })
  },
  post<T = unknown>(url: string, data: unknown, config: UpstreamRequestOptions = {}): Promise<AxiosResponse<T>> {
    return request<T>({ ...config, url, data, method: 'POST' })
  }
}
