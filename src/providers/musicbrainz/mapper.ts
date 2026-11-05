import { normalizeIsbn } from '../../metadata/identity'
import type { BookMetadata, Contributor, SeriesMetadata } from '../../types'
import type { MusicBrainzRelation, MusicBrainzRelease, MusicBrainzTrack, MusicBrainzWork } from './types'

function releaseTracks(release: MusicBrainzRelease): MusicBrainzTrack[] {
  return [...release.media]
    .sort((left, right) => left.position - right.position)
    .flatMap((medium) => {
      const tracks = [...medium.tracks].sort((left, right) => left.position - right.position)
      return medium.pregap ? [medium.pregap, ...tracks] : tracks
    })
}

function relatedWorks(tracks: MusicBrainzTrack[]): MusicBrainzWork[] {
  const works = new Map<string, MusicBrainzWork>()

  for (const track of tracks) {
    for (const relation of track.recording.relations) {
      if (relation.type !== 'performance' || !relation.work || relation.work.type !== 'Prose') continue
      works.set(relation.work.id, relation.work)
    }
  }

  return [...works.values()]
}

function relationContributors(relations: MusicBrainzRelation[]): Contributor[] {
  const contributors: Contributor[] = []

  for (const relation of relations) {
    if (!relation.artist) continue

    let role: Contributor['role'] | undefined
    if (relation.type === 'writer') role = 'author'
    if (relation.type === 'translator') role = 'translator'
    if (relation.type === 'composer') role = 'composer'
    if (relation.type === 'vocal' && relation.attributes.includes('spoken vocals')) role = 'narrator'
    if (!role) continue

    contributors.push({ name: relation.artist.name, sourceId: relation.artist.id, role })
  }

  return contributors
}

function releaseContributors(
  release: MusicBrainzRelease,
  tracks: MusicBrainzTrack[],
  works: MusicBrainzWork[]
): Contributor[] {
  const relations = [
    ...release.relations,
    ...tracks.flatMap((track) => track.recording.relations),
    ...works.flatMap((work) => work.relations)
  ]
  const contributors = relationContributors(relations)
  const credits = release['artist-credit']
  const narratorBoundary = credits.findIndex((credit) =>
    /\b(read by|narrated by|gelesen von|gesprochen von|lu par|gelezen door|le[ií]do por)\b/i.test(
      credit.joinphrase || ''
    )
  )

  if (narratorBoundary >= 0) {
    const hasAuthors = contributors.some((contributor) => contributor.role === 'author')
    const hasNarrators = contributors.some((contributor) => contributor.role === 'narrator')

    for (const [index, credit] of credits.entries()) {
      const role = index <= narratorBoundary ? 'author' : 'narrator'
      if ((role === 'author' && hasAuthors) || (role === 'narrator' && hasNarrators)) continue

      contributors.push({ name: credit.name || credit.artist.name, sourceId: credit.artist.id, role })
    }
  }

  const unique = new Map<string, Contributor>()
  for (const contributor of contributors) unique.set(`${contributor.sourceId}:${contributor.role}`, contributor)

  return [...unique.values()]
}

function releaseChapters(release: MusicBrainzRelease, tracks: MusicBrainzTrack[]): BookMetadata['chapters'] {
  const chapters: NonNullable<BookMetadata['chapters']> = []
  let offsetSeconds: number | undefined = hasCompleteTracklist(release) ? 0 : undefined

  for (const [index, track] of tracks.entries()) {
    const lengthMilliseconds = track.length ?? track.recording.length
    const durationSeconds =
      lengthMilliseconds === undefined || lengthMilliseconds === null ? undefined : lengthMilliseconds / 1000
    const endSeconds: number | undefined =
      offsetSeconds === undefined || durationSeconds === undefined ? undefined : offsetSeconds + durationSeconds

    chapters.push({
      id: `${release.id}:track:${track.id}`,
      title: track.title,
      sequence: index + 1,
      startSeconds: endSeconds === undefined ? undefined : offsetSeconds,
      endSeconds,
      timeline: endSeconds === undefined ? undefined : 'book',
      sourceUrl: `https://musicbrainz.org/recording/${track.recording.id}`
    })
    offsetSeconds = endSeconds
  }

  return chapters
}

function hasCompleteTracklist(release: MusicBrainzRelease): boolean {
  return release.media.length > 0 && release.media.every((medium) => medium.tracks.length === medium['track-count'])
}

function releaseSeries(relations: MusicBrainzRelation[]): SeriesMetadata[] {
  const memberships: SeriesMetadata[] = []

  for (const relation of relations) {
    if (relation.type !== 'part of' || !relation.series) continue

    memberships.push({
      sourceId: relation.series.id,
      series: relation.series.name,
      sequence: relation['attribute-values']?.number
    })
  }

  return memberships
}

function workLanguage(works: MusicBrainzWork[]): string | undefined {
  const languages = new Set<string>()

  for (const work of works) {
    const workLanguages = work.languages || (work.language ? [work.language] : [])
    if (workLanguages.length === 0) return undefined

    for (const language of workLanguages) languages.add(language)
  }

  const language = [...languages][0]
  return languages.size === 1 && !['mul', 'und', 'zxx'].includes(language) ? language : undefined
}

export function mapRelease(release: MusicBrainzRelease): BookMetadata | null {
  if (!release['release-group']['secondary-types'].includes('Audiobook')) return null

  const tracks = releaseTracks(release)
  const works = relatedWorks(tracks)
  const contributors = releaseContributors(release, tracks, works)
  const chapters = releaseChapters(release, tracks)
  const durationSeconds = chapters?.at(-1)?.endSeconds
  const publishers = [...new Set(release['label-info'].flatMap((entry) => (entry.label ? [entry.label.name] : [])))]
  const work = works.length === 1 ? works[0] : undefined
  const barcode = release.barcode?.trim()
  const isbn = barcode && /^97[89]\d{10}$/.test(barcode) ? normalizeIsbn(barcode) : undefined

  return {
    bookId: release.id,
    sourceUrl: `https://musicbrainz.org/release/${release.id}`,
    title: release.title,
    format: 'audiobook',
    contributors,
    publisher: publishers.length > 0 ? publishers.join(', ') : undefined,
    publishedDate: release.date || undefined,
    language: workLanguage(works),
    isbn,
    asin: release.asin || undefined,
    cover: release['cover-art-archive']?.front
      ? `https://coverartarchive.org/release/${release.id}/front-500`
      : undefined,
    genres: release.genres.map((genre) => genre.name),
    durationSeconds,
    chapters,
    series: releaseSeries([...release.relations, ...works.flatMap((work) => work.relations)]),
    work: work ? { id: work.id, title: work.title } : undefined
  }
}
