/**
 * Helpers para exportar datos a CSV (compatible con Excel).
 */

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (val: string | number): string => {
    const s = String(val ?? '');
    // Escapar comillas y envolver si tiene caracteres especiales
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [headers, ...rows].map((row) => row.map(escape).join(','));
  // BOM para que Excel detecte UTF-8
  const csv = '\uFEFF' + lines.join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatCLPForCSV(n: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
  }).format(n);
}
