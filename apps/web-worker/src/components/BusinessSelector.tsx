import { useAtom } from 'jotai';
import { currentWorkerAtom, selectedBusinessAtom } from '@/atoms';

export function BusinessSelector() {
  const [worker] = useAtom(currentWorkerAtom);
  const [selectedBusiness, setSelectedBusiness] = useAtom(selectedBusinessAtom);

  if (!worker) return null;

  const { memberships } = worker;

  // Si solo tiene un negocio, mostrar solo el nombre
  if (memberships.length === 1) {
    const business = memberships[0]?.business;
    if (!business) return null;
    return (
      <div className="px-4 py-2 bg-slate-100 rounded-lg">
        <span className="text-sm font-medium text-slate-700">{business.name}</span>
      </div>
    );
  }

  // Si tiene múltiples negocios, mostrar selector
  return (
    <select
      value={selectedBusiness?.id ?? ''}
      onChange={(e) => {
        const biz = memberships.find((m) => m.business.id === e.target.value);
        setSelectedBusiness(biz?.business ?? null);
      }}
      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white w-full"
    >
      <option value="">Seleccionar negocio...</option>
      {memberships.map((m) => (
        <option key={m.business.id} value={m.business.id}>
          {m.business.name}
        </option>
      ))}
    </select>
  );
}
