import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Link, Unlink } from 'lucide-react';

export default function DualViewer({ resultData }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [syncScroll, setSyncScroll] = useState(true);

  if (!resultData || !resultData.data?.result) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-500">
        Upload a PDF file to preview 1-vs-1 comparison
      </div>
    );
  }

  const pages = resultData.data.result.pages;
  const totalPages = pages.length;
  const activePage = pages[currentPage - 1];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900">
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between text-white text-sm">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 hover:bg-slate-700 rounded disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span>Trang {currentPage} / {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1 hover:bg-slate-700 rounded disabled:opacity-50"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSyncScroll(!syncScroll)}
            className={`flex items-center space-x-1 px-3 py-1 rounded text-xs border ${
              syncScroll ? 'bg-blue-600 border-blue-500' : 'bg-slate-700 border-slate-600'
            }`}
          >
            {syncScroll ? <Link className="w-3.5 h-3.5" /> : <Unlink className="w-3.5 h-3.5" />}
            <span>Sync Viewer</span>
          </button>

          <div className="flex items-center space-x-1">
            <button onClick={() => setZoom(z => Math.max(50, z - 20))} className="p-1 hover:bg-slate-700 rounded">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs w-12 text-center">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(200, z + 20))} className="p-1 hover:bg-slate-700 rounded">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-2 p-4 overflow-hidden">
        <div className="bg-slate-950 rounded-lg p-4 overflow-auto flex flex-col items-center border border-slate-800">
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Trang Gốc (Original Scan)</h3>
          {activePage && (
            <img
              src={`http://localhost:8000/storage/pages/${activePage.image_path.split('/').slice(-2).join('/')}`}
              alt={`Original Page ${currentPage}`}
              style={{ width: `${zoom}%` }}
              className="shadow-2xl rounded transition-all"
            />
          )}
        </div>

        <div className="bg-slate-950 rounded-lg p-4 overflow-auto flex flex-col items-center border border-slate-800">
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Searchable PDF (Lớp Text 100% Khớp)</h3>
          <iframe
            src={`http://localhost:8000${resultData.data.searchable_url}#page=${currentPage}`}
            title="Searchable PDF Preview"
            style={{ width: `${zoom}%`, height: '100%' }}
            className="rounded border border-slate-700 bg-white"
          />
        </div>
      </div>
    </div>
  );
}
