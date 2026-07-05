import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, Reflector } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { ShiftsModule } from './shifts/shifts.module';
import { SalesModule } from './sales/sales.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StockMovementsModule } from './stock-movements/stock-movements.module';
import { SupabaseModule } from './common/supabase.module';
import { EmailModule } from './common/email.module';
import { BusinessesModule } from './businesses/businesses.module';
import { IngredientsModule } from './ingredients/ingredients.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    SupabaseModule,
    EmailModule,
    AuthModule,
    BusinessesModule,
    ProductsModule,
    ShiftsModule,
    SalesModule,
    NotificationsModule,
    StockMovementsModule,
    IngredientsModule,
  ],
  providers: [
    // Guards globales con DI correcta via APP_GUARD
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Filtro global de excepciones
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
