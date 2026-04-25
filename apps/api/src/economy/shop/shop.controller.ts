import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

import { BuyItemDto } from './dto/buy-item.dto';
import { SellItemDto } from './dto/sell-item.dto';
import { ShopService } from './shop.service';

@Controller('shop')
@UseGuards(JwtAuthGuard)
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get('items')
  async getAvailableItems() {
    return this.shopService.getAvailableItems();
  }

  @Post('buy')
  async buy(@Body() dto: BuyItemDto, @Request() req: { user: { id: string } }) {
    return this.shopService.buy(req.user.id, dto.itemId, dto.quantity);
  }

  @Post('sell')
  async sell(@Body() dto: SellItemDto, @Request() req: { user: { id: string } }) {
    return this.shopService.sell(req.user.id, dto.inventoryItemId, dto.quantity);
  }
}
