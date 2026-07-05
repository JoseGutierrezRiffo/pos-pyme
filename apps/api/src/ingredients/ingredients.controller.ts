import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { IngredientsService } from './ingredients.service';

function getBusinessId(req: Request): string | undefined {
  return req.headers['x-business-id'] as string | undefined;
}

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredients: IngredientsService) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.ingredients.findAll(getBusinessId(req) ?? '');
  }

  @Get('low-stock')
  findLowStock(@Req() req: Request) {
    return this.ingredients.findLowStock(getBusinessId(req) ?? '');
  }

  @Get('low-stock-products')
  async findLowStockProducts(@Req() req: Request) {
    const stockList = await this.ingredients.calculateProductStock(getBusinessId(req) ?? '');
    // Filtrar solo los que tienen stock bajo (entre 1 y 5) o agotados
    return stockList
      .filter((p) => {
        const stock = p.available_portions ?? 0;
        return stock <= 5;
      })
      .map((p) => ({
        ...p,
        is_critical: (p.available_portions ?? 0) === 0,
      }));
  }

  @Get('product-stock')
  getProductStock(@Req() req: Request) {
    return this.ingredients.calculateProductStock(getBusinessId(req) ?? '');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ingredients.findOne(id);
  }

  @Post()
  create(@Body() dto: any, @Req() req: Request) {
    return this.ingredients.create(getBusinessId(req) ?? '', dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.ingredients.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ingredients.remove(id);
  }
}
