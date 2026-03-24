import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = typeof req.user?.id === 'string' ? req.user.id : null;
    if (userId) {
      return `user:${userId}`;
    }

    const ip =
      (Array.isArray(req.ips) && typeof req.ips[0] === 'string' && req.ips[0]) ||
      (typeof req.ip === 'string' && req.ip) ||
      (typeof req.socket?.remoteAddress === 'string' && req.socket.remoteAddress) ||
      'anonymous';

    return `ip:${ip}`;
  }
}
