import { useEffect, useState, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { formatCLP, formatNumberCL } from '@pos-pyme/business-rules';
import { apiFetch } from '@/lib/api-with-business';
import { downloadCSV, formatCLPForCSV } from '@/lib/csv';
import { businessVersionAtom } from '@/atoms/auth';

interface DailySummary {
  date: string;
  shifts_count: number;
  workers_count: number;
  total_sales: number;
  total_cash_sales: number;
  total_card_sales: number;
  total_transfer_sales: number;
  cash_withdrawals: number;
  avg_discrepancy: number;
  max_discrepancy: number;
  status: 'OK' | 'ATENCION' | 'CRITICO';
  breaks_count: number;
  total_break_minutes: number;
  items_sold: number;
  sales_count: number;
  withdrawals_count: number;
}

interface ShiftDetail {
  id: string;
  user_id: string;
  shift_date: string;
  shift_status: string;
  opened_at: string;
  closed_at: string | null;
  break_started_at: string | null;
  break_ended_at: string | null;
  cash_initial: number;
  cash_declared: number | null;
  cash_expected: number | null;
  discrepancy: number | null;
  total_sales: number;
  cash_withdrawals: number;
  total_cash_sales: number;
  total_card_sales: number;
  total_transfer_sales: number;
  items_sold: number;
  sales_count: number;
  user: { full_name: string; email: string };
  withdrawals: Array<{ amount: number; reason: string; note?: string }>;
  sales: Array<{
    id: string;
    total: number;
    cash_amount: number;
    card_amount: number;
    transfer_amount: number;
    created_at: string;
    items: Array<{
      product_id: string;
      quantity: number;
      price_at_sale: number;
      line_total: number;
    }>;
  }>;
}

type StatusFilter = 'all' | 'OK' | 'ATENCION' | 'CRITICO';

const STATUS_COLORS: Record<string, string> = {
  OK: 'bg-green-100 text-green-800 border-green-300',
  ATENCION: 'bg-amber-100 text-amber-800 border-amber-300',
  CRITICO: 'bg-red-100 text-red-800 border-red-300',
};

const STATUS_DOT: Record<string, string> = {
  OK: 'bg-green-500',
  ATENCION: 'bg-amber-500',
  CRITICO: 'bg-red-500',
};

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function Calendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayShifts, setDayShifts] = useState<ShiftDetail[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const businessVersion = useAtomValue(businessVersionAtom);

  // Calcular primer y último día del mes (con padding)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();

    // weekday: 0=Sun, 1=Mon... queremos Lun=0, Dom=6
    const startWeekday = (firstDay.getDay() + 6) % 7;

    const days: Array<{ date: string; inMonth: boolean }> = [];

    // Padding antes
    for (let i = 0; i < startWeekday; i++) {
      const d = new Date(year, month - 1, -startWeekday + i + 1);
      days.push({
        date: d.toISOString().slice(0, 10),
        inMonth: false,
      });
    }

    // Días del mes
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month - 1, i);
      days.push({
        date: d.toISOString().slice(0, 10),
        inMonth: true,
      });
    }

    // Padding después (completar la grilla a múltiplos de 7)
    while (days.length % 7 !== 0) {
      const lastDay = days[days.length - 1];
      if (!lastDay) break;
      const last = new Date(lastDay.date);
      last.setDate(last.getDate() + 1);
      days.push({
        date: last.toISOString().slice(0, 10),
        inMonth: false,
      });
    }

    return days;
  }, [year, month]);

  // Cargar resumen del mes
  useEffect(() => {
    setLoading(true);
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    apiFetch<DailySummary[]>(`/shifts/daily-summary?from=${from}&to=${to}`)
      .then(setSummaries)
      .catch((err) => console.error('Error cargando resumen:', err))
      .finally(() => setLoading(false));
  }, [year, month, businessVersion]);

  // Cargar detalle cuando se selecciona un día
  useEffect(() => {
    if (!selectedDate) {
      setDayShifts([]);
      return;
    }
    setLoadingDay(true);
    apiFetch<ShiftDetail[]>(`/shifts/by-date/${selectedDate}`)
      .then(setDayShifts)
      .catch((err) => console.error('Error cargando turnos:', err))
      .finally(() => setLoadingDay(false));
  }, [selectedDate, businessVersion]);

  const summaryByDate = useMemo(() => {
    const map = new Map<string, DailySummary>();
    // Aplicar filtro de status
    const filtered =
      statusFilter === 'all' ? summaries : summaries.filter((s) => s.status === statusFilter);
    filtered.forEach((s) => map.set(s.date, s));
    return map;
  }, [summaries, statusFilter]);

  function prevMonth() {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
    setSelectedDate(null);
  }

  function nextMonth() {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
    setSelectedDate(null);
  }

  function goToToday() {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setSelectedDate(null);
  }

  function exportMonthCSV() {
    // Exportar los días del mes con turnos
    const daysWithShifts = summaries.filter((s) => s.shifts_count > 0);
    if (daysWithShifts.length === 0) return;

    const headers = [
      'Fecha',
      'Turnos',
      'Vendedores',
      'Ventas Totales',
      'Efectivo',
      'Tarjeta',
      'Transferencia',
      'Retiros',
      'Items Vendidos',
      'Colaciones',
      'Tiempo Colación (min)',
      'Descuadre Promedio',
      'Descuadre Máximo',
      'Estado',
    ];

    const rows = daysWithShifts.map((s) => [
      s.date,
      s.shifts_count,
      s.workers_count,
      formatCLPForCSV(s.total_sales),
      formatCLPForCSV(s.total_cash_sales),
      formatCLPForCSV(s.total_card_sales ?? 0),
      formatCLPForCSV(s.total_transfer_sales ?? 0),
      formatCLPForCSV(s.cash_withdrawals),
      s.items_sold,
      s.breaks_count,
      s.total_break_minutes,
      s.avg_discrepancy,
      s.max_discrepancy,
      s.status,
    ]);

    const filename = `calendario-${year}-${String(month).padStart(2, '0')}.csv`;
    downloadCSV(filename, headers, rows);
  }

  const monthTotal = useMemo(() => {
    return summaries.reduce(
      (acc, s) => ({
        sales: acc.sales + s.total_sales,
        withdrawals: acc.withdrawals + s.cash_withdrawals,
        shifts: acc.shifts + s.shifts_count,
        breaks: acc.breaks + s.breaks_count,
        breakMinutes: acc.breakMinutes + s.total_break_minutes,
        itemsSold: acc.itemsSold + s.items_sold,
        salesCount: acc.salesCount + s.sales_count,
        withdrawalsCount: acc.withdrawalsCount + s.withdrawals_count,
      }),
      {
        sales: 0,
        withdrawals: 0,
        shifts: 0,
        breaks: 0,
        breakMinutes: 0,
        itemsSold: 0,
        salesCount: 0,
        withdrawalsCount: 0,
      },
    );
  }, [summaries]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">📅 Calendario</h1>
          <p className="text-sm text-slate-500 mt-1">
            Resumen diario de turnos, ventas y descuadres
          </p>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sm font-medium"
          >
            ← Anterior
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sm font-medium"
          >
            Hoy
          </button>
          <button
            onClick={nextMonth}
            className="px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sm font-medium"
          >
            Siguiente →
          </button>
        </div>
        <h2 className="text-2xl font-bold">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <button
          onClick={exportMonthCSV}
          disabled={monthTotal.shifts === 0}
          className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          📤 Exportar CSV
        </button>
      </div>

      {/* Filtros de status */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Filtrar:
        </span>
        <FilterPill
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
          label={`Todos (${summaries.length})`}
          color="slate"
        />
        <FilterPill
          active={statusFilter === 'OK'}
          onClick={() => setStatusFilter('OK')}
          label={`🟢 OK (${summaries.filter((s) => s.status === 'OK').length})`}
          color="green"
        />
        <FilterPill
          active={statusFilter === 'ATENCION'}
          onClick={() => setStatusFilter('ATENCION')}
          label={`🟡 Atención (${summaries.filter((s) => s.status === 'ATENCION').length})`}
          color="amber"
        />
        <FilterPill
          active={statusFilter === 'CRITICO'}
          onClick={() => setStatusFilter('CRITICO')}
          label={`🔴 Crítico (${summaries.filter((s) => s.status === 'CRITICO').length})`}
          color="red"
        />
      </div>

      {/* Resumen del mes */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
        <SummaryCard label="Turnos" value={monthTotal.shifts} />
        <SummaryCard
          label="Ventas del mes"
          value={formatCLP(monthTotal.sales)}
          subtitle={
            monthTotal.salesCount > 0
              ? `${monthTotal.salesCount} transac. · ${monthTotal.itemsSold} items`
              : undefined
          }
        />
        <SummaryCard
          label="Items vendidos"
          value={monthTotal.itemsSold}
          subtitle="Unidades totales"
        />
        <SummaryCard
          label="Retiros"
          value={formatCLP(monthTotal.withdrawals)}
          subtitle={
            monthTotal.withdrawalsCount > 0
              ? `${monthTotal.withdrawalsCount} gasto${monthTotal.withdrawalsCount !== 1 ? 's' : ''}`
              : undefined
          }
        />
        <SummaryCard
          label="🍽️ Colaciones"
          value={monthTotal.breaks}
          subtitle={
            monthTotal.breaks > 0
              ? `Total: ${formatMinutesHumanized(monthTotal.breakMinutes)}`
              : undefined
          }
        />
        <SummaryCard
          label="⏱️ Hs de colación"
          value={monthTotal.breaks > 0 ? formatMinutesHumanized(monthTotal.breakMinutes) : '—'}
        />
        <SummaryCard
          label="📊 Promedio turno"
          value={
            monthTotal.shifts > 0
              ? formatCLP(Math.round(monthTotal.sales / monthTotal.shifts))
              : '—'
          }
          subtitle="Ventas / turno"
        />
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        {/* Headers */}
        <div className="grid grid-cols-7 bg-slate-100 border-b">
          {WEEKDAYS.map((d) => (
            <div key={d} className="p-2 text-center text-xs font-semibold text-slate-600 uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        {loading ? (
          <div className="p-8 text-center text-slate-400">Cargando calendario…</div>
        ) : (
          <div className="grid grid-cols-7">
            {calendarDays.map(({ date, inMonth }) => {
              const summary = summaryByDate.get(date);
              const dayNum = parseInt(date.slice(8, 10), 10);
              const isSelected = selectedDate === date;
              const isToday = date === today.toISOString().slice(0, 10);
              const hasData = !!summary;

              return (
                <button
                  key={date}
                  onClick={() => hasData && setSelectedDate(date)}
                  disabled={!hasData}
                  className={`
                      min-h-[80px] p-2 border-t border-l border-slate-100 text-left relative
                      ${inMonth ? 'bg-white' : 'bg-slate-50/50'}
                      ${hasData ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'}
                      ${isSelected ? 'ring-2 ring-brand-500 ring-inset' : ''}
                    `}
                >
                  <div
                    className={`text-sm ${
                      inMonth ? 'font-medium' : 'text-slate-400'
                    } ${isToday ? 'inline-block bg-brand-600 text-white rounded-full w-6 h-6 leading-6 text-center' : ''}`}
                  >
                    {dayNum}
                  </div>
                  {hasData && summary && (
                    <div className="mt-1 space-y-1">
                      <div
                        className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT[summary.status]}`}
                      />
                      <div className="text-xs text-slate-700 font-medium">
                        {formatCLP(summary.total_sales)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {summary.shifts_count} turno{summary.shifts_count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Day detail */}
      {selectedDate && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">📅 {formatDateLong(selectedDate)}</h3>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-slate-400 hover:text-slate-600 text-sm"
            >
              ✕ Cerrar
            </button>
          </div>

          {loadingDay ? (
            <p className="text-slate-400 text-center py-4">Cargando turnos…</p>
          ) : dayShifts.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No hay turnos cerrados este día</p>
          ) : (
            <div className="space-y-3">
              {dayShifts.map((shift) => (
                <ShiftCard key={shift.id} shift={shift} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-3">
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-lg font-bold text-slate-900">{value}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color: 'slate' | 'green' | 'amber' | 'red';
}) {
  const activeClasses = {
    slate: 'bg-slate-900 text-white',
    green: 'bg-emerald-600 text-white',
    amber: 'bg-amber-500 text-white',
    red: 'bg-red-600 text-white',
  }[color];

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
        active ? activeClasses : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

function PaymentBadge({ emoji, label, amount }: { emoji: string; label: string; amount: number }) {
  if (amount === 0) return null;
  return (
    <div className="bg-white/40 rounded p-1.5 text-center">
      <div className="text-sm leading-none">{emoji}</div>
      <div className="text-[10px] opacity-70 leading-tight mt-0.5">{label}</div>
      <div className="font-mono font-semibold text-xs leading-tight">{formatCLP(amount)}</div>
    </div>
  );
}

function ShiftCard({ shift }: { shift: ShiftDetail }) {
  const disc = shift.discrepancy !== null ? Number(shift.discrepancy) : 0;
  const status: 'OK' | 'ATENCION' | 'CRITICO' =
    Math.abs(disc) > 3000 ? 'CRITICO' : Math.abs(disc) > 1000 ? 'ATENCION' : 'OK';
  const direction =
    disc === 0
      ? 'Cuadra exacto'
      : disc > 0
        ? `Sobra ${formatCLP(Math.abs(disc))}`
        : `Falta ${formatCLP(Math.abs(disc))}`;
  const duration = shift.closed_at ? formatDuration(shift.opened_at, shift.closed_at) : 'En curso';

  return (
    <div className={`border rounded-lg p-3 ${STATUS_COLORS[status]}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-semibold">{shift.user?.full_name ?? 'Usuario'}</div>
          <div className="text-xs opacity-70">{shift.user?.email}</div>
        </div>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded ${
            status === 'OK'
              ? 'bg-green-600 text-white'
              : status === 'ATENCION'
                ? 'bg-amber-600 text-white'
                : 'bg-red-600 text-white'
          }`}
        >
          {status}
        </span>
      </div>
      <div className="space-y-2 text-sm">
        {/* Resumen numérico */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div>
            <span className="text-xs opacity-70">Inicio</span> {formatTime(shift.opened_at)}
          </div>
          <div>
            <span className="text-xs opacity-70">Fin</span>{' '}
            {shift.closed_at ? formatTime(shift.closed_at) : '—'}
          </div>
          <div>
            <span className="text-xs opacity-70">Duración</span> {duration}
          </div>
          <div>
            <span className="text-xs opacity-70">Efectivo inicial</span>{' '}
            {formatCLP(Number(shift.cash_initial))}
          </div>
          <div>
            <span className="text-xs opacity-70">Esperado</span>{' '}
            {shift.cash_expected !== null ? formatCLP(Number(shift.cash_expected)) : '—'}
          </div>
          <div>
            <span className="text-xs opacity-70">Declarado</span>{' '}
            {shift.cash_declared !== null ? formatCLP(Number(shift.cash_declared)) : '—'}
          </div>
        </div>

        {/* Ventas */}
        <div className="pt-2 mt-2 border-t border-current/20">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs opacity-70 font-semibold">🛒 Ventas</span>
            <span className="font-mono font-semibold">
              {formatCLP(Number(shift.total_sales))}
              <span className="text-xs opacity-70 ml-2">
                ({shift.sales_count} transac. · {shift.items_sold} items)
              </span>
            </span>
          </div>

          {/* Desglose por método */}
          {(Number(shift.total_cash_sales) > 0 ||
            Number(shift.total_card_sales ?? 0) > 0 ||
            Number(shift.total_transfer_sales ?? 0) > 0) && (
            <div className="grid grid-cols-3 gap-1.5 mt-1 mb-2 text-xs">
              <PaymentBadge emoji="💵" label="Efectivo" amount={Number(shift.total_cash_sales)} />
              <PaymentBadge
                emoji="💳"
                label="Tarjeta"
                amount={Number(shift.total_card_sales ?? 0)}
              />
              <PaymentBadge
                emoji="📲"
                label="Transfer."
                amount={Number(shift.total_transfer_sales ?? 0)}
              />
            </div>
          )}

          {shift.sales && shift.sales.length > 0 && (
            <div className="bg-white/40 rounded p-2 mt-1 space-y-1">
              {shift.sales.map((sale) => (
                <div key={sale.id} className="text-xs">
                  <div className="flex justify-between font-medium">
                    <span>
                      {formatTime(sale.created_at)} ·{' '}
                      {saleMethodLabel(sale.cash_amount, sale.card_amount, sale.transfer_amount)}
                    </span>
                    <span className="font-mono">{formatCLP(Number(sale.total))}</span>
                  </div>
                  {sale.items && sale.items.length > 0 && (
                    <div className="ml-3 mt-0.5 text-xs opacity-80">
                      {sale.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>
                            · {item.quantity}× #{item.product_id.slice(0, 8)}
                          </span>
                          <span className="font-mono">{formatCLP(Number(item.line_total))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gastos */}
        {shift.withdrawals && shift.withdrawals.length > 0 && (
          <div className="pt-2 mt-2 border-t border-current/20">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs opacity-70 font-semibold">💸 Gastos</span>
              <span className="font-mono font-semibold">
                {formatCLP(Number(shift.cash_withdrawals))}
                <span className="text-xs opacity-70 ml-2">
                  ({shift.withdrawals.length} item{shift.withdrawals.length !== 1 ? 's' : ''})
                </span>
              </span>
            </div>
            <div className="bg-white/40 rounded p-2 mt-1 space-y-1">
              {shift.withdrawals.map((w, i) => (
                <div key={i} className="text-xs flex justify-between">
                  <span>
                    <span className="opacity-60 mr-1">
                      {w.reason === 'gasto_operativo' && '💡'}
                      {w.reason === 'compra_insumos' && '🛒'}
                      {w.reason === 'pago_proveedor' && '🤝'}
                      {w.reason === 'otro' && '📦'}
                    </span>
                    {w.note || w.reason}
                  </span>
                  <span className="font-mono">{formatCLP(Number(w.amount))}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Colación */}
        {shift.break_started_at && shift.break_ended_at && (
          <div className="pt-2 mt-2 border-t border-current/20">
            <div className="flex items-baseline justify-between">
              <span className="text-xs opacity-70 font-semibold">🍽️ Colación</span>
              <span className="text-xs">
                {formatTime(shift.break_started_at)} → {formatTime(shift.break_ended_at)}{' '}
                <strong>
                  (
                  {formatMinutesHumanized(
                    Math.round(
                      (new Date(shift.break_ended_at).getTime() -
                        new Date(shift.break_started_at).getTime()) /
                        60000,
                    ),
                  )}
                  )
                </strong>
              </span>
            </div>
          </div>
        )}

        {/* Resultado final */}
        <div className="pt-2 mt-2 border-t border-current/20 flex items-baseline justify-between">
          <span className="text-xs opacity-70 font-semibold">Resultado:</span>
          <strong
            className={
              shift.discrepancy !== null && Number(shift.discrepancy) === 0 ? 'text-green-700' : ''
            }
          >
            {direction}
          </strong>
        </div>
      </div>
    </div>
  );
}

function formatDateLong(iso: string): string {
  const parts = iso.split('-').map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const date = new Date(y, m - 1, d);
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return `${days[date.getDay()]} ${d} de ${MONTH_NAMES[m - 1]} ${y}`;
}

function saleMethodLabel(cash: number, card: number, transfer: number): string {
  const methods: string[] = [];
  if (cash > 0) methods.push('💵');
  if (card > 0) methods.push('💳');
  if (transfer > 0) methods.push('📲');
  return methods.length > 0 ? methods.join(' ') : '—';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function formatMinutesHumanized(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
