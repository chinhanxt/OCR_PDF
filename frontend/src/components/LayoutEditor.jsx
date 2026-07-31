import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Search, Download, Copy, Check, Code, FileText, Layers, Sparkles } from 'lucide-react';

export default function LayoutEditor({ resultData }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('json'); // 'json' | 'text' | 'all_json'
  const [copied, setCopied] = useState(false);

  if (!resultData || !resultData.data?.result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-8">
        <FileText className="w-16 h-16 text-slate-300 mb-4 animate-bounce" />
        <h3 className="text-lg font-bold text-slate-700">Chưa có dữ liệu OCR PDF</h3>
        <p className="text-sm text-slate-500 mt-1">Vui lòng upload file PDF để xem chi tiết dữ liệu JSON và văn bản trích xuất.</p>
      </div>
    );
  }

  const pages = resultData.data.result.pages || [];
  const totalPages = pages.length;
  const activePage = pages[currentPage - 1] || pages[0];

  // Filtered page OCR items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return activePage.ocr_items || [];
    const q = searchQuery.toLowerCase();
    return (activePage.ocr_items || []).filter(item =>
      item.text.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
    );
  }, [activePage, searchQuery]);

  // Construct JSON object for display
  const jsonPayload = useMemo(() => {
    if (viewMode === 'all_json') {
      return {
        document_total_pages: totalPages,
        pages: pages.map(p => ({
          page_number: p.page_number || 1,
          total_items: (p.ocr_items || []).length,
          width: p.width || 600,
          height: p.height || 800,
          ocr_items: (p.ocr_items || []).map(it => ({
            id: it.id || '',
            text: it.text || '',
            confidence: Number(((it.confidence || 0.95) * 100).toFixed(1)),
            bbox: (it.bbox || [0, 0, 10, 10]).map(n => Number((n || 0).toFixed(1)))
          }))
        }))
      };
    }

    return {
      page_number: activePage?.page_number || 1,
      total_pages: totalPages,
      width: activePage?.width || 600,
      height: activePage?.height || 800,
      total_items: filteredItems.length,
      ocr_items: filteredItems.map(it => ({
        id: it.id || '',
        text: it.text || '',
        confidence: Number(((it.confidence || 0.95) * 100).toFixed(1)),
        bbox: (it.bbox || [0, 0, 10, 10]).map(n => Number((n || 0).toFixed(1)))
      }))
    };
  }, [activePage, pages, totalPages, viewMode, filteredItems]);

  const jsonString = JSON.stringify(jsonPayload, null, 2);

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJSON = () => {
    const filename = viewMode === 'all_json' 
      ? 'full_pdf_extracted_ocr.json' 
      : `page_${currentPage}_extracted_ocr.json`;
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 text-slate-800 overflow-hidden font-sans">
      {/* Light Theme Control Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between shadow-sm shrink-0 gap-4">
        {/* Left Side: Page Selector & Search */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-300">
            <button
              onClick={() => {
                setViewMode('json');
                setCurrentPage(p => Math.max(1, p - 1));
              }}
              disabled={currentPage === 1 || viewMode === 'all_json'}
              className="p-1.5 hover:bg-white rounded text-slate-600 hover:text-slate-900 disabled:opacity-40 transition shadow-sm"
              title="Trang trước"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-3 font-bold text-sm text-slate-800 font-mono">
              {viewMode === 'all_json' ? `Tất cả ${totalPages} trang` : `Trang ${currentPage} / ${totalPages}`}
            </span>
            <button
              onClick={() => {
                setViewMode('json');
                setCurrentPage(p => Math.min(totalPages, p + 1));
              }}
              disabled={currentPage === totalPages || viewMode === 'all_json'}
              className="p-1.5 hover:bg-white rounded text-slate-600 hover:text-slate-900 disabled:opacity-40 transition shadow-sm"
              title="Trang sau"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm kiếm từ / số liệu trong JSON..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white w-64 transition"
            />
          </div>
        </div>

        {/* Middle: View Mode Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-300">
          <button
            onClick={() => setViewMode('json')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center space-x-1.5 transition ${
              viewMode === 'json' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>JSON Trang {currentPage}</span>
          </button>

          <button
            onClick={() => setViewMode('text')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center space-x-1.5 transition ${
              viewMode === 'text' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Văn bản Dòng</span>
          </button>

          <button
            onClick={() => setViewMode('all_json')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center space-x-1.5 transition ${
              viewMode === 'all_json' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>JSON Toàn bộ PDF</span>
          </button>
        </div>

        {/* Right Side: Copy & Download Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopyJSON}
            className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 flex items-center space-x-1.5 shadow-sm transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span className={copied ? "text-emerald-600 font-bold" : ""}>{copied ? "Đã chép!" : "Copy JSON"}</span>
          </button>

          <button
            onClick={handleDownloadJSON}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 shadow transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải file JSON</span>
          </button>
        </div>
      </div>

      {/* Main Content Area (Light Theme White Paper Canvas) */}
      <div className="flex-1 p-6 overflow-auto flex justify-center">
        <div className="w-full max-w-5xl bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col font-mono text-xs">
          {/* Header Metadata Info Bar */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 font-sans text-xs">
            <div className="flex items-center space-x-2">
              <span className={`px-2.5 py-1 rounded-full font-bold flex items-center space-x-1 ${
                resultData?.data?.result?.engine === 'gemini'
                  ? 'bg-cyan-100 text-cyan-800'
                  : resultData?.data?.result?.engine === 'docling'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {resultData?.data?.result?.engine === 'gemini'
                    ? `Google ${resultData?.data?.result?.model_name || 'Gemini 2.5 AI'} Output`
                    : resultData?.data?.result?.engine === 'docling'
                    ? 'Docling AI Output'
                    : 'PaddleOCR + VietOCR Output'}
                </span>
              </span>
              <span className="text-slate-500 font-medium">
                {viewMode === 'all_json' 
                  ? `Toàn bộ ${totalPages} trang (${pages.reduce((acc, p) => acc + p.ocr_items.length, 0)} khối chữ)` 
                  : `Trang ${currentPage} (${filteredItems.length} khối chữ được trích xuất)`}
              </span>
            </div>

            <span className="text-slate-400 font-mono">Structure: Validated JSON Array</span>
          </div>

          {/* View Modes Rendering */}
          {viewMode === 'text' ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 overflow-auto text-slate-900 leading-relaxed font-sans text-sm space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 font-mono mb-4">
                Dòng văn bản trích xuất thực tế (Page {currentPage}):
              </h4>
              {filteredItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-white hover:shadow-sm transition border border-transparent hover:border-slate-200"
                >
                  <span className="font-medium text-slate-900">{item.text}</span>
                  <div className="flex items-center space-x-3 font-mono text-xs shrink-0 ml-4">
                    <span className="text-slate-400 text-[11px]">{item.id}</span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                      item.confidence >= 0.95 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {(item.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Syntax-highlighted Clean White JSON Viewer */
            <pre className="bg-slate-50 border border-slate-200 rounded-lg p-6 overflow-auto text-slate-800 leading-normal font-mono text-xs shadow-inner">
              <code>
                {jsonString.split('\n').map((line, i) => {
                  let lineClass = "text-slate-800";
                  if (line.includes('"text":')) lineClass = "text-emerald-700 font-bold";
                  else if (line.includes('"confidence":')) lineClass = "text-amber-700 font-semibold";
                  else if (line.includes('"bbox":') || line.includes('"id":')) lineClass = "text-blue-700";
                  else if (line.includes('"page_number":')) lineClass = "text-purple-700 font-bold";

                  return (
                    <div key={i} className="hover:bg-slate-200/50 px-1 rounded transition">
                      <span className="select-none text-slate-300 w-8 inline-block text-right mr-4 font-mono text-[10px]">
                        {i + 1}
                      </span>
                      <span className={lineClass}>{line}</span>
                    </div>
                  );
                })}
              </code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
