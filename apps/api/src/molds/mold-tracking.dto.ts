import { IsEnum } from 'class-validator';
import { MoldTrackingStatus, UpdateMoldTrackingRequest } from '@mold-tracker/shared';

export class UpdateMoldTrackingDto implements UpdateMoldTrackingRequest {
  @IsEnum(MoldTrackingStatus)
  status: MoldTrackingStatus;
}
