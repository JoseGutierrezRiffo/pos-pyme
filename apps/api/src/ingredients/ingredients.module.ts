import { Module } from '@nestjs/common';
import { IngredientsController } from './ingredients.controller';
import { IngredientsService } from './ingredients.service';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

@Module({
  controllers: [IngredientsController, RecipesController],
  providers: [IngredientsService, RecipesService],
  exports: [IngredientsService, RecipesService],
})
export class IngredientsModule {}
