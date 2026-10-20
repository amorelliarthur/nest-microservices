import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../../shared/auth/authenticated-user';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { AskAssistantUseCase } from '../application/ask-assistant.use-case';
import { askAssistantSchema } from './ask-assistant.schema';
import type { AskAssistantInput } from './ask-assistant.schema';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly askAssistant: AskAssistantUseCase) {}

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  ask(
    @Body(new ZodValidationPipe(askAssistantSchema)) input: AskAssistantInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.askAssistant.execute(input.question, user.id);
  }
}
