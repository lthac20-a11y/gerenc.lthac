import { Member, MONTH_COLUMNS } from '../types/league';

export function exportToLeagueCSV(members: Member[]): string {
  // Build header identical to the original spreadsheet
  const headers = [
    'Nome',
    'Entrada',
    'Horas',
    'HS ATU',
    'ADV',
    'F.J',
    'F.N.J',
    'REP',
    'Dia e Horas de Reposições',
    ...MONTH_COLUMNS.map(m => m.toUpperCase())
  ];

  const rows = members.map(m => {
    const advCount = m.warnings.filter(w => w.active).length;
    const fjCount = m.justifiedAbsences.length;
    const fnjCount = m.unjustifiedAbsences.length;
    const repCount = m.replacements.filter(r => !r.completed).length;
    const repDates = m.replacements.map(r => r.scheduledDate || (r.completed ? 'Cumprido' : 'Pendente')).join('; ');

    // Group shifts by month
    const monthShifts = MONTH_COLUMNS.map(month => {
      const shiftsInMonth = m.shifts.filter(s => s.monthKey === month);
      if (shiftsInMonth.length === 0) return '//';
      return shiftsInMonth.map(s => {
        if (s.isExcused) return 'Abonado';
        return `${s.date} - ${s.hours} hs`;
      }).join(' | ');
    });

    const values = [
      `"${m.name.replace(/"/g, '""')}"`,
      m.entryDate,
      m.accumulatedHours,
      m.hoursUpdated ? 'SIM' : 'NÃO',
      advCount,
      fjCount > 0 ? fjCount : '',
      fnjCount > 0 ? fnjCount : '',
      repCount > 0 ? repCount : '',
      `"${repDates}"`,
      ...monthShifts.map(s => `"${s}"`),
    ];

    return values.join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function downloadCSV(filename: string, content: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseImportedCSV(csvText: string): Partial<Member>[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const parsedMembers: Partial<Member>[] = [];

  // Identify column indices from header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.trim().toUpperCase());

  const nameIdx = headers.findIndex(h => h.includes('NOME'));
  const entryIdx = headers.findIndex(h => h.includes('ENTRADA') || h.includes('DATA'));
  const hoursIdx = headers.findIndex(h => h.includes('HORA') && !h.includes('REPOSI'));
  const advIdx = headers.findIndex(h => h.includes('ADV') || h.includes('ADVERT'));
  const fjIdx = headers.findIndex(h => h.includes('F.J') || h.includes('JUSTIF'));
  const fnjIdx = headers.findIndex(h => h.includes('F.N.J') || h.includes('INJUST'));
  const repIdx = headers.findIndex(h => h.includes('REP') && !h.includes('DIA'));
  const repDatesIdx = headers.findIndex(h => h.includes('REPOSI'));

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const name = nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx].trim() : '';
    if (!name || name === 'Nome' || name.startsWith(',,')) continue;

    const entryDate = entryIdx !== -1 && cols[entryIdx] ? cols[entryIdx].trim() : '01/01/2026';
    const hours = hoursIdx !== -1 ? parseInt(cols[hoursIdx] || '0', 10) || 0 : 0;
    const advCount = advIdx !== -1 ? parseInt(cols[advIdx] || '0', 10) || 0 : 0;
    const fjCount = fjIdx !== -1 ? parseInt(cols[fjIdx] || '0', 10) || 0 : 0;
    const fnjCount = fnjIdx !== -1 ? parseInt(cols[fnjIdx] || '0', 10) || 0 : 0;
    const repCount = repIdx !== -1 ? parseInt(cols[repIdx] || '0', 10) || 0 : 0;
    const repDates = repDatesIdx !== -1 && cols[repDatesIdx] ? cols[repDatesIdx].trim() : '';

    const warnings = Array.from({ length: advCount }, (_, idx) => ({
      id: `w-imp-${Date.now()}-${idx}`,
      date: entryDate,
      reason: 'Advertência importada da planilha',
      severity: 'moderada' as const,
      active: true,
    }));

    const justifiedAbsences = Array.from({ length: fjCount }, (_, idx) => ({
      id: `fj-imp-${Date.now()}-${idx}`,
      date: entryDate,
      type: 'justificada' as const,
      reason: 'Falta justificada importada',
      requiresReplacement: false,
    }));

    const unjustifiedAbsences = Array.from({ length: fnjCount }, (_, idx) => ({
      id: `fnj-imp-${Date.now()}-${idx}`,
      date: entryDate,
      type: 'injustificada' as const,
      reason: 'Falta não justificada importada',
      requiresReplacement: true,
    }));

    const replacements = Array.from({ length: Math.max(repCount, fnjCount) }, (_, idx) => ({
      id: `rep-imp-${Date.now()}-${idx}`,
      memberId: `imp-${i}`,
      scheduledDate: repDates || 'A definir',
      scheduledHours: 12,
      completed: false,
      notes: 'Reposição importada',
    }));

    parsedMembers.push({
      id: `m-imp-${Date.now()}-${i}`,
      name,
      entryDate,
      role: 'Ligante',
      status: 'ativo',
      accumulatedHours: hours,
      hoursUpdated: true,
      warnings,
      justifiedAbsences,
      unjustifiedAbsences,
      replacements,
      shifts: [],
    });
  }

  return parsedMembers;
}

function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
}
