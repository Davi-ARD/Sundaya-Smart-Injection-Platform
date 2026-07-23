import { IsString, MinLength } from 'class-validator';
import { AssignJobRequest, RejectJobRequest } from '@mold-tracker/shared';

export class AssignJobDto implements AssignJobRequest {
  @IsString()
  @MinLength(1)
  machineId: string;
}

export class RejectJobDto implements RejectJobRequest {
  @IsString()
  @MinLength(1)
  reason: string;
}
