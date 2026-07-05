import { useState, useEffect } from 'react';
import { CreateProductSchema, UpdateProductSchema } from '@pos-pyme/validation';
import type { CreateProductDto, UpdateProductDto } from '@pos-pyme/validation';
import { formatCLP, formatPercent } from '@pos-pyme/business-rules';
import type { ProductAdmin } from '@/lib/products';
import { createProduct, updateProduct } from '@/lib/products';

interface ProductFormModalProps {
  product: ProductAdmin | null; // null = crear, producto = editar
  onClose: () => void;
  onSuccess: () => void;
}

const EMPTY: CreateProductDto = {
  sku: '',
  name: '',
  description: undefined,
  cost_price: 0,
  sale_price: 0,
  stock: 0,
  min_stock: 3,
};

export function ProductFormModal({ product, onClose, onSuccess }: ProductFormModalProps) {
  const isEdit = !!product;
  const [form, setForm] = useState<CreateProductDto>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        sku: product.sku,
        name: product.name,
        description: product.description ?? undefined,
        cost_price: Number(product.cost_price),
        sale_price: Number(product.sale_price),
        stock: Number(product.stock),
        min_stock: Number(product.min_stock),
      });
    } else {
      setForm(EMPTY);
    }
  }, [product]);

  const margin =
    form.cost_price > 0 && form.sale_price > 0
      ? (form.sale_price - form.cost_price) / form.sale_price
      : 0;

  async function submit() {
    setError(null);

    // Validar con Zod
    const payload = {
      ...form,
      // convertir vacíos a undefined
      description: form.description?.trim() || undefined,
    };

    const schema = isEdit ? UpdateProductSchema : CreateProductSchema;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }

    setLoading(true);
    try {
      if (isEdit && product) {
        await updateProduct(product.id, parsed.data as UpdateProductDto);
      } else {
        await createProduct(parsed.data as CreateProductDto);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function update<K extends keyof CreateProductDto>(key: K, value: CreateProductDto[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-xl font-bold">
            {isEdit ? '✏️ Editar producto' : '➕ Nuevo producto'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* SKU + Name */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">
                SKU *
              </label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => update('sku', e.target.value)}
                placeholder="BEB-001"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                maxLength={50}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">
                Nombre *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Coca-Cola 1.5L"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                maxLength={200}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">
              Descripción (opcional)
            </label>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Descripción del producto..."
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              maxLength={1000}
            />
          </div>

          {/* Precios */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">
                Costo *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input
                  type="number"
                  value={form.cost_price || ''}
                  onChange={(e) => update('cost_price', Number(e.target.value))}
                  min={0}
                  step="0.01"
                  className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-300 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">
                Venta *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input
                  type="number"
                  value={form.sale_price || ''}
                  onChange={(e) => update('sale_price', Number(e.target.value))}
                  min={0}
                  step="0.01"
                  className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-300 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">
                Margen
              </label>
              <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 font-mono font-semibold text-green-700">
                {formatPercent(margin)}
              </div>
            </div>
          </div>

          {/* Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">
                Stock actual
              </label>
              <input
                type="number"
                value={form.stock ?? 0}
                onChange={(e) => update('stock', Number(e.target.value))}
                min={0}
                step="1"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">
                Stock mínimo (alerta)
              </label>
              <input
                type="number"
                value={form.min_stock ?? 3}
                onChange={(e) => update('min_stock', Number(e.target.value))}
                min={0}
                step="1"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
              />
            </div>
          </div>

          {/* Live preview */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="text-xs text-slate-500 uppercase mb-1">Preview en POS</div>
            <div className="flex justify-between items-center">
              <div>
                <div className="font-mono text-xs text-slate-400">{form.sku || 'SKU'}</div>
                <div className="font-medium">{form.name || 'Nombre'}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-brand-600">{formatCLP(form.sale_price)}</div>
                <div className="text-xs text-slate-500">
                  Stock: {form.stock}
                  {form.stock <= form.min_stock && (
                    <span className="ml-2 text-red-600 font-semibold">⚠️ BAJO</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-2">
              {error}
            </div>
          )}
        </div>

        <div className="p-5 border-t flex gap-2 sticky bottom-0 bg-white rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-200 text-slate-800 py-3 rounded-lg font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-3 rounded-lg font-bold disabled:opacity-50"
          >
            {loading ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </div>
      </div>
    </div>
  );
}
