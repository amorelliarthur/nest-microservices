import {
    Controller, Get, Post, Delete, Param, Body,
    HttpCode, HttpStatus, Req, ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';

@Controller('accounts')
export class AccountsController {
    constructor(private readonly accountsService: AccountsService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(@Body() dto: CreateAccountDto, @Req() req: Request) {
        const userId = req.headers['x-user-id'] as string;
        const role = req.headers['x-user-role'] as string;

        // só o dono do token ou ADMIN pode criar conta para um userId
        if (role !== 'ADMIN' && dto.userId !== userId) {
            throw new ForbiddenException('Você só pode criar contas para você mesmo');
        }

        return this.accountsService.create(dto);
    }

    @Get('user/:userId')
    findByUser(@Param('userId') userId: string) {
        return this.accountsService.findByUser(userId);
    }

    @Get(':id')
    findById(@Param('id') id: string) {
        return this.accountsService.findById(id);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id') id: string) {
        return this.accountsService.remove(id);
    }
}