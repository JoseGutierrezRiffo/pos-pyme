import { Injectable, NotFoundException, Inject, BadRequestException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../common/supabase.module';

export interface Ingredient {
  id: string;
  business_id: string;
  name: string;
  unit: string;
  stock: number;
  min_stock: number;
  cost_per_unit: number;
  is_active: boolean;
}

export interface Recipe {
  id: string;
  business_id: string;
  product_id: string;
  name: string;
  servings: number;
}

export interface RecipeWithDetails extends Recipe {
  product_name: string;
  ingredients: Array<{
    ingredient_id: string;
    ingredient_name: string;
    unit: string;
    quantity: number;
  }>;
  available_portions: number;
}

@Injectable()
export class IngredientsService {
  constructor(@Inject(SUPABASE_ADMIN) private readonly admin: SupabaseClient) {}

  async findAll(businessId: string) {
    const { data, error } = await this.admin
      .from('ingredients')
      .select('*')
      .eq('business_id', businessId)
      .order('name');

    if (error) throw error;
    return data ?? [];
  }

  async findLowStock(businessId: string) {
    const { data, error } = await this.admin
      .from('ingredients')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    // Filtrar ingredientes donde stock < min_stock
    return (data ?? []).filter((i) => Number(i.stock) < Number(i.min_stock));
  }

  async findOne(id: string) {
    const { data, error } = await this.admin.from('ingredients').select('*').eq('id', id).single();

    if (error || !data) throw new NotFoundException('Ingredient not found');
    return data;
  }

  async create(businessId: string, dto: Partial<Ingredient>) {
    const { data, error } = await this.admin
      .from('ingredients')
      .insert({ ...dto, business_id: businessId })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, dto: Partial<Ingredient>) {
    const { data, error } = await this.admin
      .from('ingredients')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Ingredient not found');
    return data;
  }

  async remove(id: string) {
    // Soft delete
    const { error } = await this.admin
      .from('ingredients')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return { id, deleted: true };
  }

  /**
   * Calcular stock disponible de cada producto basado en recetas.
   */
  async calculateProductStock(businessId: string) {
    const { data: products, error: prodErr } = await this.admin
      .from('products')
      .select('id, name, sku, sale_price, business_id')
      .eq('business_id', businessId)
      .eq('is_active', true);

    if (prodErr) throw prodErr;

    const result: Array<{
      product_id: string;
      name: string;
      sku: string;
      sale_price: number;
      available_portions: number | null;
    }> = [];

    for (const product of products ?? []) {
      // Buscar la receta asociada
      const { data: recipes } = await this.admin
        .from('recipes')
        .select('id')
        .eq('product_id', product.id)
        .eq('is_active', true)
        .limit(1);

      let available: number | null = null;

      if (recipes && recipes.length > 0) {
        const firstRecipe = recipes[0];
        if (!firstRecipe) continue;
        const recipeId = firstRecipe.id;

        // Calcular mínimo disponible (mínimo de cada ingrediente)
        const { data: ri } = await this.admin
          .from('recipe_ingredients')
          .select('quantity, ingredient:ingredients(stock)')
          .eq('recipe_id', recipeId);

        if (ri && ri.length > 0) {
          const portions = ri
            .map((r: any) => {
              const stock = Number(r.ingredient?.stock ?? 0);
              const qty = Number(r.quantity ?? 1);
              return qty > 0 ? stock / qty : 0;
            })
            .filter((n) => Number.isFinite(n));

          available = portions.length > 0 ? Math.floor(Math.min(...portions)) : 0;
        }
      }

      result.push({
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        sale_price: product.sale_price,
        available_portions: available,
      });
    }

    return result;
  }
}
