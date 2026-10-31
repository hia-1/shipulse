import { Injectable } from '@nestjs/common';

@Injectable()
export class CommunityService {
  ping() {
    return { module: 'community', status: 'skeleton' };
  }
}
