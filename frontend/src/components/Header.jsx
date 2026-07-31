import React, { useState, useEffect } from 'react';
import { Cpu, Upload, FileText, Download, Clock, Loader2 } from 'lucide-react';

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
    <header className="bg-white text-slate-900 px-6 py-3 flex items-center justify-between shadow-sm border-b border-slate-200 shrink-0">
      <div className="flex items-center space-x-3">
        <div className="bg-blue-50 p-2 rounded-xl border border-blue-100 shadow-sm">
          <FileText className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center space-x-2">
            <span>PaddleOCR + VietOCR Scanner</span>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-mono px-2 py-0.5 rounded-full border border-emerald-200 font-semibold">
              100% Vietnamese Accuracy
            </span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">Nhận diện Tài liệu Tiếng Việt & Bảng biểu Tài chính Cao cấp</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
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
            <span className="text-[10px] text-amber-700">Đang scan...</span>
          </div>
        )}

        {/* Upload PDF Control Button */}
        <label className={`cursor-pointer font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 transition text-sm ${
          isScanning
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
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
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 text-sm shadow-sm transition"
          >
            <Download className="w-4 h-4" />
            <span>Tải Searchable PDF</span>
          </a>
        )}
      </div>
    </header>
  );
}
