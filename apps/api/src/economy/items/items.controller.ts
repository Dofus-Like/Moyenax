import { Controller, Get, Param } from '@nestjs/common';

import { ItemsService } from './items.service';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  async findAll() {
    return this.itemsService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.itemsService.findById(id);
  }
}
