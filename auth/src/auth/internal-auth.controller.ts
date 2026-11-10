import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GatewaySecretGuard } from '../internal-token/gateway-secret.guard';

// Fora de /auth: o proxy do gateway não encaminha esta rota.
@Controller('internal')
@UseGuards(GatewaySecretGuard)
export class InternalAuthController {
  constructor(private readonly authService: AuthService) {}

  // JWT do cliente no header token; devolve a identidade e o token interno
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  validate(@Headers('token') token: string) {
    return this.authService.validateForGateway(token);
  }
}
