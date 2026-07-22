import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import {
  CauseCategory,
  CreateBatchRequest,
  ReviewBatchRequest,
  ReviewStatus,
} from '@mold-tracker/shared';

export class CreateBatchDto implements CreateBatchRequest {
  @IsString()
  @MinLength(1)
  rentalId: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsNumber()
  @IsPositive()
  materialInputKg: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  targetOutput?: number;

  @IsNumber()
  @Min(0)
  actualOutput: number;

  @IsInt()
  @Min(0)
  rejectCount: number;

  @IsOptional()
  @IsEnum(CauseCategory)
  causeCategory?: CauseCategory;
}

export class ReviewBatchDto implements ReviewBatchRequest {
  // Hanya APPROVED atau REJECTED; PENDING bukan keputusan review.
  @IsIn([ReviewStatus.APPROVED, ReviewStatus.REJECTED])
  reviewStatus: ReviewStatus.APPROVED | ReviewStatus.REJECTED;
}
