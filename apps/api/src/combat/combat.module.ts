import { Module } from '@nestjs/common';
import { SessionModule } from './session/session.module';
import { TurnModule } from './turn/turn.module';
import { SpellsModule } from './spells/spells.module';
import { MapModule } from './map/map.module';

@Module({
  imports: [SessionModule, TurnModule, SpellsModule, MapModule],
  exports: [SessionModule, TurnModule, SpellsModule, MapModule],
})
export class CombatModule {}
