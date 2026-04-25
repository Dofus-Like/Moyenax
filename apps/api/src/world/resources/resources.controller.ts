import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

import { ResourcesService } from './resources.service';

@Controller('map/resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  async findAll() {
    return this.resourcesService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/gather')
  async gather(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.resourcesService.gather(id, req.user.id);
  }
}
