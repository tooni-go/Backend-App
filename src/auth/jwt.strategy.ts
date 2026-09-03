import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-key-evalia',
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const profesor = await this.prisma.profesor.findUnique({
      where: { id: payload.sub },
    });

    if (!profesor) {
      throw new UnauthorizedException(
        'El profesor asociado a este token ya no existe.',
      );
    }

    return profesor; // Se inyecta automáticamente en req.user
  }
}
