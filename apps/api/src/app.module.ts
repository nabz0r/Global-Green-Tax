import { Module } from '@nestjs/common';
import { TaxModule } from './modules/tax/tax.module';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './common/prisma.module';
import { RedisModule } from './common/redis.module';

@Module({
  imports: [PrismaModule, RedisModule, AuthModule, TaxModule],
})
export class AppModule {}
