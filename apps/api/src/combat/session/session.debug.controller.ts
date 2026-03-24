import { Controller, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SessionService } from './session.service';

@Controller('combat')
@UseGuards(JwtAuthGuard)
export class SessionDebugController {
  constructor(private readonly sessionService: SessionService) {}

  @Post('test')
  async startTestCombat(@Request() req: { user: { id: string } }) {
    return this.sessionService.startTestCombat(req.user.id);
  }
}
