import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalAuth, Public } from '../../common/decorators/public.decorator';
import { CreateShareDto } from './dto/share.dto';
import { ShareService } from './share.service';

@ApiTags('share')
@Controller('share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Post()
  @OptionalAuth()
  @Throttle(20, 60)
  @ApiOperation({ summary: '生成/获取分享卡片与短码' })
  create(@Body() dto: CreateShareDto, @CurrentUser('sub') sub?: number) {
    return this.shareService.create(dto, sub);
  }

  @Get(':code')
  @Public()
  @Throttle(60, 60)
  @ApiOperation({ summary: '解析分享短码（分享落地页数据源）' })
  resolve(@Param('code') code: string) {
    return this.shareService.resolve(code);
  }
}
