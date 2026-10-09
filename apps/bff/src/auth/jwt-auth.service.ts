import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import JwksClient from 'jwks-rsa';

export interface JwtPayload {
  sub?: string;
  preferred_username?: string;
  email?: string;
  realm_access?: { roles?: string[] };
  [key: string]: unknown;
}

/**
 * Проверка access-токенов Keycloak по JWKS.
 *
 * Секрет клиента здесь не нужен: BFF только удостоверяется, что токен подписан
 * нашим Keycloak (по публичным ключам) и выдан для нашего realm (проверка iss).
 */
@Injectable()
export class JwtAuthService {
  private readonly logger = new Logger(JwtAuthService.name);
  private readonly issuer: string;
  private readonly jwksClient: ReturnType<typeof JwksClient>;

  constructor(private readonly nestJwt: NestJwtService) {
    const issuer = (process.env.KC_ISSUER ?? '').replace(/\/+$/, '');
    if (!issuer) {
      // Падаем на старте, а не на первом запросе: без issuer проверить токен
      // невозможно, и отдавать 401 на всё - хуже, чем не подняться вовсе.
      throw new Error(
        'KC_ISSUER не задан: BFF не сможет проверять токены Keycloak',
      );
    }
    this.issuer = issuer;
    // Issuer проверяем внешний (как его видят браузер и Keycloak), а ключи при
    // необходимости берём по отдельному адресу: после перехода стенда на https
    // внешний JWKS отдаётся с самоподписанным сертификатом, который Node не
    // примет. Внутрикластерный http-адрес этой проблемы не имеет, а доверие
    // токену всё равно обеспечивает проверка подписи и iss.
    const jwksUri = (
      process.env.KC_JWKS_URI ?? `${issuer}/protocol/openid-connect/certs`
    ).replace(/\/+$/, '');
    this.logger.log(`Проверка токенов: issuer=${issuer}, jwks=${jwksUri}`);
    this.jwksClient = JwksClient({ rateLimit: true, cache: true, jwksUri });
  }

  async authenticate(authorization: string): Promise<JwtPayload> {
    const [scheme, token] = authorization.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException(
        'Ожидается заголовок вида Authorization: Bearer <токен>',
      );
    }
    return this.verify(token);
  }

  private async verify(token: string): Promise<JwtPayload> {
    const decoded = this.nestJwt.decode(token, { complete: true }) as {
      header?: { kid?: string };
    } | null;
    const kid = decoded?.header?.kid;
    if (!kid) {
      throw new UnauthorizedException('В токене нет kid - не выбрать ключ');
    }

    const key = await this.getKey(kid);
    try {
      return this.nestJwt.verify(token, {
        publicKey: key,
        // Алгоритм фиксирован: брать его из заголовка токена нельзя, иначе
        // токен сам решает, чем его проверять.
        algorithms: ['RS256'],
        // Проверяем, что токен выдан именно нашим realm, а не соседним.
        issuer: this.issuer,
      }) as JwtPayload;
    } catch (error) {
      throw new UnauthorizedException(
        `Токен не прошёл проверку: ${(error as Error).message}`,
      );
    }
  }

  private async getKey(kid: string): Promise<string> {
    try {
      const signingKey = await this.jwksClient.getSigningKey(kid);
      return signingKey.getPublicKey();
    } catch (error) {
      this.logger.error(
        `Не получил ключ ${kid} из JWKS: ${(error as Error).message}`,
      );
      throw new UnauthorizedException('Не удалось получить публичный ключ');
    }
  }
}
