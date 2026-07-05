import { Controller, Get, Param, Req } from '@nestjs/common';
import { Request } from 'express';
import { RecipesService } from './recipes.service';

function getBusinessId(req: Request): string | undefined {
  return req.headers['x-business-id'] as string | undefined;
}

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.recipes.findAll(getBusinessId(req) ?? '');
  }

  @Get('product/:productId')
  findByProduct(@Param('productId') productId: string) {
    return this.recipes.findByProduct(productId);
  }

  @Get('available/:productId')
  async getAvailablePortions(@Param('productId') productId: string) {
    const portions = await this.recipes.calculateAvailablePortions(productId);
    return { product_id: productId, available_portions: portions };
  }
}
