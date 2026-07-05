import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateProductDto, UpdateProductDto } from '@pos-pyme/validation';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  /** Cualquier usuario autenticado puede buscar y listar (sin cost_price) */
  @Get()
  @Roles('admin', 'worker')
  list() {
    return this.products.findAllPublic();
  }

  /** Productos con stock bajo — para alertas en el dashboard */
  @Get('low-stock')
  @Roles('admin', 'worker')
  lowStock() {
    return this.products.findLowStock();
  }

  @Get('search')
  @Roles('admin', 'worker')
  search(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.products.search(q ?? '', undefined, limit ? Number(limit) : 20);
  }

  @Get(':id')
  @Roles('admin', 'worker')
  getOne(@Param('id') id: string) {
    return this.products.findOne(id);
  }

  /** Endpoints exclusivos para admin */
  @Get('admin/full')
  @Roles('admin')
  listWithCosts() {
    return this.products.findAllWithCosts();
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.products.remove(id);
  }
}
