import React, { useRef, useState } from 'react';
import { 
  X, 
  Printer, 
  Award, 
  Edit3, 
  Info,
  Check
} from 'lucide-react';
import { Member, LeagueConfig } from '../types/league';

interface CertificateModalProps {
  member: Member;
  config: LeagueConfig;
  onClose: () => void;
}

// Helper to convert DD/MM/YYYY to "mês de YYYY"
function formatMonthYear(dateStr: string): string {
  if (!dateStr) return 'abril de 2025';
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const monthNum = parseInt(parts[1], 10);
    const year = parts[2];
    const months = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    const monthName = months[monthNum - 1] || 'abril';
    return `${monthName} de ${year}`;
  }
  return dateStr;
}

// Auto-detect gender prefix ("a acadêmica" / "o acadêmico")
function detectGenderPrefix(name: string): string {
  const firstName = name.trim().split(' ')[0].toLowerCase();
  const femaleEndings = ['a', 'ia', 'la', 'na', 'ra', 'ta', 'ssa', 'isa', 'ane', 'ele', 'ine', 'elle', 'ice'];
  const maleExceptions = ['luca', 'lucas', 'nathan', 'bruno', 'paulo', 'pedro', 'tiago', 'felipe', 'gustavo', 'andre', 'guilherme', 'joao', 'joão', 'gabriel', 'lucas', 'matheus', 'mateus', 'vitor', 'victor', 'leo', 'leonardo', 'rafael'];
  
  if (maleExceptions.includes(firstName)) {
    return 'o acadêmico';
  }
  for (const ending of femaleEndings) {
    if (firstName.endsWith(ending)) {
      return 'a acadêmica';
    }
  }
  return 'a acadêmica';
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  member,
  config,
  onClose,
}) => {
  const certificateRef = useRef<HTMLDivElement>(null);

  // Default values based on member & official template
  const defaultPrefix = detectGenderPrefix(member.name);
  const defaultStartPeriod = formatMonthYear(member.entryDate);
  const defaultEndPeriod = 'agosto de 2026';
  
  // Customization state
  const [isEditing, setIsEditing] = useState(false);
  const [genderPrefix, setGenderPrefix] = useState<string>(defaultPrefix);
  const [studentName, setStudentName] = useState<string>(member.name);
  const [startPeriod, setStartPeriod] = useState<string>(defaultStartPeriod);
  const [endPeriod, setEndPeriod] = useState<string>(defaultEndPeriod);
  const [totalHours, setTotalHours] = useState<number>(member.accumulatedHours || 120);
  const [sector, setSector] = useState<string>('Pronto Socorro');
  const [dateLine, setDateLine] = useState<string>('Campina Grande do Sul, outubro de 2026.');
  const [leftSignatoryName, setLeftSignatoryName] = useState<string>(config.presidentName || 'Acadêmico Nathan Enzo Bereza Canto Cray da Costa');
  const [leftSignatoryTitle, setLeftSignatoryTitle] = useState<string>('Coordenação da Liga do Trauma');
  const [rightSignatoryName, setRightSignatoryName] = useState<string>(config.coordinatorName || 'Dr. João Carlos Domingues Repka');
  const [rightSignatoryTitle, setRightSignatoryTitle] = useState<string>(config.coordinatorTitle || 'Coordenação de Ensino e Pesquisa');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-5xl w-full flex flex-col shadow-2xl overflow-hidden my-auto max-h-[96vh]">
        
        {/* Top Control Bar */}
        <div className="p-3.5 sm:p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Modelo Oficial de Certificado • Hospital Angelina Caron
              </h3>
              <p className="text-[11px] text-slate-400">
                Padrão A4 Paisagem (Landscape) para impressão e geração em PDF
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
              {isEditing ? 'Visualizar Certificado' : 'Editar Campos'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs shadow-md transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Reminder Alert from Template */}
        <div className="bg-amber-950/40 border-b border-amber-800/40 px-4 py-2 text-xs text-amber-200 flex items-center justify-between gap-2 no-print">
          <span className="flex items-center gap-1.5 font-medium">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <strong>Observação de Entrega:</strong> Entregar o certificado após a devolução da carteirinha da liga (Presidente Nathan).
          </span>
        </div>

        {/* Customization Drawer */}
        {isEditing && (
          <div className="bg-slate-900 border-b border-slate-800 p-4 space-y-3 no-print text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Tratamento</label>
                <select
                  value={genderPrefix}
                  onChange={e => setGenderPrefix(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium"
                >
                  <option value="a acadêmica">a acadêmica</option>
                  <option value="o acadêmico">o acadêmico</option>
                  <option value="a acadêmico (a)">a acadêmico (a)</option>
                  <option value="o(a) acadêmico(a)">o(a) acadêmico(a)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Nome no Certificado</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Carga Horária Total</label>
                <input
                  type="number"
                  value={totalHours}
                  onChange={e => setTotalHours(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Período Inicial</label>
                <input
                  type="text"
                  value={startPeriod}
                  onChange={e => setStartPeriod(e.target.value)}
                  placeholder="Ex: abril de 2025"
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Período Final</label>
                <input
                  type="text"
                  value={endPeriod}
                  onChange={e => setEndPeriod(e.target.value)}
                  placeholder="Ex: agosto de 2026"
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Setor das Atividades</label>
                <input
                  type="text"
                  value={sector}
                  onChange={e => setSector(e.target.value)}
                  placeholder="Ex: Pronto Socorro"
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Local e Data</label>
                <input
                  type="text"
                  value={dateLine}
                  onChange={e => setDateLine(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Certificate Display Area */}
        <div className="p-3 sm:p-6 overflow-y-auto bg-slate-950 flex justify-center items-center">
          
          {/* Exact Printable A4 Landscape Certificate */}
          <div 
            ref={certificateRef}
            className="certificate-container bg-white text-slate-900 w-full max-w-[920px] aspect-[1.414/1] relative select-none flex flex-col justify-between shadow-2xl overflow-hidden p-7 sm:p-10"
            style={{
              fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
            }}
          >
            {/* SVG Greek Key Meander Border */}
            <div className="absolute inset-0 pointer-events-none p-3.5 sm:p-4">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  {/* Greek Fret / Meander Pattern Unit */}
                  <pattern id="greek-fret-h" width="24" height="16" patternUnits="userSpaceOnUse">
                    <path 
                      d="M 0 2 H 22 V 14 H 6 V 6 H 18 V 10 H 10 V 10" 
                      fill="none" 
                      stroke="#1e7b34" 
                      strokeWidth="2.2" 
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                    />
                  </pattern>
                  <pattern id="greek-fret-v" width="16" height="24" patternUnits="userSpaceOnUse">
                    <path 
                      d="M 2 0 V 22 H 14 V 6 H 6 V 18 H 10 V 10" 
                      fill="none" 
                      stroke="#1e7b34" 
                      strokeWidth="2.2" 
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                    />
                  </pattern>
                </defs>

                {/* Outer Framing Rectangles */}
                <rect x="2" y="2" width="calc(100% - 4px)" height="calc(100% - 4px)" fill="none" stroke="#1e7b34" strokeWidth="2.5" />
                <rect x="6" y="6" width="calc(100% - 12px)" height="calc(100% - 12px)" fill="none" stroke="#1e7b34" strokeWidth="1" />
                <rect x="24" y="24" width="calc(100% - 48px)" height="calc(100% - 48px)" fill="none" stroke="#1e7b34" strokeWidth="1" />

                {/* Top Border */}
                <rect x="26" y="7" width="calc(100% - 52px)" height="16" fill="url(#greek-fret-h)" />
                {/* Bottom Border */}
                <rect x="26" y="calc(100% - 23px)" width="calc(100% - 52px)" height="16" fill="url(#greek-fret-h)" />
                {/* Left Border */}
                <rect x="7" y="26" width="16" height="calc(100% - 52px)" fill="url(#greek-fret-v)" />
                {/* Right Border */}
                <rect x="calc(100% - 23px)" y="26" width="16" height="calc(100% - 52px)" fill="url(#greek-fret-v)" />

                {/* Corner Boxes */}
                <rect x="7" y="7" width="17" height="17" fill="none" stroke="#1e7b34" strokeWidth="2" />
                <path d="M 10 10 H 21 V 21 H 10 Z M 13 13 H 18 V 18 H 13 Z" fill="#1e7b34" />

                <rect x="calc(100% - 24px)" y="7" width="17" height="17" fill="none" stroke="#1e7b34" strokeWidth="2" />
                <path d="M calc(100% - 21px) 10 H calc(100% - 10px) V 21 H calc(100% - 21px) Z M calc(100% - 18px) 13 H calc(100% - 13px) V 18 H calc(100% - 18px) Z" fill="#1e7b34" />

                <rect x="7" y="calc(100% - 24px)" width="17" height="17" fill="none" stroke="#1e7b34" strokeWidth="2" />
                <path d="M 10 calc(100% - 21px) H 21 V calc(100% - 10px) H 10 Z M 13 calc(100% - 18px) H 18 V calc(100% - 13px) H 13 Z" fill="#1e7b34" />

                <rect x="calc(100% - 24px)" y="calc(100% - 24px)" width="17" height="17" fill="none" stroke="#1e7b34" strokeWidth="2" />
                <path d="M calc(100% - 21px) calc(100% - 21px) H calc(100% - 10px) V calc(100% - 10px) H calc(100% - 21px) Z M calc(100% - 18px) calc(100% - 18px) H calc(100% - 13px) V calc(100% - 13px) H calc(100% - 18px) Z" fill="#1e7b34" />
              </svg>
            </div>

            {/* Inner Content Area */}
            <div className="relative z-10 flex flex-col justify-between h-full px-4 sm:px-8 py-2">
              
              {/* Top Header: Left Seal | Center Text | Right Cross */}
              <div className="flex items-center justify-between gap-2 pt-1 pb-1">
                
                {/* Left Seal: Liga Acadêmica do Trauma */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xs">
                    {/* Outer Green Ring */}
                    <circle cx="50" cy="50" r="46" fill="none" stroke="#1e7b34" strokeWidth="5.5" />
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#1e7b34" strokeWidth="1.5" />
                    
                    {/* Ring Background */}
                    <path
                      id="textRingTop"
                      d="M 16,50 A 34,34 0 0,1 84,50"
                      fill="none"
                    />
                    <path
                      id="textRingBottom"
                      d="M 84,50 A 34,34 0 0,1 16,50"
                      fill="none"
                    />
                    
                    <text fontSize="7.5" fontWeight="bold" fill="#1e7b34" textAnchor="middle">
                      <textPath href="#textRingTop" startOffset="50%">
                        • LIGA DO TRAUMA •
                      </textPath>
                    </text>
                    <text fontSize="6.5" fontWeight="bold" fill="#1e7b34" textAnchor="middle">
                      <textPath href="#textRingBottom" startOffset="50%">
                        HOSPITAL ANGELINA CARON
                      </textPath>
                    </text>

                    {/* Center Medical Emblem / Asclepius Snake Staff */}
                    <g transform="translate(50, 50) scale(0.65)">
                      {/* Staff */}
                      <line x1="0" y1="-30" x2="0" y2="30" stroke="#1e7b34" strokeWidth="3" strokeLinecap="round" />
                      {/* Knob */}
                      <circle cx="0" cy="-30" r="3" fill="#1e7b34" />
                      {/* Entwined Snake */}
                      <path 
                        d="M -10 -20 Q 12 -15 0 -5 Q -14 5 0 15 Q 12 25 0 28" 
                        fill="none" 
                        stroke="#1e7b34" 
                        strokeWidth="3" 
                        strokeLinecap="round" 
                      />
                      {/* Snake head */}
                      <ellipse cx="-2" cy="-24" rx="3.5" ry="2.5" fill="#1e7b34" transform="rotate(-30, -2, -24)" />
                    </g>
                  </svg>
                </div>

                {/* Center Institution Title */}
                <div className="text-center flex-1 px-2">
                  <h1 
                    className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-950 uppercase"
                    style={{ fontFamily: "'Arial Black', Impact, 'Segoe UI', sans-serif" }}
                  >
                    Hospital Angelina Caron
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-800 font-medium tracking-wide mt-0.5">
                    Campina Grande do Sul - Paraná
                  </p>
                </div>

                {/* Right Logo: Hospital Angelina Caron Green Cross */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 100 80" className="w-full h-full drop-shadow-xs">
                    {/* Stylized Cross Emblem of Hospital Angelina Caron */}
                    <path
                      d="M 35 10 H 65 V 28 H 88 C 93 28 96 32 96 38 V 44 C 96 50 93 54 88 54 H 65 V 72 H 35 V 54 H 12 C 7 54 4 50 4 44 V 38 C 4 32 7 28 12 28 H 35 Z"
                      fill="#1e7b34"
                    />
                    {/* Inner Dynamic Curve Cutout */}
                    <path
                      d="M 62 10 Q 75 35 96 42 L 88 28 H 65 Z"
                      fill="#156328"
                    />
                    <path
                      d="M 38 72 Q 25 47 4 40 L 12 54 H 35 Z"
                      fill="#156328"
                    />
                  </svg>
                </div>
              </div>

              {/* Title: Liga Acadêmica do Trauma – Certificado */}
              <div className="text-center my-2 sm:my-3">
                <h2 className="text-base sm:text-xl font-bold text-slate-950 tracking-tight">
                  Liga Acadêmica do Trauma – Certificado
                </h2>
              </div>

              {/* Certificate Main Text */}
              <div className="text-center max-w-3xl mx-auto px-2 sm:px-6 leading-relaxed sm:leading-loose">
                <p className="text-xs sm:text-[15px] sm:leading-[1.8] text-slate-900 text-justify sm:text-center">
                  Certificamos que {genderPrefix} <strong className="font-extrabold text-black uppercase tracking-wide">{studentName}</strong> concluiu o estágio voluntário no período de <strong className="font-medium">{startPeriod} a {endPeriod}</strong>, num total de <strong className="font-bold text-black">{totalHours} horas</strong> de aulas teóricas e de atividades práticas supervisionadas em <strong className="font-semibold">{sector}</strong>.
                </p>
              </div>

              {/* Location & Date */}
              <div className="text-center text-xs sm:text-sm text-slate-800 font-medium my-2">
                {dateLine}
              </div>

              {/* Signatures Row */}
              <div className="grid grid-cols-2 gap-6 sm:gap-14 pt-2 sm:pt-4 pb-1 text-center">
                
                {/* Left: Nathan Enzo / Coordenação da Liga */}
                <div className="flex flex-col items-center justify-end">
                  <div className="h-10 sm:h-12 flex items-center justify-center">
                    {/* Subtle digital signature line / placeholder */}
                    <span className="font-serif italic text-xs sm:text-sm text-slate-700 opacity-90 select-none">
                      Nathan E. B. C. Cray da Costa
                    </span>
                  </div>
                  <div className="w-full max-w-[260px] h-[1px] bg-slate-400 mb-1" />
                  <p className="text-[11px] sm:text-xs font-bold text-slate-950 leading-tight">
                    {leftSignatoryName}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-slate-700 leading-tight mt-0.5">
                    {leftSignatoryTitle}
                  </p>
                </div>

                {/* Right: Dr. João Carlos Domingues Repka */}
                <div className="flex flex-col items-center justify-end">
                  <div className="h-10 sm:h-12 flex items-center justify-center">
                    {/* Realistic SVG Signature of Dr. João Carlos Domingues Repka */}
                    <svg viewBox="0 0 200 60" className="h-8 sm:h-10 w-auto text-slate-800">
                      <path
                        d="M 20 42 C 35 15, 45 10, 50 35 C 55 45, 65 38, 75 32 C 85 28, 95 35, 100 42 C 108 46, 120 22, 130 30 C 140 38, 150 25, 160 35 C 165 40, 175 38, 185 36 M 125 35 C 130 18, 145 15, 148 38 C 150 48, 135 52, 125 45 C 115 38, 120 20, 135 25"
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="w-full max-w-[260px] h-[1px] bg-slate-400 mb-1" />
                  <p className="text-[11px] sm:text-xs font-bold text-slate-950 leading-tight">
                    {rightSignatoryName}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-slate-700 leading-tight mt-0.5">
                    {rightSignatoryTitle}
                  </p>
                </div>

              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
