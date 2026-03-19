import { Module } from '@nestjs/common';
import { SessionModule } from './session/session.module';
import { TurnModule } from './turn/turn.module';
import { SpellsModule } from './spells/spells.module';
import { MapModule } from './map/map.module';
import { SpellResolverService } from './spell-resolver.service';

@Module({
  imports: [SessionModule, TurnModule, SpellsModule, MapModule],
  providers: [SpellResolverService],
  exports: [SessionModule, TurnModule, SpellsModule, MapModule, SpellResolverService],
})
export class CombatModule {}

