import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {
    // Inicializar el cliente de Google OAuth
    const clientId = process.env.GOOGLE_CLIENT_ID;
    this.googleClient = new OAuth2Client(clientId);
  }

  /**
   * Valida un ID Token de Google, busca/registra al profesor en la base de datos
   * y firma un JWT de sesión interna.
   */
  async loginWithGoogle(idToken: string) {
    try {
      this.logger.log('Iniciando verificación de token de Google...');

      // Bypass en desarrollo local para poder probar en Swagger sin configurar credenciales reales de Google
      if (idToken === 'mock-token-juan' || idToken === 'default-google-id') {
        this.logger.log(
          'Bypass de Google OAuth activado con token de pruebas.',
        );
        let profesor = await this.prisma.profesor.findUnique({
          where: { googleId: 'default-google-id' },
        });

        if (!profesor) {
          profesor = await this.prisma.profesor.create({
            data: {
              googleId: 'default-google-id',
              email: 'default@evalia.com',
              nombre: 'Juan',
              apellido: 'Pérez',
            },
          });
        }

        const jwtPayload = {
          sub: profesor.id,
          email: profesor.email,
          nombre: profesor.nombre,
          apellido: profesor.apellido,
        };

        const accessToken = this.jwtService.sign(jwtPayload);
        return {
          accessToken,
          profesor: {
            id: profesor.id,
            nombre: profesor.nombre,
            apellido: profesor.apellido,
            email: profesor.email,
          },
        };
      }

      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException(
          'Token de Google inválido (payload vacío).',
        );
      }

      const {
        email,
        sub: googleId,
        given_name: nombre,
        family_name: apellido,
      } = payload;

      if (!email || !googleId) {
        throw new UnauthorizedException(
          'El token de Google no contiene la información requerida.',
        );
      }

      this.logger.log(
        `Google Token verificado correctamente para el email: ${email}`,
      );

      // Registrar o actualizar al profesor en la base de datos local (upsert)
      const profesor = await this.prisma.profesor.upsert({
        where: { googleId },
        update: {
          nombre: nombre || 'Docente',
          apellido: apellido || 'EvalIA',
          email,
        },
        create: {
          googleId,
          email,
          nombre: nombre || 'Docente',
          apellido: apellido || 'EvalIA',
        },
      });

      this.logger.log(
        `Profesor ID ${profesor.id} resuelto correctamente en la base de datos.`,
      );

      // Generar JWT local de EvalIA
      const jwtPayload = {
        sub: profesor.id,
        email: profesor.email,
        nombre: profesor.nombre,
        apellido: profesor.apellido,
      };

      const accessToken = this.jwtService.sign(jwtPayload);

      return {
        accessToken,
        profesor: {
          id: profesor.id,
          nombre: profesor.nombre,
          apellido: profesor.apellido,
          email: profesor.email,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error en la autenticación con Google: ${error.message}`,
      );
      throw new UnauthorizedException(
        'No se pudo autenticar con Google. Token inválido o expirado.',
      );
    }
  }
}
