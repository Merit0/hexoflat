import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ContentService } from './content.service';

@Controller('content')
export class ContentController {
  // tsx/esbuild doesn't emit TS `design:paramtypes` metadata, so Nest can't
  // infer constructor injection by type alone — @Inject() gives it an
  // explicit token instead.
  constructor(@Inject(ContentService) private readonly contentService: ContentService) {}

  @Get()
  list() {
    return this.contentService.listKeys();
  }

  @Get(':key')
  getOne(@Param('key') key: string) {
    return this.contentService.getByKey(key);
  }
}
