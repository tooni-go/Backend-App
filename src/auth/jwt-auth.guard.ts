import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // TEMPORAL: Bypassing auth for frontend development MVP.
    // Inyectamos un usuario por defecto en el request
    const request = context.switchToHttp().getRequest();
    request.user = { id: 'user-dev-id' }; 
    return true;
  }
}
