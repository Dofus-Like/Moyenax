import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SpellsService } from './spells.service';
import { CreateSpellDto } from './dto/create-spell.dto';
import type { SpellDefinition } from '@game/shared-types';

@Controller('spells')
@UseGuards(JwtAuthGuard)
export class SpellsController {
  constructor(private readonly spellsService: SpellsService) {}

  @Get()
  async findAll(): Promise<SpellDefinition[]> {
    return this.spellsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<SpellDefinition | null> {
    return this.spellsService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateSpellDto): Promise<SpellDefinition> {
    return this.spellsService.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: CreateSpellDto): Promise<SpellDefinition> {
    return this.spellsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.spellsService.remove(id);
  }
}
