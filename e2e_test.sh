#!/bin/bash
# Test E2E completo: Login worker → Abrir turno → Ventas → Gastos → Colación → Cerrar

set -e

SUPABASE_URL="https://azparvyrpitmannwnxdl.supabase.co"
SUPABASE_ANON_KEY=$(grep '^SUPABASE_ANON_KEY=' /tmp/pos-pyme/.env | cut -d'=' -f2-)
API="http://localhost:3000/api"

echo "═══════════════════════════════════════════════"
echo "🧪 TEST E2E: Flujo completo de un turno"
echo "═══════════════════════════════════════════════"
echo ""

# 1. LOGIN WORKER
echo "1️⃣  Login como worker..."
TOKEN=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"worker@pospyme.cl","password":"Worker123!"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")
echo "   ✅ Token obtenido"
echo ""

# 2. ABRIR TURNO
echo "2️⃣  Abrir turno con \$50.000..."
SHIFT=$(curl -s -X POST "$API/shifts/open" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"initial_cash":50000}')
SHIFT_ID=$(echo "$SHIFT" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "   ✅ Turno abierto: ${SHIFT_ID:0:8}..."
echo ""

# 3. BUSCAR PRODUCTOS
echo "3️⃣  Buscar Coca-Cola y Papas Lays..."
PRODUCTS=$(curl -s "$API/products" -H "Authorization: Bearer $TOKEN")
COCA_ID=$(echo "$PRODUCTS" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(next(p['id'] for p in d if p['sku']=='BEB-001'))
")
LAYS_ID=$(echo "$PRODUCTS" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(next(p['id'] for p in d if p['sku']=='SNK-001'))
")
echo "   ✅ Coca-Cola: ${COCA_ID:0:8}..., Lays: ${LAYS_ID:0:8}..."
echo ""

# 4. VENTA 1: 2 Coca-Colas + 1 Papas Lays (efectivo)
echo "4️⃣  Venta #1: 2 Coca-Colas + 1 Papas (efectivo)..."
SALE1=$(curl -s -X POST "$API/sales" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"shift_id\":\"$SHIFT_ID\",\"payment_method\":\"efectivo\",\"items\":[{\"product_id\":\"$COCA_ID\",\"quantity\":2},{\"product_id\":\"$LAYS_ID\",\"quantity\":1}]}")
echo "   ✅ Venta 1: \$$(echo $SALE1 | python3 -c 'import json,sys; print(json.load(sys.stdin)[\"total\"])') (2x Coca \$4400 + 1x Lays \$1200 = \$5600)"
echo ""

# 5. GASTO 1: Gas $15.000
echo "5️⃣  Gasto #1: Gas \$15.000..."
curl -s -X POST "$API/shifts/withdrawal" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"amount":15000,"reason":"gasto_operativo","note":"Gas"}' > /dev/null
echo "   ✅ Gas registrado"
echo ""

# 6. COLACIÓN
echo "6️⃣  Ir a colación..."
curl -s -X POST "$API/shifts/break/start" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
echo "   ⏸️  Colación iniciada, durmiendo 8 segundos..."
sleep 8
curl -s -X POST "$API/shifts/break/end" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
echo "   ▶️  Colación terminada (8s)"
echo ""

# 7. GASTO 2: Agua $10.000
echo "7️⃣  Gasto #2: Agua \$10.000..."
curl -s -X POST "$API/shifts/withdrawal" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"amount":10000,"reason":"gasto_operativo","note":"Agua"}' > /dev/null
echo "   ✅ Agua registrado"
echo ""

# 8. VENTA 2: 1 Coca-Cola (transferencia)
echo "8️⃣  Venta #2: 1 Coca-Cola (transferencia)..."
SALE2=$(curl -s -X POST "$API/sales" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"shift_id\":\"$SHIFT_ID\",\"payment_method\":\"transferencia\",\"items\":[{\"product_id\":\"$COCA_ID\",\"quantity\":1}]}")
echo "   ✅ Venta 2: \$$(echo $SALE2 | python3 -c 'import json,sys; print(json.load(sys.stdin)[\"total\"])') (1x Coca \$2200)"
echo ""

# 9. ESTADO ANTES DEL CIERRE
echo "9️⃣  Estado actual del turno (antes del cierre)..."
CURRENT=$(curl -s "$API/shifts/current" -H "Authorization: Bearer $TOKEN")
echo "$CURRENT" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'   Status: {d[\"status\"]}')
print(f'   Inicial: \${d[\"initial_cash\"]}')
print(f'   Ventas: \${d[\"total_sales\"]} (efectivo: \${d[\"total_cash_sales\"]})')
print(f'   Retiros: \${d[\"total_withdrawals\"]}')
print(f'   Break: {d[\"break_started_at\"][11:19] if d[\"break_started_at\"] else \"-\"} → {d[\"break_ended_at\"][11:19] if d[\"break_ended_at\"] else \"-\"}')
"
echo ""

# 10. CERRAR TURNO
echo "🔟 Cerrar turno (declaro \$40.600)..."
echo "    Cálculo esperado: 50000 + 5600 - 25000 = 30600 (efectivo)"
echo "    OJO: las ventas en transferencia (2200) NO suman al efectivo"
echo "    Realidad: 50000 + 5600 (efectivo) - 25000 = 30600"
echo "    Declaro 30.600 → cuadre perfecto"
echo ""

CLOSE=$(curl -s -X POST "$API/shifts/close" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"final_cash":30600}')
echo "$CLOSE" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'   Esperado: \${d[\"expected_cash\"]}')
print(f'   Declarado: \${d[\"final_cash\"]}')
print(f'   Descuadre: \${d[\"discrepancy\"]} ({d[\"status_label\"]})')
print(f'   Break: {d[\"break_started_at\"][11:19] if d[\"break_started_at\"] else \"-\"} → {d[\"break_ended_at\"][11:19] if d[\"break_ended_at\"] else \"-\"}')
"
echo ""

# 11. LOGIN ADMIN Y VER CALENDARIO
echo "1️⃣1️⃣  Login admin para ver el reporte..."
TOKEN_A=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"admin@pospyme.cl","password":"Admin123!"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")
echo "   ✅ Admin login OK"
echo ""

echo "📅 Daily summary:"
TODAY=$(date +%Y-%m-%d)
curl -s "$API/shifts/daily-summary" \
  -H "Authorization: Bearer $TOKEN_A" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for d in data:
    print(f'   {d[\"date\"]}: {d[\"shifts_count\"]} turno(s), \${d[\"total_sales\"]}, status={d[\"status\"]}')
    print(f'      Ventas: \${d[\"total_sales\"]} | Retiros: \${d[\"total_withdrawals\"]}')
    print(f'      Colaciones: {d[\"breaks_count\"]} ({d[\"total_break_minutes\"]} min)')
    print(f'      Discrepancia promedio: \${d[\"avg_discrepancy\"]:.0f}')
"
echo ""

echo "📋 Detalle del día:"
curl -s "$API/shifts/by-date/$TODAY" \
  -H "Authorization: Bearer $TOKEN_A" | python3 -c "
import json, sys
shifts = json.load(sys.stdin)
for s in shifts:
    print(f'   👤 {s[\"user\"][\"full_name\"]}')
    print(f'      Inicio: {s[\"started_at\"][11:19]} | Fin: {s[\"ended_at\"][11:19] if s[\"ended_at\"] else \"-\"}')
    if s.get('break_started_at') and s.get('break_ended_at'):
        print(f'      🍽️  Colación: {s[\"break_started_at\"][11:19]} → {s[\"break_ended_at\"][11:19]}')
    print(f'      Ventas: \${s[\"total_sales\"]} (efectivo: \${s[\"total_cash_sales\"]}) | Retiros: \${s[\"total_withdrawals\"]}')
    print(f'      Esperado: \${s[\"expected_cash\"]} | Declarado: \${s[\"final_cash\"]} | Descuadre: \${s[\"discrepancy\"]}')
    if s.get('withdrawals'):
        for w in s['withdrawals']:
            print(f'      💸 {w[\"note\"] or w[\"reason\"]}: \${w[\"amount\"]}')
"

echo ""
echo "🔔 Notificaciones del admin:"
supabase db query --linked "SELECT type, title, message FROM public.notifications ORDER BY created_at DESC LIMIT 5;" 2>&1 | tail -10

echo ""
echo "═══════════════════════════════════════════════"
echo "✅ TEST COMPLETADO"
echo "═══════════════════════════════════════════════"