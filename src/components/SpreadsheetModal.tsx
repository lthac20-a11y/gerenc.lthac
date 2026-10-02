import React, { useState } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Download, 
  Upload, 
  RotateCcw, 
  Check, 
  AlertCircle,
  Copy,
  Table
} from 'lucide-react';
import { Member } from '../types/league';
import { exportToLeagueCSV, downloadCSV, parseImportedCSV } from '../utils/csvSync';

interface SpreadsheetModalProps {
  members: Member[];
  onClose: () => void;
  onImportMembers: (imported: Partial<Member>[]) => void;
  onResetOriginalData: () => void;
}

export const SpreadsheetModal: React.FC<SpreadsheetModalProps> = ({
  members,
  onClose,
  onImportMembers,
  onResetOriginalData,
}) => {
  const [pasteText, setPasteText] = useState('');
  const [copied, setCopied] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleDownload = () => {
    const csvContent = exportToLeagueCSV(members);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCSV(`planilha_liga_academica_${dateStr}.csv`, csvContent);
  };

  const handleCopy = () => {
    const csvContent = exportToLeagueCSV(members);
    navigator.clipboard.writeText(csvContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImportText = () => {
    if (!pasteText.trim()) return;
    try {
      const parsed = parseImportedCSV(pasteText);
      if (parsed.length === 0) {
        setImportStatus('Nenhum dado válido identificado no formato CSV.');
        return;
      }
      onImportMembers(parsed);
      setImportStatus(`${parsed.length} ligantes importados/atualizados com sucesso!`);
      setPasteText('');
    } catch (err: any) {
      setImportStatus('Erro ao processar o CSV: ' + err.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        try {
          const parsed = parseImportedCSV(content);
          if (parsed.length === 0) {
            setImportStatus('Nenhum membro identificado no arquivo.');
            return;
          }
          onImportMembers(parsed);
          setImportStatus(`${parsed.length} membros importados do arquivo com sucesso!`);
        } catch (err: any) {
          setImportStatus('Erro ao ler arquivo: ' + err.message);
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative space-y-5 max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Central de Planilhas da Liga</h3>
            <p className="text-xs text-slate-400">Exportação e importação de dados no formato exato da planilha da diretoria</p>
          </div>
        </div>

        {/* Current State Card */}
        <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex items-center justify-between text-xs">
          <div>
            <span className="font-semibold text-white block">Planilha Integrada Ativa</span>
            <span className="text-slate-400">
              {members.length} membros cadastrados • Colunas: Nome, Entrada, Horas, HS ATU, ADV, F.J, F.N.J, REP, Plantões Mensais (jan/26 a dez/26)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar CSV'}
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar (.CSV)
            </button>
          </div>
        </div>

        {/* Import CSV File or Paste */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
            Importar ou Atualizar Dados a partir de CSV
          </h4>

          <div className="p-4 border border-dashed border-slate-700 rounded-xl text-center hover:border-slate-500 transition-colors">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-file-input"
            />
            <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center gap-2">
              <Upload className="w-6 h-6 text-emerald-400" />
              <span className="text-xs font-medium text-slate-300">
                Clique para selecionar um arquivo .CSV da liga
              </span>
              <span className="text-[11px] text-slate-500">
                Aceita a formatação original com nomes, horas, advertências e meses
              </span>
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] text-slate-400 font-semibold uppercase block">
              Ou cole as linhas da planilha abaixo:
            </label>
            <textarea
              rows={4}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Cole aqui o conteúdo CSV (ex: Nome,Entrada,Horas,HS ATU,ADV,F.J,F.N.J,REP...)"
              className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-[11px] placeholder-slate-500"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleImportText}
                disabled={!pasteText.trim()}
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium cursor-pointer"
              >
                Processar Texto Colado
              </button>
            </div>
          </div>

          {importStatus && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              {importStatus}
            </div>
          )}
        </div>

        {/* Reset Original Data Option */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-300 font-semibold block">Restaurar Dados Originais</span>
            <span className="text-slate-500 text-[11px]">Recarrega os 28 membros e escalas originais da planilha</span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (confirm('Tem certeza que deseja restaurar a planilha original com todos os membros fornecidos?')) {
                onResetOriginalData();
                onClose();
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer border border-rose-900/40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Planilha Original
          </button>
        </div>
      </div>
    </div>
  );
};
