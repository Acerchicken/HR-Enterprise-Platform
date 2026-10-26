import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeService } from '../employee/employee.service';
import { RoleAssignment } from './role-assignment.entity';
import { AuthUser, Role, ROLES } from './roles';
import { VerifiedToken } from './token-verifier';
import { UserAccount } from './user-account.entity';

/**
 * Map tài khoản đăng nhập (IdP) ↔ nhân viên, và tính role thực tế:
 *   role trong token (realm role của Keycloak) ∪ role gán trong DB
 *   ∪ EMPLOYEE (nếu gắn với nhân viên) ∪ MANAGER (nếu có nhân viên trực thuộc).
 */
@Injectable()
export class IdentityService {
  constructor(
    @InjectRepository(UserAccount) private readonly accounts: Repository<UserAccount>,
    @InjectRepository(RoleAssignment) private readonly roleRepo: Repository<RoleAssignment>,
    private readonly employees: EmployeeService,
  ) {}

  async resolve(token: VerifiedToken): Promise<AuthUser> {
    const devLogin = token.subject.startsWith('dev|');
    let account = devLogin
      ? await this.accounts.findOneBy({ email: token.email })
      : ((await this.accounts.findOneBy({ subject: token.subject })) ??
        (await this.accounts.findOneBy({ email: token.email })));

    if (!account) {
      // Just-in-time provisioning: lần đăng nhập đầu tiên, tìm nhân viên theo email công ty.
      const employee = await this.employees.findByWorkEmail(token.email);
      account = await this.accounts.save(
        this.accounts.create({ subject: devLogin ? null : token.subject, email: token.email, employeeId: employee?.id ?? null }),
      );
    } else if (!devLogin && account.subject !== token.subject) {
      // Chặn trường hợp hai tài khoản IdP khác nhau dùng chung một email.
      if (account.subject) throw new UnauthorizedException('Email đã gắn với một tài khoản khác');
      account.subject = token.subject;
      await this.accounts.update(account.id, { subject: token.subject, lastLoginAt: new Date() });
    }

    const roles = new Set<Role>();
    for (const r of token.roles) {
      const upper = r.toUpperCase() as Role;
      if (ROLES.includes(upper)) roles.add(upper);
    }
    for (const ra of await this.roleRepo.findBy({ userId: account.id })) roles.add(ra.role);
    if (account.employeeId) {
      roles.add('EMPLOYEE');
      if (await this.employees.hasDirectReports(account.employeeId)) roles.add('MANAGER');
    }

    return {
      userId: account.id,
      subject: token.subject,
      email: token.email,
      employeeId: account.employeeId,
      roles: [...roles],
    };
  }
}
