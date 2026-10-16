import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { StructuredOutputError } from '../domain/structured-output.error';

@Catch(StructuredOutputError)
export class StructuredOutputExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(StructuredOutputExceptionFilter.name);

  catch(exception: StructuredOutputError, host: ArgumentsHost) {
    // O motivo técnico fica no log; o cliente recebe uma mensagem genérica
    this.logger.warn(exception.message);

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.BAD_GATEWAY)
      .json({
        statusCode: HttpStatus.BAD_GATEWAY,
        message: 'The AI model returned an invalid response. Please try again.',
      });
  }
}
