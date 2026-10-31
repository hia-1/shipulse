import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { EventService } from './event.service';
import { EventQueryDto } from './dto/event.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalAuth } from '../../common/decorators/public.decorator';

@ApiTags('events')
@ApiBearerAuth('access-token')
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @OptionalAuth()
  @Get()
  @ApiOperation({ summary: '活动列表（仅非草稿；登录返回是否已报名）' })
  list(@Query() query: EventQueryDto, @CurrentUser('sub') userId?: number) {
    return this.eventService.listPublic(query, userId);
  }

  @Get('mine')
  @ApiOperation({ summary: '我的活动报名' })
  mine(
    @CurrentUser('sub') userId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.eventService.mySignups(
      userId,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 10,
    );
  }

  @OptionalAuth()
  @Get(':id')
  @ApiOperation({ summary: '活动详情' })
  detail(@Param('id') id: string, @CurrentUser('sub') userId?: number) {
    return this.eventService.detail(id, userId);
  }

  @Post(':id/signup')
  @Throttle(10, 60)
  @ApiOperation({ summary: '报名活动（会员专属需会员身份）' })
  signup(@CurrentUser('sub') userId: number, @Param('id') id: string) {
    return this.eventService.signup(userId, id);
  }

  @Delete(':id/signup')
  @Throttle(10, 60)
  @ApiOperation({ summary: '取消报名' })
  cancel(@CurrentUser('sub') userId: number, @Param('id') id: string) {
    return this.eventService.cancelSignup(userId, id);
  }
}
