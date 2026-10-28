export class DatabaseError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid-cache' | 'database'
  ) {
    super(message)
    this.name = 'DatabaseError'
  }
}
