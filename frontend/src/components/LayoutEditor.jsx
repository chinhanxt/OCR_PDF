import React, { useState } from 'react';

export default function LayoutEditor({ resultData }) {
  const [hoveredBox, setHoveredBox] = useState(null);
  const [selectedBox, setSelectedBox] = useState(null);

  if (!resultData || !resultData.data?.result) return null;

  const pages = resultData.data.result.pages;
  const activePage = pages[0];

  return (
    <div className="flex-1 flex bg-slate-900 text-white p-6 overflow-hidden">
      <div className="w-1/2 bg-slate-950 rounded-xl p-4 overflow-auto relative border border-slate-800 flex justify-center">
        <div className="relative inline-block" style={{ width: `${activePage.width}px`, height: `${activePage.height}px` }}>
          <img
            src={`http://localhost:8000/storage/pages/${activePage.image_path.split('/').slice(-2).join('/')}`}
            alt="Page Layout"
            className="w-full h-full opacity-60"
          />

          {activePage.ocr_items.map((item) => {
            const [x0, y0, x1, y1] = item.bbox;
            const isHovered = hoveredBox === item.id;
            return (
              <div
                key={item.id}
                onMouseEnter={() => setHoveredBox(item.id)}
                onMouseLeave={() => setHoveredBox(null)}
                onClick={() => setSelectedBox(item)}
                style={{
                  position: 'absolute',
                  left: `${x0}px`,
                  top: `${y0}px`,
                  width: `${x1 - x0}px`,
                  height: `${y1 - y0}px`,
                }}
                className={`border text-[10px] leading-none px-0.5 truncate cursor-pointer transition ${
                  isHovered ? 'bg-blue-500/40 border-blue-400 text-white z-20 scale-105' : 'border-amber-400/50 bg-amber-400/10 text-amber-200'
                }`}
                title={`${item.text} (${(item.confidence * 100).toFixed(1)}%)`}
              >
                {item.text}
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-1/2 ml-6 bg-slate-800 rounded-xl p-6 flex flex-col border border-slate-700 overflow-hidden">
        <h2 className="text-lg font-bold mb-4 flex items-center justify-between">
          <span>Chi tiết Văn bản & Bảng biểu</span>
          <span className="text-xs font-normal text-slate-400">{activePage.ocr_items.length} Khối chữ</span>
        </h2>

        <div className="flex-1 overflow-auto space-y-2 pr-2">
          {activePage.ocr_items.map((item) => (
            <div
              key={item.id}
              onMouseEnter={() => setHoveredBox(item.id)}
              onMouseLeave={() => setHoveredBox(null)}
              className={`p-3 rounded-lg border text-sm transition cursor-pointer ${
                hoveredBox === item.id ? 'bg-blue-900/50 border-blue-500' : 'bg-slate-900 border-slate-700'
              }`}
            >
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Box ID: {item.id}</span>
                <span className="text-emerald-400 font-mono">{(item.confidence * 100).toFixed(1)}%</span>
              </div>
              <p className="font-medium text-slate-100">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
