import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export type SubscriptionPaymentPlatform = 'web' | 'mobile';

export class CreatePaymentDto {
  @ApiProperty({ enum: ['web', 'mobile'] })
  @IsIn(['web', 'mobile'])
  platform: SubscriptionPaymentPlatform;
}
