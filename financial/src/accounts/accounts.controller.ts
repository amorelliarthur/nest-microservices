import { Controller, Get, Post, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';

@Controller('accounts')
export class AccountsController {
    constructor(private readonly accountsService: AccountsService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(@Body() dto: CreateAccountDto) {
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