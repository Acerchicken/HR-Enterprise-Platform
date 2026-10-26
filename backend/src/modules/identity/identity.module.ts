import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeModule } from '../employee/employee.module';
import { AuthGuard } from './auth.guard';
import { IdentityService } from './identity.service';
import { RoleAssignment } from './role-assignment.entity';
import { TokenVerifier } from './token-verifier';
import { UserAccount } from './user-account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserAccount, RoleAssignment]), EmployeeModule],
  providers: [TokenVerifier, IdentityService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class IdentityModule {}
