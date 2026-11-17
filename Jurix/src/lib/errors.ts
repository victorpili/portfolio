export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class DeleteBlockedError extends Error {
  constructor(
    message: string,
    public readonly blockers: { table: string; count: number; details?: unknown }[],
  ) {
    super(message);
    this.name = "DeleteBlockedError";
  }
}
