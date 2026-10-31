import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminArea } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EventService } from './event.service';
import {
  CreateEventDto,
  EventQueryDto,
  UpdateEventDto,
  UpdateEventStatusDto,
} from './dto/event.dto';

@ApiTags('admin-events')
@ApiBearerAuth('access-token')
@AdminArea()
@UseGuards(AdminGuard)
@Controller('admin/events')
export class EventAdminController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  @ApiOperation({ summary: '活动列表（含草稿）' })
  list(@Query() query: EventQueryDto) {
    return this.eventService.listAdmin(query);
  }

  @Post()
  @ApiOperation({ summary: '创建活动' })
  create(@Body() dto: CreateEventDto, @CurrentUser('sub') sub: number) {
    return this.eventService.create(dto, sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新活动' })
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '活动状态流转（发布/结束/取消）' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateEventStatusDto) {
    return this.eventService.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除活动' })
  remove(@Param('id') id: string) {
    return this.eventService.remove(id);
  }
}
