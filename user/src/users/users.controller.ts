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
  Request,
} from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { OwnerOrAdminGuard } from '../common/guards/owner-or-admin.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { Request as ExpressRequest } from 'express';

@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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

  @Get()
  @UseGuards(AdminGuard)
  findAll(@Query('nome') nome?: string) {
    return this.usersService.findAll(nome);
  }

  // Usuário autenticado busca os próprios dados
  @Get('me')
  getMe(@Request() req: ExpressRequest) {
    // lê do header repassado pelo gateway
    const userId = req.headers['x-user-id'] as string;
    return this.usersService.findById(userId);
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @UseGuards(OwnerOrAdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(OwnerOrAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
