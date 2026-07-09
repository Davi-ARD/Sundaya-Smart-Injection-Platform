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
    const batches = await this.reports.machineIssues(user, { rentalId, machineId });
    if (format === 'pdf') {
      return new StreamableFile(await this.reports.pdfBuffer(batches), {
        type: 'application/pdf',
        disposition: 'attachment; filename="machine-issues.pdf"',
      });
    }
    return new StreamableFile(Buffer.from(this.reports.toCsv(batches), 'utf-8'), {
      type: 'text/csv',
      disposition: 'attachment; filename="machine-issues.csv"',
    });
  }
}
