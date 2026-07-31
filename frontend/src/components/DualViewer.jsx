import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Link, Unlink, ExternalLink, Layers, Eye } from 'lucide-react';

export default function DualViewer({ resultData }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [syncScroll, setSyncScroll] = useState(true);
  const [rightViewMode, setRightViewMode] = useState('overlay'); // 'overlay' | 'pdf'

  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const isSyncingLeft = useRef(false);
  const isSyncingRight = useRef(false);

  const handleLeftScroll = () => {
    if (!syncScroll || !leftRef.current || !rightRef.current) return;
    if (isSyncingRight.current) {
      isSyncingRight.current = false;
      return;
    }
    isSyncingLeft.current = true;
    rightRef.current.scrollTop = leftRef.current.scrollTop;
    rightRef.current.scrollLeft = leftRef.current.scrollLeft;
  };

  const handleRightScroll = () => {
    if (!syncScroll || !leftRef.current || !rightRef.current) return;
    if (isSyncingLeft.current) {
      isSyncingLeft.current = false;
      return;
    }
    isSyncingRight.current = true;
    leftRef.current.scrollTop = rightRef.current.scrollTop;
    leftRef.current.scrollLeft = rightRef.current.scrollLeft;
  };

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

  const imgSubPath = activePage?.image_path ? activePage.image_path.split('/').slice(-2).join('/') : '';
  const pageImgUrl = `http://localhost:8000/storage/pages/${imgSubPath}`;
  const pdfUrl = `http://localhost:8000${resultData.data.searchable_url}#page=${currentPage}&toolbar=0&navpanes=0&scrollbar=0&view=FitH`;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Control Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-2.5 flex items-center justify-between text-white text-sm shrink-0">
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-3 font-semibold text-sm text-blue-400">Trang {currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white disabled:opacity-40 transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center space-x-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button
              onClick={() => setRightViewMode('overlay')}
              className={`px-3 py-1 text-xs font-semibold rounded flex items-center space-x-1 transition ${
                rightViewMode === 'overlay' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Chế độ Lớp Text Chuẩn 1:1</span>
            </button>
            <button
              onClick={() => setRightViewMode('pdf')}
              className={`px-3 py-1 text-xs font-semibold rounded flex items-center space-x-1 transition ${
                rightViewMode === 'pdf' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Viewer PDF</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSyncScroll(!syncScroll)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              syncScroll ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {syncScroll ? <Link className="w-3.5 h-3.5 text-blue-400" /> : <Unlink className="w-3.5 h-3.5" />}
            <span>Đồng bộ Cuộn 1-vs-1 {syncScroll ? '(Đang bật)' : '(Đang tắt)'}</span>
          </button>

          <div className="flex items-center space-x-1 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
            <button onClick={() => setZoom(z => Math.max(60, z - 15))} className="p-1 hover:bg-slate-700 rounded text-slate-300">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono w-12 text-center text-slate-200">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(250, z + 15))} className="p-1 hover:bg-slate-700 rounded text-slate-300">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition"
            title="Mở PDF cửa sổ riêng"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* 1-vs-1 Large Split Viewer */}
      <div className="flex-1 grid grid-cols-2 gap-3 p-3 overflow-hidden">
        {/* Left Side: Original Scan Image */}
        <div
          ref={leftRef}
          onScroll={handleLeftScroll}
          className="bg-slate-900 rounded-xl p-3 overflow-auto flex flex-col items-center border border-slate-800 shadow-inner"
        >
          <div className="w-full flex justify-between items-center mb-2 px-2 shrink-0 sticky top-0 bg-slate-900/90 backdrop-blur z-20 py-1 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trang PDF Gốc (Original Scan)</span>
            <span className="text-[10px] text-slate-500 font-mono">{activePage.width}x{activePage.height} pt</span>
          </div>
          <div className="w-full flex justify-center items-start">
            <img
              src={pageImgUrl}
              alt={`Original Page ${currentPage}`}
              style={{ width: `${zoom}%`, maxWidth: 'none' }}
              className="shadow-2xl rounded border border-slate-800 transition-all duration-150"
            />
          </div>
        </div>

        {/* Right Side: Scan Overlay / Searchable Layer (Clean 1:1 Match) */}
        <div
          ref={rightRef}
          onScroll={handleRightScroll}
          className="bg-slate-900 rounded-xl p-3 overflow-auto flex flex-col items-center border border-slate-800 shadow-inner"
        >
          <div className="w-full flex justify-between items-center mb-2 px-2 shrink-0 sticky top-0 bg-slate-900/90 backdrop-blur z-20 py-1 border-b border-slate-800">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Trang sau khi Scan (Searchable OCR Layer)</span>
            <span className="text-[10px] text-emerald-400 font-medium">✨ 100% Khớp vị trí Bbox</span>
          </div>
          <div className="w-full flex justify-center items-start">
            {rightViewMode === 'overlay' ? (
              <div
                className="relative shadow-2xl rounded border border-slate-700 bg-white transition-all duration-150 overflow-hidden"
                style={{
                  width: `${zoom}%`,
                  aspectRatio: `${activePage.width} / ${activePage.height}`
                }}
              >
                {/* Background high-res clean image */}
                <img
                  src={pageImgUrl}
                  alt={`Scanned Page ${currentPage}`}
                  className="w-full h-full object-contain"
                />

                {/* Exact Bounding Box Text Overlay */}
                {activePage.ocr_items.map((item) => {
                  const [x0, y0, x1, y1] = item.bbox;
                  const leftPct = (x0 / activePage.width) * 100;
                  const topPct = (y0 / activePage.height) * 100;
                  const widthPct = ((x1 - x0) / activePage.width) * 100;
                  const heightPct = ((y1 - y0) / activePage.height) * 100;

                  return (
                    <div
                      key={item.id}
                      style={{
                        position: 'absolute',
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                      }}
                      className="group border border-blue-400/20 hover:border-blue-500 bg-blue-500/5 hover:bg-blue-500/20 cursor-text select-text transition rounded-xs flex items-center"
                      title={`${item.text} (${(item.confidence * 100).toFixed(1)}%)`}
                    >
                      <span className="opacity-0 group-hover:opacity-100 text-[9px] font-mono bg-blue-600 text-white px-1 py-0.5 rounded absolute -top-4 left-0 z-30 pointer-events-none shadow">
                        {item.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <iframe
                src={pdfUrl}
                title="Searchable PDF Preview"
                style={{ width: `${zoom}%`, height: '100%', minHeight: '800px' }}
                className="rounded border border-slate-700 bg-white"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


