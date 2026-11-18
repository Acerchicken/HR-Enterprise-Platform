import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeService } from '../employee/employee.service';
import { RoleAssignment } from './role-assignment.entity';
import { AuthUser, GRANTED_ROLES, Role } from './roles';
import { VerifiedToken } from './token-verifier';
import { UserAccount } from './user-account.entity';

/**
 * Map tài khoản đăng nhập (IdP) ↔ nhân viên, và tính vai trò thực tế mỗi request (ADR-18):
 *   HR, ADMIN được cấp trong `iam.role_assignment`
 *   ∪ EMPLOYEE (nếu gắn với hồ sơ chưa nghỉ việc) ∪ MANAGER (nếu có cấp dưới trực tiếp, ADR-10).
 * Nhóm trong token (`realm_access.roles`, `cognito:groups`) không được dùng: nhóm trên IdP chỉ là bản sao để IdP bắt MFA
 * (AC-8.1.10). Dòng EMPLOYEE, MANAGER cũ trong database cũng bị bỏ qua vì hai vai trò này chỉ suy ra.
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
    for (const ra of await this.roleRepo.findBy({ userId: account.id })) {
      if (GRANTED_ROLES.includes(ra.role)) roles.add(ra.role);
    }
    if (account.employeeId) {
      // AC-1.7.2: người đã nghỉ việc không dùng được hệ thống, kể cả khi token cũ còn hạn.
      if ((await this.employees.placementOf(account.employeeId))?.status === 'TERMINATED') {
        throw new ForbiddenException('Tài khoản đã nghỉ việc, không còn quyền truy cập');
      }
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
