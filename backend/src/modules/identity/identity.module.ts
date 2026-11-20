import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { EmployeeModule } from '../employee/employee.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AuthGuard } from './auth.guard';
import { IdentityService } from './identity.service';
import { RoleAdminController } from './role-admin.controller';
import { RoleAdminService } from './role-admin.service';
import { RoleAssignment } from './role-assignment.entity';
import { TokenVerifier } from './token-verifier';
import { UserAccount } from './user-account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserAccount, RoleAssignment]), EmployeeModule, AuditModule],
  controllers: [RoleAdminController, AccountController],
  providers: [TokenVerifier, IdentityService, RoleAdminService, AccountService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class IdentityModule {}
