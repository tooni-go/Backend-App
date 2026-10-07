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

  async validate(payload: any) {
    if (!payload) {
      throw new UnauthorizedException('Payload del token inválido.');
    }

    const sub = payload.sub || payload.id;
    const email = payload.email;

    // 1. Buscar por id (UUID de EvalIA)
    let profesor = sub
      ? await this.prisma.profesor.findUnique({ where: { id: sub } })
      : null;

    // 2. Buscar por googleId
    if (!profesor && sub) {
      profesor = await this.prisma.profesor.findUnique({
        where: { googleId: sub },
      });
    }

    // 3. Buscar por email
    if (!profesor && email) {
      profesor = await this.prisma.profesor.findUnique({
        where: { email },
      });
    }

    // 4. Si el profesor no existe en la BD pero el token es válido, crearlo automáticamente
    if (!profesor && (sub || email)) {
      const googleId = sub || `google-${Date.now()}`;
      const teacherEmail = email || `${googleId}@evalia.com`;
      const nombre =
        payload.nombre || payload.given_name || payload.name || 'Docente';
      const apellido =
        payload.apellido || payload.family_name || 'EvalIA';

      profesor = await this.prisma.profesor.upsert({
        where: { email: teacherEmail },
        update: {
          nombre,
          apellido,
        },
        create: {
          googleId,
          email: teacherEmail,
          nombre,
          apellido,
        },
      });
    }

    if (!profesor) {
      throw new UnauthorizedException(
        'No se pudo resolver el profesor para la sesión actual.',
      );
    }

    return profesor; // Inyectado en req.user con el id real de la BD garantizado
  }
}
