import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { AgentLoopLimitError } from '../domain/agent-loop-limit.error';

@Catch(AgentLoopLimitError)
export class AgentLoopLimitExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AgentLoopLimitExceptionFilter.name);

  catch(exception: AgentLoopLimitError, host: ArgumentsHost) {
    this.logger.warn(exception.message);

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.BAD_GATEWAY)
      .json({
        statusCode: HttpStatus.BAD_GATEWAY,
        message:
          'The assistant could not complete the answer. Please try again.',
      });
  }
}
