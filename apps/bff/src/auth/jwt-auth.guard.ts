import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthService } from './jwt-auth.service';

/**
 * Пути, доступные без токена.
 *
 * Health обязателен: в него ходят пробы Kubernetes (readiness и liveness), а они
 * токен предъявить не могут. Всё остальное, что отдаёт BFF, требует авторизации.
 */
const PUBLIC_PATHS = new Set(['/api/health']);

interface GuardedRequest {
  path?: string;
  headers: Record<string, string | string[] | undefined>;
  user?: unknown;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtAuth: JwtAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardedRequest>();

    // req.path в Express идёт без query-строки; хвостовой слэш убираем, чтобы
    // /api/health и /api/health/ считались одним и тем же путём.
    const path = (request.path ?? '').replace(/\/+$/, '');
    if (PUBLIC_PATHS.has(path)) {
      return true;
    }

    const authHeader = request.headers['authorization'];
    const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (!header) {
      throw new UnauthorizedException(
        'Нужен заголовок Authorization: Bearer <токен Keycloak>',
      );
    }

    // JwtAuthService сам бросает UnauthorizedException с причиной отказа -
    // поэтому здесь нет try/catch, который её проглатывал бы.
    request.user = await this.jwtAuth.authenticate(header);
    return true;
  }
}
