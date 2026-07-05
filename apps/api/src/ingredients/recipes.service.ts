import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../common/supabase.module';

@Injectable()
export class RecipesService {
  constructor(@Inject(SUPABASE_ADMIN) private readonly admin: SupabaseClient) {}

  /**
   * Listar todas las recetas de un negocio.
   */
  async findAll(businessId: string) {
    const { data, error } = await this.admin
      .from('recipes')
      .select(
        `
        *,
        product:products!recipes_product_id_fkey(name, sku, sale_price),
        ingredients:recipe_ingredients(
          quantity,
          ingredient:ingredients(id, name, unit, stock)
        )
      `,
      )
      .eq('business_id', businessId)
      .order('name');

    if (error) throw error;
    return data ?? [];
  }

  /**
   * Obtener la receta activa para un producto (1:1)
   */
  async findByProduct(productId: string) {
    const { data, error } = await this.admin
      .from('recipes')
      .select(
        `
        *,
        ingredients:recipe_ingredients(
          quantity,
          ingredient:ingredients(id, name, unit)
        )
      `,
      )
      .eq('product_id', productId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Calcular porciones disponibles para un producto específico.
   */
  async calculateAvailablePortions(productId: string): Promise<number> {
    const recipe = await this.findByProduct(productId);
    if (!recipe) return 0;

    // Get the actual numeric values
    const ingredients = (recipe.ingredients ?? []) as Array<{
      quantity: number;
      ingredient: { id: string; name: string; unit: string; stock: number } | null;
    }>;

    if (ingredients.length === 0) return 0;

    // Get fresh stock values
    const ingredientIds = ingredients.map((i) => i.ingredient?.id).filter(Boolean) as string[];
    const { data: stockData } = await this.admin
      .from('ingredients')
      .select('id, stock')
      .in('id', ingredientIds);

    const stockMap = new Map((stockData ?? []).map((s: any) => [s.id, Number(s.stock)]));

    const portions = ingredients
      .map((i) => {
        const stock = stockMap.get(i.ingredient?.id ?? '') ?? 0;
        const qty = Number(i.quantity || 1);
        return qty > 0 ? stock / qty : 0;
      })
      .filter((n) => Number.isFinite(n));

    return portions.length > 0 ? Math.floor(Math.min(...portions)) : 0;
  }
}
