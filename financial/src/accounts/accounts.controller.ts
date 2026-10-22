import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { CurrentRequester } from '../common/auth/current-requester.decorator';
import { canAccess } from '../common/auth/requester';
import type { Requester } from '../common/auth/requester';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateAccountDto,
    @CurrentRequester() requester: Requester,
  ) {
    // só o dono do token ou ADMIN pode criar conta para um userId
    if (!canAccess(requester, dto.userId)) {
      throw new ForbiddenException('Você só pode criar contas para você mesmo');
    }

    return this.accountsService.create(dto);
  }

  @Get('user/:userId')
  findByUser(
    @Param('userId') userId: string,
    @CurrentRequester() requester: Requester,
  ) {
    return this.accountsService.findByUser(userId, requester);
  }

  // Declarada antes de ':id': senão "me" seria tratado como id de conta
  @Get('me')
  findMine(@CurrentRequester() requester: Requester) {
    return this.accountsService.findByUser(requester.id, requester);
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentRequester() requester: Requester) {
    return this.accountsService.findById(id, requester);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentRequester() requester: Requester) {
    return this.accountsService.remove(id, requester);
  }
}
