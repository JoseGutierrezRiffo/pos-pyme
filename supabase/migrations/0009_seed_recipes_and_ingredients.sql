-- ====================================================================
-- SEED 0001 — Recetas + ingredientes para flujo de ventas POS
--
-- Pobla ingredientes y recetas para que `available_portions` deje de ser null
-- y el POS pueda vender. Idempotente: corre múltiples veces sin duplicar.
--
-- Productos objetivo: BEB-003 (Agua Mineral), DUL-001 (Chocolate), SNK-001 (Papas)
-- ====================================================================

-- 1. Ingredientes (materias primas)
DO $$
DECLARE
  v_biz uuid := '00000000-0000-0000-0000-000000000001';
  v_agua    uuid;
  v_choc    uuid;
  v_papa    uuid;
  v_sal     uuid;
  v_aceite  uuid;
  v_beb003  uuid;
  v_dul001  uuid;
  v_snk001  uuid;
  v_recipe  uuid;
BEGIN
  -- Buscar business_id del producto para asegurar consistencia
  SELECT id INTO v_beb003 FROM public.products WHERE sku = 'BEB-003' AND business_id = v_biz LIMIT 1;
  SELECT id INTO v_dul001 FROM public.products WHERE sku = 'DUL-001' AND business_id = v_biz LIMIT 1;
  SELECT id INTO v_snk001 FROM public.products WHERE sku = 'SNK-001' AND business_id = v_biz LIMIT 1;

  IF v_beb003 IS NULL THEN
    RAISE EXCEPTION 'Producto BEB-003 no existe en el business. Aplicar primero 0001_initial_schema.sql y crear productos seed.';
  END IF;

  -- Ingredientes (idempotente: actualiza si existe, inserta si no)
  SELECT id INTO v_agua FROM public.ingredients WHERE name = 'Agua' AND business_id = v_biz LIMIT 1;
  IF v_agua IS NULL THEN
    INSERT INTO public.ingredients (business_id, name, unit, stock, min_stock, cost_per_unit)
    VALUES (v_biz, 'Agua', 'lt', 100, 10, 500)
    RETURNING id INTO v_agua;
  ELSE
    UPDATE public.ingredients SET stock = 100, min_stock = 10, cost_per_unit = 500, unit = 'lt' WHERE id = v_agua;
  END IF;

  SELECT id INTO v_choc FROM public.ingredients WHERE name = 'Chocolate' AND business_id = v_biz LIMIT 1;
  IF v_choc IS NULL THEN
    INSERT INTO public.ingredients (business_id, name, unit, stock, min_stock, cost_per_unit)
    VALUES (v_biz, 'Chocolate', 'kg', 10, 2, 8000)
    RETURNING id INTO v_choc;
  ELSE
    UPDATE public.ingredients SET stock = 10, min_stock = 2, cost_per_unit = 8000, unit = 'kg' WHERE id = v_choc;
  END IF;

  SELECT id INTO v_papa FROM public.ingredients WHERE name = 'Papas' AND business_id = v_biz LIMIT 1;
  IF v_papa IS NULL THEN
    INSERT INTO public.ingredients (business_id, name, unit, stock, min_stock, cost_per_unit)
    VALUES (v_biz, 'Papas', 'kg', 5, 1, 3000)
    RETURNING id INTO v_papa;
  ELSE
    UPDATE public.ingredients SET stock = 5, min_stock = 1, cost_per_unit = 3000, unit = 'kg' WHERE id = v_papa;
  END IF;

  SELECT id INTO v_sal FROM public.ingredients WHERE name = 'Sal' AND business_id = v_biz LIMIT 1;
  IF v_sal IS NULL THEN
    INSERT INTO public.ingredients (business_id, name, unit, stock, min_stock, cost_per_unit)
    VALUES (v_biz, 'Sal', 'kg', 2, 0.5, 1000)
    RETURNING id INTO v_sal;
  ELSE
    UPDATE public.ingredients SET stock = 2, min_stock = 0.5, cost_per_unit = 1000, unit = 'kg' WHERE id = v_sal;
  END IF;

  SELECT id INTO v_aceite FROM public.ingredients WHERE name = 'Aceite' AND business_id = v_biz LIMIT 1;
  IF v_aceite IS NULL THEN
    INSERT INTO public.ingredients (business_id, name, unit, stock, min_stock, cost_per_unit)
    VALUES (v_biz, 'Aceite', 'lt', 3, 0.5, 5000)
    RETURNING id INTO v_aceite;
  ELSE
    UPDATE public.ingredients SET stock = 3, min_stock = 0.5, cost_per_unit = 5000, unit = 'lt' WHERE id = v_aceite;
  END IF;

  -- Recetas
  -- BEB-003 Agua Mineral: 0.5 lt de agua
  SELECT id INTO v_recipe FROM public.recipes WHERE product_id = v_beb003 AND business_id = v_biz LIMIT 1;
  IF v_recipe IS NULL THEN
    INSERT INTO public.recipes (business_id, product_id, name, servings, is_active)
    VALUES (v_biz, v_beb003, 'Receta Agua Mineral', 1, true)
    RETURNING id INTO v_recipe;
  END IF;
  -- Recreate recipe_ingredients
  DELETE FROM public.recipe_ingredients WHERE recipe_id = v_recipe;
  INSERT INTO public.recipe_ingredients (recipe_id, ingredient_id, quantity)
  VALUES (v_recipe, v_agua, 0.5);

  -- DUL-001 Chocolate Sahne-Nuss: 0.05 kg chocolate + 0.01 kg sal
  v_recipe := NULL;
  SELECT id INTO v_recipe FROM public.recipes WHERE product_id = v_dul001 AND business_id = v_biz LIMIT 1;
  IF v_recipe IS NULL THEN
    INSERT INTO public.recipes (business_id, product_id, name, servings, is_active)
    VALUES (v_biz, v_dul001, 'Receta Chocolate Sahne-Nuss', 1, true)
    RETURNING id INTO v_recipe;
  END IF;
  DELETE FROM public.recipe_ingredients WHERE recipe_id = v_recipe;
  INSERT INTO public.recipe_ingredients (recipe_id, ingredient_id, quantity)
  VALUES
    (v_recipe, v_choc, 0.05),
    (v_recipe, v_sal, 0.01);

  -- SNK-001 Papas Lays: 0.1 kg papas + 0.02 kg sal + 0.01 lt aceite
  v_recipe := NULL;
  SELECT id INTO v_recipe FROM public.recipes WHERE product_id = v_snk001 AND business_id = v_biz LIMIT 1;
  IF v_recipe IS NULL THEN
    INSERT INTO public.recipes (business_id, product_id, name, servings, is_active)
    VALUES (v_biz, v_snk001, 'Receta Papas Lays', 1, true)
    RETURNING id INTO v_recipe;
  END IF;
  DELETE FROM public.recipe_ingredients WHERE recipe_id = v_recipe;
  INSERT INTO public.recipe_ingredients (recipe_id, ingredient_id, quantity)
  VALUES
    (v_recipe, v_papa, 0.1),
    (v_recipe, v_sal, 0.02),
    (v_recipe, v_aceite, 0.01);

  RAISE NOTICE 'Seeds aplicadas: 5 ingredientes + 3 recetas en Negocio Principal';
END $$;
