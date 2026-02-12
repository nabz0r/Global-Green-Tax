import { Module } from '@nestjs/common';
import { TaxModule } from './modules/tax/tax.module';
import { AuthModule } from './modules/auth/auth.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { PrismaModule } from './common/prisma.module';
import { RedisModule } from './common/redis.module';

@Module({
  imports: [PrismaModule, RedisModule, AuthModule, TaxModule, SubscriptionModule],
})
export class AppModule {}
