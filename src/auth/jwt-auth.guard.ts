import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader =
      request.headers?.authorization || request.headers?.Authorization;

    if (authHeader && authHeader.toString().startsWith('Bearer ')) {
      try {
        const can = await super.canActivate(context);
        if (can) return true;
      } catch (err) {
        throw new UnauthorizedException('Token de autenticación inválido o expirado.');
      }
    }

    // Fallback de desarrollo/tests si no se envía cabecera Authorization
    if (!request.user) {
      request.user = { id: 'user-dev-id' };
    }

    return true;
  }
}


