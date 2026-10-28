import { httpClient, UpstreamError } from '../../utils/httpClient'
import { audioSiloSearchSchema, audioSiloWorkSchema, audioSiloChaptersSchema } from './schemas'
import type { AudioSiloWork, AudioSiloChapter } from './types'

export const audioSiloUrl = 'https://meta.audiosilo.app'

export class AudioSiloClient {
  async search(title: string, limit: number): Promise<string[]> {
    const response = await httpClient.get(`${audioSiloUrl}/api/v1/works/search`, {
      params: { q: title, limit }
    })

    if (response.status !== 200) throw new UpstreamError('AudioSilo search failed', response.status)

    return audioSiloSearchSchema.parse(response.data).results.map((work) => work.id)
  }

  async work(id: string): Promise<AudioSiloWork | null> {
    const response = await httpClient.get(`${audioSiloUrl}/api/v1/works/${encodeURIComponent(id)}`)
    if (response.status === 404) return null

    return audioSiloWorkSchema.parse(response.data)
  }

  async chapters(workId: string, recordingId: string): Promise<AudioSiloChapter[]> {
    const work = encodeURIComponent(workId)
    const recording = encodeURIComponent(recordingId)
    const response = await httpClient.get(`${audioSiloUrl}/api/v1/works/${work}/recordings/${recording}/chapters`)
    if (response.status !== 200) throw new UpstreamError('AudioSilo chapters unavailable', response.status)

    return audioSiloChaptersSchema.parse(response.data).chapters
  }
}
