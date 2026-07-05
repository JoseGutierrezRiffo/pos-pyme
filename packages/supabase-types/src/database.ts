/**
 * Tipos de Supabase — refleja el schema después de las migraciones 0001..0007.
 *
 * Esta es una versión manual alineada con `supabase/migrations/*.sql`.
 * Regenerar con `pnpm gen:types` cuando se tenga acceso a SUPABASE_PROJECT_ID.
 *
 * Cambios respecto a 0001:
 * - 0005/0006: multi-tenant → tablas businesses, business_members + business_id en products/shifts/sales + products.is_global
 * - 0006: shifts renombradas:
 *     initial_cash       → cash_initial
 *     total_withdrawals  → cash_withdrawals
 *     final_cash         → cash_declared
 *     expected_cash      → cash_expected
 *     started_at         → opened_at
 *     ended_at           → closed_at
 *     status             → shift_status   (valores: 'open' | 'break' | 'cerrado' | 'closed')
 * - 0006: sales:
 *     + cash_amount, card_amount, transfer_amount, business_id
 *     - payment_method, subtotal
 * - 0006: sale_items:
 *     unit_price  → price_at_sale
 *     unit_cost   → cost_at_sale
 *     subtotal    → line_total
 *     - product_name, subtotal
 * - 0007: ingredients, recipes, recipe_ingredients
 */

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: 'admin' | 'worker';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']>;
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      products: {
        Row: {
          id: string;
          sku: string;
          name: string;
          description: string | null;
          cost_price: number;
          sale_price: number;
          stock: number;
          min_stock: number;
          is_active: boolean;
          business_id: string | null;
          is_global: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['products']['Row']>;
        Update: Partial<Database['public']['Tables']['products']['Row']>;
      };
      shifts: {
        Row: {
          id: string;
          user_id: string;
          business_id: string | null;
          shift_date: string;
          shift_status: 'open' | 'break' | 'cerrado' | 'closed';
          opened_at: string;
          closed_at: string | null;
          cash_initial: number;
          cash_declared: number | null;
          cash_expected: number | null;
          cash_withdrawals: number;
          discrepancy: number | null;
          break_started_at: string | null;
          break_ended_at: string | null;
          total_sales: number;
          total_cash_sales: number;
          total_card_sales: number;
          total_transfer_sales: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['shifts']['Row']>;
        Update: Partial<Database['public']['Tables']['shifts']['Row']>;
      };
      sales: {
        Row: {
          id: string;
          shift_id: string;
          user_id: string;
          business_id: string | null;
          cash_amount: number;
          card_amount: number;
          transfer_amount: number;
          total: number;
          items_count: number;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['sales']['Row']>;
        Update: Partial<Database['public']['Tables']['sales']['Row']>;
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string;
          quantity: number;
          price_at_sale: number;
          cost_at_sale: number;
          line_total: number;
        };
        Insert: Partial<Database['public']['Tables']['sale_items']['Row']>;
        Update: Partial<Database['public']['Tables']['sale_items']['Row']>;
      };
      cash_withdrawals: {
        Row: {
          id: string;
          shift_id: string;
          user_id: string;
          amount: number;
          reason: 'compra_insumos' | 'gasto_operativo' | 'pago_proveedor' | 'otro';
          note: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['cash_withdrawals']['Row']>;
        Update: Partial<Database['public']['Tables']['cash_withdrawals']['Row']>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          payload: Json;
          is_read: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['notifications']['Row']>;
        Update: Partial<Database['public']['Tables']['notifications']['Row']>;
      };
      businesses: {
        Row: {
          id: string;
          name: string;
          slug: string;
          rut: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['businesses']['Row']>;
        Update: Partial<Database['public']['Tables']['businesses']['Row']>;
      };
      business_members: {
        Row: {
          id: string;
          business_id: string;
          user_id: string;
          role: 'owner' | 'admin' | 'worker';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['business_members']['Row']>;
        Update: Partial<Database['public']['Tables']['business_members']['Row']>;
      };
      ingredients: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          unit: string;
          stock: number;
          min_stock: number;
          cost_per_unit: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['ingredients']['Row']>;
        Update: Partial<Database['public']['Tables']['ingredients']['Row']>;
      };
      recipes: {
        Row: {
          id: string;
          business_id: string;
          product_id: string | null;
          name: string;
          servings: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['recipes']['Row']>;
        Update: Partial<Database['public']['Tables']['recipes']['Row']>;
      };
      recipe_ingredients: {
        Row: {
          id: string;
          recipe_id: string;
          ingredient_id: string;
          quantity: number;
        };
        Insert: Partial<Database['public']['Tables']['recipe_ingredients']['Row']>;
        Update: Partial<Database['public']['Tables']['recipe_ingredients']['Row']>;
      };
    };
    Views: {
      products_public: {
        Row: {
          id: string;
          sku: string;
          name: string;
          description: string | null;
          sale_price: number;
          stock: number;
          min_stock: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
    };
    Functions: {
      current_user_role: { Args: Record<string, never>; Returns: 'admin' | 'worker' };
      get_user_businesses: { Args: { user_uuid: string }; Returns: string[] };
      get_user_role_in_business: {
        Args: { user_uuid: string; business_uuid: string };
        Returns: 'owner' | 'admin' | 'worker';
      };
      user_has_business_access: {
        Args: { user_uuid: string; business_uuid: string };
        Returns: boolean;
      };
      check_low_stock: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: {
      user_role: 'admin' | 'worker';
      shift_status: 'open' | 'break' | 'cerrado' | 'closed';
      payment_method: 'efectivo' | 'transferencia' | 'tarjeta';
      withdrawal_reason: 'compra_insumos' | 'gasto_operativo' | 'pago_proveedor' | 'otro';
      membership_role: 'owner' | 'admin' | 'worker';
    };
  };
}
