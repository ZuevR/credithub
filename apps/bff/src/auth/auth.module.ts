import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthService } from './jwt-auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    JwtModule.register({
      // Секрет не нужен — мы проверяем JWT по JWKS, а не подписываем свои токены.
      // Но Nest требует хотя бы одну опцию.
      global: true,
    }),
  ],
  providers: [JwtAuthService, JwtAuthGuard],
  exports: [JwtAuthService, JwtAuthGuard],
})
export class AuthModule {}
