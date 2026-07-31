import React from 'react';
import { Cpu, Upload, FileText, Download } from 'lucide-react';

export default function Header({ onUpload, isScanning, gpuStatus, resultData }) {
  return (
    <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
      <div className="flex items-center space-x-3">
        <FileText className="w-8 h-8 text-blue-400" />
        <div>
          <h1 className="text-xl font-bold">PaddleOCR High-Precision PDF Scanner</h1>
          <p className="text-xs text-slate-400">Vietnamese Document & Financial Table Recognition</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 text-xs">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span>GPU: {gpuStatus?.gpu_available ? 'RTX 3050 (CUDA Active)' : 'CPU Mode'}</span>
        </div>

        <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-lg flex items-center space-x-2 transition">
          <Upload className="w-4 h-4" />
          <span>{isScanning ? 'Processing...' : 'Upload PDF'}</span>
          <input type="file" accept=".pdf" onChange={onUpload} disabled={isScanning} className="hidden" />
        </label>

        {resultData && (
          <a
            href={`http://localhost:8000${resultData.searchable_url}`}
            download
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg flex items-center space-x-2 transition"
          >
            <Download className="w-4 h-4" />
            <span>Download Searchable PDF</span>
          </a>
        )}
      </div>
    </header>
  );
}
