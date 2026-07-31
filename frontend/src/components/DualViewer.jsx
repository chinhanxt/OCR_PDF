import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Link, Unlink, ExternalLink, Layers, Eye, FileText, CheckCircle2, Sparkles } from 'lucide-react';

export default function DualViewer({ resultData }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [syncScroll, setSyncScroll] = useState(true);
  const [rightViewMode, setRightViewMode] = useState('bboxes'); // 'bboxes' | 'digital' | 'pdf'
  const [hoveredBoxId, setHoveredBoxId] = useState(null);

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
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400 font-sans">
        Vui lòng tải lên file PDF để xem màn hình đối xứng 1-vs-1
      </div>
    );
  }

  const pages = resultData.data.result.pages || [];
  const totalPages = pages.length;
  const activePage = pages[currentPage - 1] || pages[0] || { ocr_items: [], width: 600, height: 800 };
  const ocrItems = activePage.ocr_items || [];
  const engineMode = resultData.data.result.engine || 'paddleocr';
  const isGeminiMode = engineMode === 'gemini';
  const isDoclingMode = engineMode === 'docling';

  const imgSubPath = activePage?.image_path ? activePage.image_path.split('/').slice(-2).join('/') : '';
  const pageImgUrl = `http://localhost:8000/storage/pages/${imgSubPath}`;
  const pdfUrl = `http://localhost:8000${resultData.data.searchable_url}#page=${currentPage}&toolbar=0&navpanes=0&scrollbar=0&view=FitH`;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden font-sans">
      {/* Control Bar (Light Theme) */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-slate-800 text-sm shrink-0 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-300">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 hover:bg-white rounded text-slate-600 hover:text-slate-900 disabled:opacity-40 transition shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-3 font-bold text-sm text-blue-700 font-mono">Trang {currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 hover:bg-white rounded text-slate-600 hover:text-slate-900 disabled:opacity-40 transition shadow-sm"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Right Side View Mode Selector */}
          <div className="flex items-center space-x-1 bg-slate-100 rounded-lg p-1 border border-slate-300">
            <button
              onClick={() => setRightViewMode('bboxes')}
              className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center space-x-1.5 transition ${
                rightViewMode === 'bboxes' ? 'bg-blue-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Bố cục Tờ Giấy Kĩ thuật số ({ocrItems.length} Khối chữ)</span>
            </button>

            <button
              onClick={() => setRightViewMode('digital')}
              className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center space-x-1.5 transition ${
                rightViewMode === 'digital' ? 'bg-blue-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Văn bản Dòng</span>
            </button>

            <button
              onClick={() => setRightViewMode('pdf')}
              className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center space-x-1.5 transition ${
                rightViewMode === 'pdf' ? 'bg-blue-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Searchable PDF</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSyncScroll(!syncScroll)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition shadow-sm ${
              syncScroll ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-300 text-slate-500'
            }`}
          >
            {syncScroll ? <Link className="w-3.5 h-3.5 text-blue-600" /> : <Unlink className="w-3.5 h-3.5" />}
            <span>Đồng bộ Cuộn 1-vs-1 {syncScroll ? '(Đang bật)' : '(Đang tắt)'}</span>
          </button>

          <div className="flex items-center space-x-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-300 shadow-sm">
            <button onClick={() => setZoom(z => Math.max(60, z - 15))} className="p-1 hover:bg-white rounded text-slate-600">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-bold w-12 text-center text-slate-700">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(250, z + 15))} className="p-1 hover:bg-white rounded text-slate-600">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 bg-slate-50 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg border border-slate-300 shadow-sm transition"
            title="Mở PDF cửa sổ riêng"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* 1-vs-1 Large Split Viewer (Light Theme) */}
      <div className="flex-1 grid grid-cols-2 gap-3 p-3 overflow-hidden">
        {/* Left Side: Original Scan Image */}
        <div
          ref={leftRef}
          onScroll={handleLeftScroll}
          className="bg-white rounded-xl p-3 overflow-auto flex flex-col items-center border border-slate-200 shadow-sm relative"
        >
          <div className="w-full flex justify-between items-center mb-2 px-2 shrink-0 sticky top-0 bg-white/90 backdrop-blur z-20 py-1.5 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Trang PDF Gốc (Original Scan)</span>
            <span className="text-[10px] text-slate-400 font-mono">{activePage.width || 600}x{activePage.height || 800} pt</span>
          </div>
          <div className="w-full flex justify-center items-start">
            <img
              src={pageImgUrl}
              alt={`Original Page ${currentPage}`}
              style={{ width: `${zoom}%`, maxWidth: 'none' }}
              className="shadow-lg rounded border border-slate-200 transition-all duration-150"
            />
          </div>
        </div>

        {/* Right Side: Clean Digital Extracted Document (No Original Image Background) */}
        <div
          ref={rightRef}
          onScroll={handleRightScroll}
          className="bg-slate-50 rounded-xl p-3 overflow-auto flex flex-col items-center border border-slate-200 shadow-sm relative"
        >
          <div className="w-full flex justify-between items-center mb-2 px-2 shrink-0 sticky top-0 bg-white/90 backdrop-blur z-20 py-1.5 border-b border-slate-200 rounded-t-lg shadow-xs">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-cyan-600" />
              <span>
                {isGeminiMode ? `Kết quả Quét Gemini 2.5 AI (${resultData.data.result.model_name || 'gemini-2.5-flash'})` : isDoclingMode ? 'Kết quả Bóc tách Docling AI' : 'Kết quả OCR PaddleOCR GPU'}
              </span>
            </span>
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Đã bóc tách {ocrItems.length} khối chữ</span>
            </span>
          </div>

          <div className="w-full flex justify-center items-start py-2">
            {rightViewMode === 'bboxes' && (
              /* CLEAN WHITE DIGITAL PAPER SHEET CANVAS - NO ORIGINAL SCAN IMAGE BACKGROUND */
              <div
                className="relative shadow-xl rounded-lg border border-slate-300 bg-white transition-all duration-150 overflow-hidden"
                style={{
                  width: `${zoom}%`,
                  aspectRatio: `${activePage.width || 600} / ${activePage.height || 800}`,
                  boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                }}
              >
                {/* Subtle paper background grid pattern */}
                <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

                {/* RENDER ACTUAL EXTRACTED TEXT BLOCKS DIRECTLY ON THE DIGITAL PAPER */}
                {ocrItems.map((item) => {
                  const bbox = item.bbox || [0, 0, 10, 10];
                  const [x0, y0, x1, y1] = bbox;
                  const pageWidth = activePage.width || 600;
                  const pageHeight = activePage.height || 800;
                  const leftPct = (x0 / pageWidth) * 100;
                  const topPct = (y0 / pageHeight) * 100;
                  const widthPct = Math.max(1.0, ((x1 - x0) / pageWidth) * 100);
                  const heightPct = Math.max(1.0, ((y1 - y0) / pageHeight) * 100);
                  const isHovered = hoveredBoxId === item.id;

                  return (
                    <div
                      key={item.id}
                      onMouseEnter={() => setHoveredBoxId(item.id)}
                      onMouseLeave={() => setHoveredBoxId(null)}
                      style={{
                        position: 'absolute',
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                      }}
                      className={`transition-all cursor-pointer rounded-xs flex items-center px-1 overflow-hidden border ${
                        isHovered
                          ? 'border-emerald-500 bg-emerald-100 z-30 ring-2 ring-emerald-400 scale-[1.01] shadow-md'
                          : isGeminiMode
                          ? 'border-cyan-200/80 bg-cyan-50/70 hover:border-cyan-400 hover:bg-cyan-100/90'
                          : isDoclingMode
                          ? 'border-purple-200/80 bg-purple-50/70 hover:border-purple-400 hover:bg-purple-100/90'
                          : 'border-blue-200/80 bg-blue-50/70 hover:border-blue-400 hover:bg-blue-100/90'
                      }`}
                      title={`${item.text} (${((item.confidence || 0.95) * 100).toFixed(1)}%)`}
                    >
                      {/* RENDER ACTUAL TEXT CONTENT ON DIGITAL SHEET */}
                      <span className="text-[11px] font-sans font-medium text-slate-900 leading-tight whitespace-nowrap overflow-hidden text-ellipsis select-text">
                        {item.text}
                      </span>

                      {/* Tooltip preview on hover */}
                      {isHovered && (
                        <span className="text-[10px] font-mono leading-none px-2 py-1 rounded absolute -top-7 left-0 z-40 bg-slate-900 text-white font-bold shadow-lg whitespace-nowrap">
                          {item.text} ({(item.confidence * 100).toFixed(0)}%)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {rightViewMode === 'digital' && (
              <div
                className="bg-white rounded-xl border border-slate-300 p-8 shadow-xl text-slate-800 space-y-3 font-sans overflow-auto"
                style={{ width: `${zoom}%`, minHeight: '800px' }}
              >
                <div className="border-b border-slate-200 pb-3 mb-4 flex justify-between items-center">
                  <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wide flex items-center space-x-1.5">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Văn bản Kĩ thuật số Được Bóc Tách (Trang {currentPage})</span>
                  </h4>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-bold">
                    {ocrItems.length} Khối chữ
                  </span>
                </div>

                <div className="space-y-2">
                  {ocrItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3 bg-slate-50 hover:bg-cyan-50/50 border border-slate-200 hover:border-cyan-300 rounded-lg transition text-sm flex items-start justify-between shadow-2xs"
                    >
                      <span className="font-medium text-slate-900 leading-relaxed font-sans">{item.text}</span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-3 bg-white px-2 py-0.5 rounded border border-slate-200 font-semibold">
                        {((item.confidence || 0.95) * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rightViewMode === 'pdf' && (
              <iframe
                src={pdfUrl}
                title="Searchable PDF Preview"
                style={{ width: `${zoom}%`, height: '100%', minHeight: '800px' }}
                className="rounded-xl border border-slate-200 bg-white shadow-xl"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
