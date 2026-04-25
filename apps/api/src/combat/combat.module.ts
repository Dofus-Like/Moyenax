import { Module } from '@nestjs/common';

import { BotModule } from './bot/bot.module';
import { MapModule } from './map/map.module';
import { SessionModule } from './session/session.module';
import { SpellsModule } from './spells/spells.module';
import { TurnModule } from './turn/turn.module';

@Module({
  imports: [SessionModule, TurnModule, SpellsModule, MapModule, BotModule],
  exports: [SessionModule, TurnModule, SpellsModule, MapModule, BotModule],
})
export class CombatModule {}
