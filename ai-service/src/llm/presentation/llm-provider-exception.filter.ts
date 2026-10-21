import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { LlmProviderError } from '../domain/llm-provider.error';

@Catch(LlmProviderError)
export class LlmProviderExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(LlmProviderExceptionFilter.name);

  catch(exception: LlmProviderError, host: ArgumentsHost) {
    // Detalhes do provedor ficam no log; o cliente só sabe se vale tentar de novo
    this.logger.warn(exception.message);

    const status = exception.retryable
      ? HttpStatus.SERVICE_UNAVAILABLE
      : HttpStatus.BAD_GATEWAY;
    const message = exception.retryable
      ? 'The AI service is temporarily unavailable. Please try again shortly.'
      : 'The AI service could not process the request.';

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message });
  }
}
