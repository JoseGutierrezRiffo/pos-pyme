-- =============================================================
-- Stock Movements: workflow de aprobación para evitar fraude
-- =============================================================

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('in', 'out')),
  quantity integer NOT NULL CHECK (quantity > 0),
  reason text NOT NULL,
  photo_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movements_status ON public.stock_movements(status);
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX idx_stock_movements_shift ON public.stock_movements(shift_id);
CREATE INDEX idx_stock_movements_user ON public.stock_movements(user_id);
CREATE INDEX idx_stock_movements_pending ON public.stock_movements(requested_at DESC)
  WHERE status = 'pending';

-- RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Workers/admins pueden ver solicitudes (workers solo las suyas)
CREATE POLICY "movements_select" ON public.stock_movements
  FOR SELECT USING (
    user_id = auth.uid() OR public.current_user_role() = 'admin'
  );

-- Workers (o admins) pueden crear solicitudes nuevas (siempre pending)
CREATE POLICY "movements_insert" ON public.stock_movements
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND status = 'pending'
  );

-- Solo admins pueden aprobar/rechazar
CREATE POLICY "movements_update" ON public.stock_movements
  FOR UPDATE USING (public.current_user_role() = 'admin');

-- =============================================================
-- TRIGGER: al aprobar, actualizar stock del producto
-- =============================================================
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo actuar cuando el status CAMBIA a 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    IF NEW.type = 'in' THEN
      -- Entrada de mercadería: agregar al stock
      UPDATE public.products
        SET stock = stock + NEW.quantity,
            updated_at = now()
        WHERE id = NEW.product_id;
    ELSIF NEW.type = 'out' THEN
      -- Salida manual (ej: producto dañado): restar del stock
      UPDATE public.products
        SET stock = GREATEST(0, stock - NEW.quantity),
            updated_at = now()
        WHERE id = NEW.product_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_stock_movement ON public.stock_movements;
CREATE TRIGGER trg_apply_stock_movement
  AFTER UPDATE ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_stock_movement();

-- =============================================================
-- TRIGGER: notificar al admin cuando hay solicitud pendiente
-- =============================================================
CREATE OR REPLACE FUNCTION public.notify_stock_movement_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_name text;
  v_worker_name text;
BEGIN
  -- Solo cuando es una solicitud nueva
  IF NEW.status = 'pending' THEN
    SELECT name INTO v_product_name FROM public.products WHERE id = NEW.product_id;
    SELECT full_name INTO v_worker_name FROM public.profiles WHERE id = NEW.user_id;

    INSERT INTO public.notifications (user_id, type, title, message, payload)
    SELECT p.id,
           'stock_movement',
           '📦 Nueva solicitud de stock',
           v_worker_name || ' pidió ' ||
             CASE WHEN NEW.type = 'in' THEN 'agregar' ELSE 'retirar' END ||
             ' ' || NEW.quantity || ' unidades de ' || v_product_name,
           jsonb_build_object(
             'movement_id', NEW.id,
             'product_id', NEW.product_id,
             'product_name', v_product_name,
             'quantity', NEW.quantity,
             'type', NEW.type,
             'reason', NEW.reason,
             'worker_id', NEW.user_id,
             'worker_name', v_worker_name
           )
      FROM public.profiles p
      WHERE p.role = 'admin' AND p.is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_stock_movement_pending ON public.stock_movements;
CREATE TRIGGER trg_notify_stock_movement_pending
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_stock_movement_pending();