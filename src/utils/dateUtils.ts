// Utilitários Dinâmicos de Data, Mês e Ano para a LTHAC

export const SHORT_MONTH_NAMES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'
];

export const FULL_MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Retorna o ano atual do sistema (ex: 2026)
 */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

/**
 * Retorna o índice do mês atual do sistema (0 = Jan, 11 = Dez)
 */
export function getCurrentMonthIndex(): number {
  return new Date().getMonth();
}

/**
 * Formata um mês e ano em chave padrão (ex: 0, 2026 -> 'jan/26')
 */
export function formatMonthKey(monthIndex: number, year: number): string {
  const safeMonth = (monthIndex + 12) % 12;
  const yy = String(year).slice(-2);
  return `${SHORT_MONTH_NAMES[safeMonth]}/${yy}`;
}

/**
 * Formata o nome completo do mês e ano (ex: 9, 2026 -> 'Outubro / 2026')
 */
export function formatFullMonthYear(monthIndex: number, year: number): string {
  const safeMonth = (monthIndex + 12) % 12;
  return `${FULL_MONTH_NAMES[safeMonth]} / ${year}`;
}

/**
 * Formata uma chave de mês ou string de data para o formato limpo 'Outubro/2026'
 * (ex: 'out/26', '10/2026', '05/10 (out/26)' -> 'Outubro/2026')
 */
export function formatReferenceMonthYear(monthOrDateStr?: string, fallbackMonthKey?: string): string {
  const raw = (monthOrDateStr || fallbackMonthKey || '').trim();
  if (!raw) {
    return `${FULL_MONTH_NAMES[getCurrentMonthIndex()]}/${getCurrentYear()}`;
  }

  // Se já estiver no formato 'Outubro/2026'
  for (let i = 0; i < FULL_MONTH_NAMES.length; i++) {
    if (raw.toLowerCase().startsWith(FULL_MONTH_NAMES[i].toLowerCase())) {
      const yearMatch = raw.match(/\d{4}/);
      const yr = yearMatch ? parseInt(yearMatch[0], 10) : getCurrentYear();
      return `${FULL_MONTH_NAMES[i]}/${yr}`;
    }
  }

  // Se tiver '(out/26)' embutido (ex: '05/10 (out/26)')
  const parenMatch = raw.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1]) {
    const { monthIndex, year } = parseMonthKey(parenMatch[1]);
    return `${FULL_MONTH_NAMES[(monthIndex + 12) % 12]}/${year}`;
  }

  // Se houver fallbackMonthKey válido (ex: 'out/26'), priorizar caso raw seja 'DD/MM'
  if (fallbackMonthKey && fallbackMonthKey.includes('/')) {
    const { monthIndex, year } = parseMonthKey(fallbackMonthKey);
    return `${FULL_MONTH_NAMES[(monthIndex + 12) % 12]}/${year}`;
  }

  const { monthIndex, year } = parseMonthKey(raw);
  return `${FULL_MONTH_NAMES[(monthIndex + 12) % 12]}/${year}`;
}

/**
 * Formata uma chave de mês para o formato numérico 'MM/YYYY' (ex: 'out/26' -> '10/2026')
 */
export function formatNumericMonthYear(monthKey: string): string {
  const { monthIndex, year } = parseMonthKey(monthKey);
  const mm = String(((monthIndex + 12) % 12) + 1).padStart(2, '0');
  return `${mm}/${year}`;
}

/**
 * Converte chave de mês (ex: 'out/26' ou '02/2026') em mês (0..11) e ano completo (ex: 2026)
 */
export function parseMonthKey(monthKey: string): { monthIndex: number; year: number } {
  if (!monthKey) {
    return { monthIndex: getCurrentMonthIndex(), year: getCurrentYear() };
  }

  const parts = monthKey.toLowerCase().trim().split('/');
  if (parts.length === 2) {
    const monthStr = parts[0];
    let yearNum = parseInt(parts[1], 10);
    
    // Se o ano for de 2 dígitos (ex: '26'), converter para 2026
    if (yearNum < 100) {
      yearNum = 2000 + yearNum;
    }

    let monthIdx = SHORT_MONTH_NAMES.indexOf(monthStr);
    if (monthIdx === -1) {
      // Se for número (ex: '10/2026')
      const parsedMonthNum = parseInt(monthStr, 10);
      if (!isNaN(parsedMonthNum) && parsedMonthNum >= 1 && parsedMonthNum <= 12) {
        monthIdx = parsedMonthNum - 1;
      } else {
        monthIdx = getCurrentMonthIndex();
      }
    }

    if (!isNaN(yearNum)) {
      return { monthIndex: monthIdx, year: yearNum };
    }
  }

  return { monthIndex: getCurrentMonthIndex(), year: getCurrentYear() };
}

/**
 * Retorna o número exato de dias em um mês considerando anos bissextos
 */
export function getDaysInMonth(monthIndex: number, year: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Gera as 12 colunas de meses para um determinado ano
 */
export function getMonthColumnsForYear(year: number): string[] {
  return SHORT_MONTH_NAMES.map((_, idx) => formatMonthKey(idx, year));
}

/**
 * Retorna os trimestres para um determinado ano
 */
export function getQuartersForYear(year: number) {
  const yy = String(year).slice(-2);
  return [
    { id: 'Q1', label: `1º Trimestre (Jan - Mar ${year})`, months: [`jan/${yy}`, `fev/${yy}`, `mar/${yy}`] },
    { id: 'Q2', label: `2º Trimestre (Abr - Jun ${year})`, months: [`abr/${yy}`, `mai/${yy}`, `jun/${yy}`] },
    { id: 'Q3', label: `3º Trimestre (Jul - Set ${year})`, months: [`jul/${yy}`, `ago/${yy}`, `set/${yy}`] },
    { id: 'Q4', label: `4º Trimestre (Out - Dez ${year})`, months: [`out/${yy}`, `nov/${yy}`, `dez/${yy}`] },
  ];
}

/**
 * Retorna a chave do mês limite (ex: 'out/26' + 1 mês -> 'nov/26')
 */
export function getDeadlineMonthKey(originMonthKey: string, monthsToAdd: number = 1): string {
  const { monthIndex, year } = parseMonthKey(originMonthKey);
  const totalMonths = monthIndex + monthsToAdd;
  const targetMonthIndex = (totalMonths % 12 + 12) % 12;
  const targetYear = year + Math.floor(totalMonths / 12);
  return formatMonthKey(targetMonthIndex, targetYear);
}

/**
 * Verifica se a data do mês limite já expirou em relação ao mês/ano atual do sistema
 */
export function isDeadlineOverdue(deadlineMonthKey: string): boolean {
  if (!deadlineMonthKey) return false;
  const { monthIndex: deadlineMonth, year: deadlineYear } = parseMonthKey(deadlineMonthKey);
  const currentYear = getCurrentYear();
  const currentMonth = getCurrentMonthIndex();

  if (currentYear > deadlineYear) return true;
  if (currentYear === deadlineYear && currentMonth > deadlineMonth) return true;
  return false;
}

/**
 * Retorna o texto formatado do prazo limite e flag de vencimento para os cards de reposição
 */
export function getReplacementDeadlineInfo(
  originMonthKey: string, 
  absencesInSameMonth: number = 1,
  fixedDeadlineMonthKey?: string
): {
  deadlineMonthKey: string;
  deadlineText: string;
  isOverdue: boolean;
} {
  const monthsToAdd = absencesInSameMonth >= 2 ? 2 : 1;
  const deadlineMonthKey = (fixedDeadlineMonthKey && fixedDeadlineMonthKey.trim()) 
    ? fixedDeadlineMonthKey.trim() 
    : getDeadlineMonthKey(originMonthKey || 'out/26', monthsToAdd);
  const isOverdue = isDeadlineOverdue(deadlineMonthKey);
  const deadlineText = `⏳ Prazo Limite: até final de ${deadlineMonthKey}`;

  return {
    deadlineMonthKey,
    deadlineText,
    isOverdue,
  };
}

/**
 * Calcula o prazo de reposição dinâmico avançando os meses e viradas de ano corretamente
 */
export function calculateDynamicReplacementDeadline(currentMonthKey: string, absencesInSameMonth: number): string {
  const { monthIndex, year } = parseMonthKey(currentMonthKey);
  
  if (absencesInSameMonth >= 2) {
    const next1Month = (monthIndex + 1) % 12;
    const next1Year = year + Math.floor((monthIndex + 1) / 12);

    const next2Month = (monthIndex + 2) % 12;
    const next2Year = year + Math.floor((monthIndex + 2) / 12);

    const m1 = formatMonthKey(next1Month, next1Year);
    const m2 = formatMonthKey(next2Month, next2Year);
    return `Próximos 2 meses seguintes (${m1} e ${m2})`;
  } else {
    const next1Month = (monthIndex + 1) % 12;
    const next1Year = year + Math.floor((monthIndex + 1) / 12);
    const m1 = formatMonthKey(next1Month, next1Year);
    return `No mês seguinte (${m1})`;
  }
}
