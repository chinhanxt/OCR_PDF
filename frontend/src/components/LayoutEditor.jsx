import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Download, Edit3, CheckCircle2 } from 'lucide-react';

export default function LayoutEditor({ resultData }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredBox, setHoveredBox] = useState(null);
  const [selectedBox, setSelectedBox] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editedItems, setEditedItems] = useState({});

  if (!resultData || !resultData.data?.result) return null;

  const pages = resultData.data.result.pages;
  const totalPages = pages.length;
  const activePage = pages[currentPage - 1] || pages[0];

  const items = activePage.ocr_items || [];
  const filteredItems = items.filter(item =>
    item.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTextChange = (id, newText) => {
    setEditedItems(prev => ({ ...prev, [id]: newText }));
  };

  const getItemText = (item) => {
    return editedItems[item.id] !== undefined ? editedItems[item.id] : item.text;
  };

  const exportPageDataJSON = () => {
    const dataToExport = items.map(item => ({
      id: item.id,
      text: getItemText(item),
      confidence: item.confidence,
      bbox: item.bbox
    }));
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `page_${currentPage}_extracted_data.json`;
    a.click();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header Controls for Interactive Layout */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-4">
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

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm kiếm từ / số liệu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-64"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs text-slate-400 font-medium">Tổng số khối: <strong className="text-blue-400">{items.length}</strong></span>
          <button
            onClick={exportPageDataJSON}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 flex items-center space-x-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất JSON Trang {currentPage}</span>
          </button>
        </div>
      </div>

      {/* Main Layout Area */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left Side: Clean Document Canvas (No PDF Background, Exact Field Boxes) */}
        <div className="flex-1 bg-slate-900 rounded-xl p-4 overflow-auto border border-slate-800 flex justify-center items-start shadow-inner">
          <div
            className="relative bg-white rounded shadow-2xl border border-slate-300 transition-all my-auto"
            style={{
              width: `${activePage.width * 1.25}px`,
              height: `${activePage.height * 1.25}px`,
            }}
          >
            {/* Grid Lines Pattern for Document Alignment */}
            <div
              className="absolute inset-0 pointer-events-none opacity-5"
              style={{
                backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}
            />

            {/* Structured Input Fields matching Exact Bounding Boxes */}
            {items.map((item) => {
              const [x0, y0, x1, y1] = item.bbox;
              const leftPct = (x0 / activePage.width) * 100;
              const topPct = (y0 / activePage.height) * 100;
              const widthPct = ((x1 - x0) / activePage.width) * 100;
              const heightPct = ((y1 - y0) / activePage.height) * 100;

              const isHovered = hoveredBox === item.id;
              const isSelected = selectedBox?.id === item.id;
              const currentText = getItemText(item);

              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setHoveredBox(item.id)}
                  onMouseLeave={() => setHoveredBox(null)}
                  onClick={() => setSelectedBox(item)}
                  style={{
                    position: 'absolute',
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                  }}
                  className={`group border transition rounded-sm p-0.5 flex items-center justify-between ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50 text-blue-900 z-30 ring-2 ring-blue-500/50'
                      : isHovered
                      ? 'border-amber-500 bg-amber-50 text-slate-900 z-20 shadow'
                      : 'border-slate-300 bg-slate-50/90 text-slate-800 hover:border-slate-400'
                  }`}
                >
                  <input
                    type="text"
                    value={currentText}
                    onChange={(e) => handleTextChange(item.id, e.target.value)}
                    className="w-full bg-transparent border-none focus:outline-none text-[11px] font-sans text-slate-900 leading-tight px-1 font-medium truncate"
                    title={`Box ID: ${item.id} (${(item.confidence * 100).toFixed(1)}%)`}
                  />
                  <span className="opacity-0 group-hover:opacity-100 text-[8px] font-mono text-slate-400 shrink-0 px-0.5">
                    {(item.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Structured Data & Field List */}
        <div className="w-96 bg-slate-900 rounded-xl border border-slate-800 flex flex-col overflow-hidden shadow-lg">
          <div className="p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
            <h3 className="font-bold text-sm text-slate-200 flex items-center space-x-2">
              <Edit3 className="w-4 h-4 text-blue-400" />
              <span>Danh sách Trường dữ liệu</span>
            </h3>
            <span className="text-xs font-mono text-blue-400 font-bold">Trang {currentPage}</span>
          </div>

          <div className="flex-1 overflow-auto p-3 space-y-2">
            {filteredItems.map((item) => {
              const isHovered = hoveredBox === item.id;
              const isSelected = selectedBox?.id === item.id;
              const currentText = getItemText(item);

              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setHoveredBox(item.id)}
                  onMouseLeave={() => setHoveredBox(null)}
                  onClick={() => setSelectedBox(item)}
                  className={`p-3 rounded-lg border text-xs transition cursor-pointer ${
                    isSelected
                      ? 'bg-blue-950 border-blue-500 shadow-md ring-1 ring-blue-500'
                      : isHovered
                      ? 'bg-slate-800 border-slate-600'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1 font-mono">
                    <span className="text-slate-400 font-semibold">{item.id}</span>
                    <div className="flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">{(item.confidence * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={currentText}
                    onChange={(e) => handleTextChange(item.id, e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-medium focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

