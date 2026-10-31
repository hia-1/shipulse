import { Injectable } from '@nestjs/common';

@Injectable()
export class LibraryService {
  ping() {
    return { module: 'library', status: 'skeleton' };
  }
}
