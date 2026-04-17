import {
    Controller, Get, Post, Patch, Delete,
    Param, Body, Query, HttpCode, HttpStatus, UseGuards, Request,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { OwnerOrAdminGuard } from '../common/guards/owner-or-admin.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('user')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

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
    @UseGuards(AuthGuard, AdminGuard)
    findAll(@Query('nome') nome?: string) {
        return this.usersService.findAll(nome);
    }

    // Usuário autenticado busca os próprios dados
    @Get('me')
    @UseGuards(AuthGuard)
    getMe(@Request() req: any) {
        return this.usersService.findById(req.user.id);
    }

    @Get(':id')
    @UseGuards(AuthGuard, AdminGuard)
    findById(@Param('id') id: string) {
        return this.usersService.findById(id);
    }

    @Patch(':id')
    @UseGuards(AuthGuard, OwnerOrAdminGuard)
    update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
        return this.usersService.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(AuthGuard, OwnerOrAdminGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id') id: string) {
        return this.usersService.remove(id);
    }
}