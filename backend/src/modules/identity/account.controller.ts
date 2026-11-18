import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountService } from './account.service';
import { CurrentUser, Roles } from './auth.decorators';
import { AuthUser } from './roles';

/** UC8 FR-8.6 (spec 9.2 "Tài khoản của nhân viên"). Chỉ HR (AC-8.6.3). */
@ApiTags('identity')
@ApiBearerAuth()
@Controller('employees/:id/account')
@Roles('HR')
export class AccountController {
  constructor(private readonly accounts: AccountService) {}

  @Get()
  view(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.view(id);
  }

  @Post('invite')
  @HttpCode(202)
  invite(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.accounts.invite(user, id);
  }
}
