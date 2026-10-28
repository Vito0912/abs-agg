export async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  map: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Map<number, R>()
  let nextIndex = 0

  async function consume(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++
      const item = items[index]
      results.set(index, await map(item, index))
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length)
  const workers = Array.from({ length: workerCount }, () => consume())
  const outcomes = await Promise.allSettled(workers)
  const failure = outcomes.find((outcome) => outcome.status === 'rejected')
  if (failure?.status === 'rejected') throw failure.reason

  return [...results.entries()].sort(([left], [right]) => left - right).map(([, result]) => result)
}
