import { Module } from '@nestjs/common';
import { SessionModule } from './session/session.module';
import { TurnModule } from './turn/turn.module';
import { SpellsModule } from './spells/spells.module';
import { MapModule } from './map/map.module';
import { SpellResolverService } from './spell-resolver.service';
import { BotModule } from './bot/bot.module';

@Module({
  imports: [SessionModule, TurnModule, SpellsModule, MapModule, BotModule],
  providers: [SpellResolverService],
  exports: [SessionModule, TurnModule, SpellsModule, MapModule, SpellResolverService, BotModule],
})
export class CombatModule {}

