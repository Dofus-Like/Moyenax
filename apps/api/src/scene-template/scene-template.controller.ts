import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { SaveSceneDto } from './scene-template.dto';
import { SceneTemplateService } from './scene-template.service';

type AuthedRequest = { user: { id: string } };

@Controller('scenes')
@UseGuards(JwtAuthGuard)
export class SceneTemplateController {
  constructor(private readonly service: SceneTemplateService) {}

  @Post()
  async save(@Request() req: AuthedRequest, @Body() dto: SaveSceneDto) {
    return this.service.save(req.user.id, dto.name, dto.data);
  }

  @Get()
  async list(@Request() req: AuthedRequest) {
    return this.service.list(req.user.id);
  }

  @Get(':id')
  async get(@Request() req: AuthedRequest, @Param('id') id: string) {
    return this.service.get(req.user.id, id);
  }

  @Delete(':id')
  async remove(@Request() req: AuthedRequest, @Param('id') id: string) {
    return this.service.remove(req.user.id, id);
  }
}
