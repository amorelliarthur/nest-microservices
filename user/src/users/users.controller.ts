import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { CurrentRequester } from '../common/auth/current-requester.decorator';
import { InternalTokenGuard } from '../common/auth/internal-token.guard';
import type { Requester } from '../common/auth/requester';
import { AdminGuard } from '../common/guards/admin.guard';
import { OwnerOrAdminGuard } from '../common/guards/owner-or-admin.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Cadastro público: o gateway libera esta rota sem login, por isso não há token interno
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  // Rota interna usada pelo auth-service
  @Post('authenticate')
  @HttpCode(HttpStatus.OK)
  authenticate(@Body() body: { email: string; senha: string }) {
    return this.usersService.authenticate(body.email, body.senha);
  }

  // Os guards rodam na ordem: primeiro o token interno, depois a role/dono
  @Get()
  @UseGuards(InternalTokenGuard, AdminGuard)
  findAll(@Query('nome') nome?: string) {
    return this.usersService.findAll(nome);
  }

  // Usuário autenticado busca os próprios dados
  @Get('me')
  @UseGuards(InternalTokenGuard)
  getMe(@CurrentRequester() requester: Requester) {
    return this.usersService.findById(requester.id);
  }

  @Get(':id')
  @UseGuards(InternalTokenGuard, AdminGuard)
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @UseGuards(InternalTokenGuard, OwnerOrAdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(InternalTokenGuard, OwnerOrAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
