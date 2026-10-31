import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { ShelfStatus } from '../entities/bookshelf.entity';

export class SetShelfDto {
  @ApiProperty({ description: '书架状态', enum: ['want', 'reading', 'read'] })
  @IsString()
  @IsIn(['want', 'reading', 'read'])
  status: ShelfStatus;
}