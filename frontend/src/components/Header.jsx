import React, { useState, useEffect } from 'react';
import { Cpu, Upload, FileText, Download, Clock, Loader2, Sparkles, Layers } from 'lucide-react';

export default function Header({ onUpload, isScanning, gpuStatus, resultData, selectedEngine, setSelectedEngine }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let interval = null;
    if (isScanning) {
      setSeconds(0);
      interval = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isScanning]);

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Determine docx URL with safe fallback
  const getDocxUrl = () => {
    if (!resultData) return '';
    if (resultData.docx_url) return `http://localhost:8000${resultData.docx_url}`;
    if (resultData.searchable_url) {
      const fallback = resultData.searchable_url.replace('_searchable.pdf', '_result.docx').replace('.pdf', '.docx');
      return `http://localhost:8000${fallback}`;
    }
    return '';
  };

  return (
    <header className="bg-white text-slate-900 px-6 py-3 flex flex-wrap items-center justify-between shadow-sm border-b border-slate-200 shrink-0 gap-4">
      <div className="flex items-center space-x-3">
        <div className="bg-blue-50 p-2 rounded-xl border border-blue-100 shadow-sm">
          <FileText className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center space-x-2">
            <span>Dual-Engine PDF OCR Scanner</span>
            <span className="text-[10px] bg-blue-50 text-blue-700 font-mono px-2 py-0.5 rounded-full border border-blue-200 font-semibold">
              PaddleOCR & Docling
            </span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">So sánh Mô hình PaddleOCR GPU vs Docling (IBM Research)</p>
        </div>
      </div>

      <div className="flex items-center space-x-4 flex-wrap gap-2">
        {/* Engine Mode Switcher Selector */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-300 shadow-xs">
          <button
            onClick={() => setSelectedEngine('paddleocr')}
            disabled={isScanning}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center space-x-1.5 transition ${
              selectedEngine === 'paddleocr'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mode 1: PaddleOCR GPU</span>
          </button>

          <button
            onClick={() => setSelectedEngine('docling')}
            disabled={isScanning}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center space-x-1.5 transition ${
              selectedEngine === 'docling'
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Mode 2: Docling AI (IBM)</span>
          </button>
        </div>

        {/* GPU Status Badge */}
        <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 shadow-sm">
          <Cpu className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold">GPU: {gpuStatus?.gpu_available ? 'RTX 3050 (CUDA Active)' : 'CPU Mode'}</span>
        </div>

        {/* Live Timer Clock when Scanning */}
        {isScanning && (
          <div className="flex items-center space-x-2 bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-lg text-amber-800 text-xs font-mono animate-pulse shadow-sm">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span className="font-bold text-sm">{formatTimer(seconds)}</span>
            <span className="text-[10px] text-amber-700">Đang scan ({selectedEngine.toUpperCase()})...</span>
          </div>
        )}

        {/* Upload PDF Control Button */}
        <label className={`cursor-pointer font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 transition text-sm ${
          isScanning
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            : selectedEngine === 'docling'
            ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
        }`}>
          {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          <span>{isScanning ? `Đang xử lý (${formatTimer(seconds)})` : `Upload PDF (${selectedEngine === 'docling' ? 'Docling' : 'PaddleOCR'})`}</span>
          <input type="file" accept=".pdf" onChange={onUpload} disabled={isScanning} className="hidden" />
        </label>

        {/* Download Action Buttons */}
        {resultData && !isScanning && (
          <div className="flex items-center space-x-2">
            <a
              href={getDocxUrl()}
              download
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg flex items-center space-x-2 text-sm shadow-md transition"
            >
              <FileText className="w-4 h-4 text-blue-100" />
              <span>📝 Tải File Word (.docx)</span>
            </a>

            <a
              href={`http://localhost:8000${resultData.searchable_url}`}
              download
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-lg flex items-center space-x-1 text-xs border border-slate-300 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải PDF Searchable</span>
            </a>
          </div>
        )}
      </div>
    </header>
  );
}
