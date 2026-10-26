import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveBalance } from './leave-balance.entity';
import { LeaveType } from './leave-type.entity';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveType) private readonly types: Repository<LeaveType>,
    @InjectRepository(LeaveBalance) private readonly balances: Repository<LeaveBalance>,
  ) {}

  listTypes() {
    return this.types.find({ order: { code: 'ASC' } });
  }

  async balancesOf(employeeId: string, year = new Date().getFullYear()) {
    const [types, rows] = await Promise.all([
      this.types.find(),
      this.balances.find({ where: { employeeId, year } }),
    ]);
    const typeById = new Map(types.map((t) => [t.id, t]));
    return rows.map((b) => {
      const entitled = Number(b.entitled);
      const used = Number(b.used);
      const pending = Number(b.pending);
      return {
        leaveType: typeById.get(b.leaveTypeId)?.code,
        leaveTypeName: typeById.get(b.leaveTypeId)?.name,
        year: b.year,
        entitled,
        used,
        pending,
        available: entitled - used - pending,
      };
    });
  }
}
