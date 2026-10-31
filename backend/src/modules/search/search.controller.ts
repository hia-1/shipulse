import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { SearchService } from './search.service';
import { SuggestService } from './suggest.service';
import { RecordSearchDto, SuggestQueryDto } from './dto';

/** 搜索聚合：联想 / 热搜 / 记录（P1-03） */
@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly suggestService: SuggestService,
  ) {}

  @Public()
  @Get('suggest')
  @ApiOperation({ summary: '搜索联想 + ISBN 精确命中' })
  suggest(@Query() query: SuggestQueryDto) {
    return this.suggestService.suggest(query.keyword ?? '', query.limit ?? 8);
  }

  @Public()
  @Get('hot')
  @ApiOperation({ summary: '热搜词（Redis 维护）' })
  hot(@Query('limit') limit?: string) {
    const n = limit ? Number(limit) : 10;
    return this.searchService.hot(Number.isFinite(n) ? n : 10);
  }

  @Public()
  @Throttle(20, 60)
  @Post('record')
  @ApiOperation({ summary: '记录一次搜索（热词自增）' })
  record(@Body() dto: RecordSearchDto) {
    // fire-and-forget，不阻塞搜索行为
    void this.searchService.record(dto.keyword);
    return { ok: true };
  }
}