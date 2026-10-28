import type { z } from 'zod'
import type { audioSiloWorkSchema, audioSiloRecordingSchema, audioSiloChaptersSchema } from './schemas'

export type AudioSiloWork = z.infer<typeof audioSiloWorkSchema>
export type AudioSiloRecording = z.infer<typeof audioSiloRecordingSchema>
export type AudioSiloChapter = z.infer<typeof audioSiloChaptersSchema>['chapters'][number]

export interface RecordingChapters {
  recording: AudioSiloRecording
  chapters: AudioSiloChapter[]
  complete: boolean
}
