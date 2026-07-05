import { useAtom } from 'jotai';
import { currentUserAtom, selectedBusinessAtom, businessVersionAtom } from '@/atoms/auth';
import { setGlobalBusinessId } from '@/lib/api-with-business';

export function BusinessSelector() {
  const [user] = useAtom(currentUserAtom);
  const [selectedBusiness, setSelectedBusiness] = useAtom(selectedBusinessAtom);
  const [, setBusinessVersion] = useAtom(businessVersionAtom);

  if (!user) return null;

  const { memberships } = user;

  function handleBusinessChange(businessId: string) {
    const biz = memberships.find((m) => m.business.id === businessId);
    const newBusiness = biz?.business ?? null;

    setSelectedBusiness(newBusiness);

    // Actualizar global business ID para las llamadas API
    if (newBusiness) {
      setGlobalBusinessId(newBusiness.id);
    } else {
      setGlobalBusinessId(null);
    }

    // Incrementar versión para que los componentes recarguen datos
    setBusinessVersion((v) => v + 1);
  }

  // Si solo tiene un negocio, mostrar solo el nombre
  if (memberships.length === 1) {
    const onlyMembership = memberships[0];
    if (!onlyMembership) return null;
    const { business, role } = onlyMembership;
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-50 rounded-lg">
        <span className="text-sm font-medium text-brand-700">{business.name}</span>
        <span className="text-xs bg-brand-200 text-brand-800 px-2 py-0.5 rounded">
          {role === 'owner' ? 'Owner' : role}
        </span>
      </div>
    );
  }

  // Si tiene múltiples negocios, mostrar selector
  return (
    <select
      value={selectedBusiness?.id ?? ''}
      onChange={(e) => handleBusinessChange(e.target.value)}
      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
    >
      <option value="">Seleccionar negocio...</option>
      {memberships.map((m) => (
        <option key={m.business.id} value={m.business.id}>
          {m.business.name} ({m.role})
        </option>
      ))}
    </select>
  );
}
