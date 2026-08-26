import { HttpException, HttpStatus } from '@nestjs/common';

/** Throw Nest HttpException preserving `{ error }` body the client expects. */
export function httpError(
  message: string,
  statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
): HttpException {
  return new HttpException({ error: message, message }, statusCode);
}

/** Map service errors that carry `statusCode` (SourceApiError / legacy) into HttpException. */
export function toHttpException(err: unknown): HttpException {
  if (err instanceof HttpException) return err;
  const status = (err as { statusCode?: number })?.statusCode;
  const message = err instanceof Error ? err.message : String(err);
  if (typeof status === 'number') {
    return httpError(message, status);
  }
  return httpError(message, HttpStatus.INTERNAL_SERVER_ERROR);
}

export function rethrowAsHttp(err: unknown): never {
  throw toHttpException(err);
}
