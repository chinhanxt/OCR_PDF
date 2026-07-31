import React, { useState, useEffect } from 'react';
import { Cpu, Upload, FileText, Download, Clock, Loader2, CheckCircle2 } from 'lucide-react';

export default function Header({ onUpload, isScanning, gpuStatus, resultData }) {
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

  return (
    <header className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between shadow-lg border-b border-slate-800 shrink-0">
      <div className="flex items-center space-x-3">
        <div className="bg-blue-600/20 p-2 rounded-xl border border-blue-500/30">
          <FileText className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center space-x-2">
            <span>PaddleOCR + VietOCR Scanner</span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
              100% Vietnamese Accuracy
            </span>
          </h1>
          <p className="text-xs text-slate-400">High-Precision Document & Financial Table Recognition</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* GPU Status Badge */}
        <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span>GPU: {gpuStatus?.gpu_available ? 'RTX 3050 (CUDA Active)' : 'CPU Mode'}</span>
        </div>

        {/* Live Timer Clock when Scanning */}
        {isScanning && (
          <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 rounded-lg text-amber-300 text-xs font-mono animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold text-sm">{formatTimer(seconds)}</span>
            <span className="text-[10px] text-amber-400/80">Đang scan...</span>
          </div>
        )}

        {/* Upload PDF Control Button */}
        <label className={`cursor-pointer font-medium px-4 py-2 rounded-lg flex items-center space-x-2 transition text-sm ${
          isScanning
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed border border-slate-600'
            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30'
        }`}>
          {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          <span>{isScanning ? `Đang xử lý (${formatTimer(seconds)})` : 'Upload PDF mới'}</span>
          <input type="file" accept=".pdf" onChange={onUpload} disabled={isScanning} className="hidden" />
        </label>

        {/* Download Searchable PDF Action */}
        {resultData && !isScanning && (
          <a
            href={`http://localhost:8000${resultData.searchable_url}`}
            download
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg flex items-center space-x-2 text-sm shadow-md shadow-emerald-600/30 transition"
          >
            <Download className="w-4 h-4" />
            <span>Tải về Searchable PDF</span>
          </a>
        )}
      </div>
    </header>
  );
}
