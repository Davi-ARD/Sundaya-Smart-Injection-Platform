import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { ProductionBatch, Role } from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { ReportsService } from './reports.service';

@Roles(Role.PENYEWA, Role.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('machine-issues')
  machineIssues(
    @CurrentUser() user: PrismaUser,
    @Query('rentalId') rentalId?: string,
    @Query('machineId') machineId?: string,
  ): Promise<ProductionBatch[]> {
    return this.reports.machineIssues(user, { rentalId, machineId });
  }

  @Get('machine-issues/export')
  async export(
    @CurrentUser() user: PrismaUser,
    @Query('format') format?: string,
    @Query('rentalId') rentalId?: string,
    @Query('machineId') machineId?: string,
  ): Promise<StreamableFile> {
    const result = await this.reports.exportMachineIssues(
      user,
      { rentalId, machineId },
      format === 'pdf' ? 'pdf' : 'csv',
    );
    const buffer =
      typeof result.buffer === 'string' ? Buffer.from(result.buffer, 'utf-8') : result.buffer;
    return new StreamableFile(buffer, {
      type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }
}
