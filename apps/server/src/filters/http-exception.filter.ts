import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        error = body;
      } else if (body && typeof body === 'object') {
        const obj = body as { message?: string | string[]; error?: string };
        const fromMessage = Array.isArray(obj.message)
          ? obj.message.join(', ')
          : obj.message;
        message = fromMessage || obj.error || exception.message;
        // Client SnapshotApiError reads `body.error` as the human detail.
        error = obj.error || message;
      } else {
        message = exception.message;
        error = message;
      }
    } else if (exception instanceof Error) {
      const statusCode = (exception as Error & { statusCode?: number }).statusCode;
      if (typeof statusCode === 'number') {
        status = statusCode;
      }
      message = exception.message;
      error = message;
    }

    if (status >= 500) {
      console.error(`[HttpExceptionFilter] ${request.method} ${request.url}`, exception);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      error,
    });
  }
}
