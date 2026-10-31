import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HomeService } from './home.service';
import { RankService, type RankType } from './rank.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('home')
@Controller('home')
export class HomeController {
  constructor(
    private readonly homeService: HomeService,
    private readonly rankService: RankService,
  ) {}

  @Public()
  @Get('discover')
  @ApiOperation({ summary: '首页（发现式）聚合：Banner/每周好书/榜单/热门书评' })
  discover() {
    return this.homeService.discover();
  }

  @Public()
  @Get('rank')
  @ApiOperation({ summary: '榜单书籍（hot 热门 / new 新书 / rating 高分）' })
  rank(@Query('type') type?: string, @Query('limit') limit?: string) {
    const t: RankType = type === 'new' || type === 'rating' ? type : 'hot';
    const n = limit ? Number(limit) : undefined;
    return this.homeService.rank(t, Number.isFinite(n) ? n! : 10);
  }
}