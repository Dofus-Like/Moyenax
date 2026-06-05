import { Module } from '@nestjs/common';

import { PrismaModule } from '../shared/prisma/prisma.module';

import { SceneTemplateController } from './scene-template.controller';
import { SceneTemplateService } from './scene-template.service';

@Module({
  imports: [PrismaModule],
  providers: [SceneTemplateService],
  controllers: [SceneTemplateController],
})
export class SceneTemplateModule {}
