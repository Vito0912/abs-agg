import type { PublicationDate } from '../types'

export function publicationDate(value: string | undefined): PublicationDate | undefined {
  const match = value?.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/)
  if (!match) return undefined

  const [, year, month, day] = match
  const yearDate: PublicationDate = { value: year, precision: 'year' }
  if (!month || Number(month) < 1 || Number(month) > 12) return yearDate

  const monthDate: PublicationDate = { value: `${year}-${month}`, precision: 'month' }
  if (!day) return monthDate

  const daysInMonth = new Date(Number(year), Number(month), 0).getDate()
  if (Number(day) < 1 || Number(day) > daysInMonth) return monthDate

  return { value: `${year}-${month}-${day}`, precision: 'day' }
}
