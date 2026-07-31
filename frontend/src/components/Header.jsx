import React, { useState, useEffect } from 'react';
import { Cpu, Upload, FileText, Download, Clock, Loader2, Sparkles, Layers, CheckCircle2, Bot, Key, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { testGeminiApiKey } from '../api';

export default function Header({
  onUpload,
  isScanning,
  gpuStatus,
  resultData,
  selectedEngine,
  setSelectedEngine,
  geminiApiKey,
  setGeminiApiKey,
  geminiModel,
  setGeminiModel
}) {
  const [seconds, setSeconds] = useState(0);
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Key Testing state
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState(null); // { status: 'ok' | 'error', message: string }

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

  const getData = () => {
    if (!resultData) return null;
    return resultData.data || resultData;
  };

  const getDocxUrl = () => {
    const data = getData();
    if (!data) return '#';
    if (data.docx_url) return `http://localhost:8000${data.docx_url}`;
    if (data.searchable_url) {
      const fallback = data.searchable_url.replace('_searchable.pdf', '_result.docx').replace('.pdf', '.docx');
      return `http://localhost:8000${fallback}`;
    }
    return '#';
  };

  const getPdfUrl = () => {
    const data = getData();
    if (!data) return '#';
    if (data.searchable_url) return `http://localhost:8000${data.searchable_url}`;
    return '#';
  };

  const handleTestKey = async () => {
    if (!geminiApiKey.trim()) {
      setTestResult({ status: 'error', message: 'Vui lòng nhập API Key trước khi thử kết nối!' });
      return;
    }
    setIsTestingKey(true);
    setTestResult(null);
    try {
      const res = await testGeminiApiKey(geminiApiKey.trim(), geminiModel);
      setTestResult(res);
    } catch (err) {
      setTestResult({
        status: 'error',
        message: 'Không thể kết nối đến backend server để test key: ' + err.message
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  return (
    <header className="bg-white text-slate-900 px-6 py-3 flex flex-wrap items-center justify-between shadow-sm border-b border-slate-200 shrink-0 gap-4">
      <div className="flex items-center space-x-3">
        <div className="bg-blue-50 p-2 rounded-xl border border-blue-100 shadow-sm">
          <FileText className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center space-x-2">
            <span>Tri-Engine PDF Scanner</span>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-mono px-2 py-0.5 rounded-full border border-emerald-200 font-semibold flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>+ VietOCR & Gemini 2.5 AI</span>
            </span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">PaddleOCR, Docling AI & Google Gemini 2.5 Multimodal OCR</p>
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
            <span>Mode 1: PaddleOCR</span>
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
            <span>Mode 2: Docling AI</span>
          </button>

          <button
            onClick={() => setSelectedEngine('gemini')}
            disabled={isScanning}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center space-x-1.5 transition ${
              selectedEngine === 'gemini'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Mode 3: Gemini 2.5 AI</span>
          </button>
        </div>

        {/* Gemini Configuration bar when Mode 3 is selected */}
        {selectedEngine === 'gemini' && (
          <div className="flex items-center space-x-2 bg-cyan-50 border border-cyan-200 px-3 py-1 rounded-xl text-xs">
            <select
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value)}
              disabled={isScanning}
              className="bg-white border border-cyan-300 rounded px-2 py-1 font-mono font-bold text-cyan-900 focus:outline-none text-xs shadow-xs"
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Ultra Fast)</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            </select>

            <button
              onClick={() => {
                setShowKeyInput(!showKeyInput);
                setTestResult(null);
              }}
              className="flex items-center space-x-1 bg-white hover:bg-cyan-100 border border-cyan-300 px-2 py-1 rounded text-cyan-800 font-bold transition shadow-xs"
              title="Nhập & kiểm tra Gemini API Key"
            >
              <Key className="w-3.5 h-3.5 text-cyan-600" />
              <span>{geminiApiKey ? '🔑 API Key (Đã cấu hình)' : '⚠️ Cấu hình API Key'}</span>
            </button>
          </div>
        )}

        {/* Modal/Input overlay for Gemini API Key */}
        {showKeyInput && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 relative">
              <div className="flex items-center space-x-2 mb-2 text-cyan-800 font-bold text-base">
                <Key className="w-5 h-5 text-cyan-600" />
                <span>Cấu Hình & Kiểm Tra Google Gemini API Key</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Nhập Gemini API Key của bạn bên dưới. Bạn có thể bấm nút <b>"🧪 Kiểm tra Key"</b> để xác thực trực tiếp với server Google Gemini.
              </p>

              <div className="mb-4">
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={geminiApiKey}
                  onChange={(e) => {
                    setGeminiApiKey(e.target.value);
                    setTestResult(null);
                  }}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              {/* Test Key Result Notice Display */}
              {testResult && (
                <div className={`p-3 rounded-lg text-xs font-semibold mb-4 flex items-start space-x-2 border ${
                  testResult.status === 'ok'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {testResult.status === 'ok' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex justify-between items-center space-x-2 pt-2 border-t border-slate-100">
                {/* Button Test Key */}
                <button
                  onClick={handleTestKey}
                  disabled={isTestingKey || !geminiApiKey.trim()}
                  className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold px-3.5 py-2 rounded-lg text-xs flex items-center space-x-1.5 shadow transition"
                >
                  {isTestingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>{isTestingKey ? 'Đang test...' : '🧪 Kiểm tra Key'}</span>
                </button>

                <button
                  onClick={() => setShowKeyInput(false)}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-4 py-2 rounded-lg text-xs shadow transition"
                >
                  Lưu & Đóng
                </button>
              </div>
            </div>
          </div>
        )}

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
            <span className="text-[10px] text-amber-700">Đang quét...</span>
          </div>
        )}

        {/* Upload PDF Control Button */}
        <label className={`cursor-pointer font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 transition text-sm ${
          isScanning
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            : selectedEngine === 'gemini'
            ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm'
            : selectedEngine === 'docling'
            ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
        }`}>
          {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          <span>
            {isScanning
              ? `Đang xử lý (${formatTimer(seconds)})`
              : `Upload PDF (${selectedEngine === 'gemini' ? 'Gemini 2.5' : selectedEngine === 'docling' ? 'Docling+VietOCR' : 'Paddle+VietOCR'})`}
          </span>
          <input type="file" accept=".pdf" onChange={onUpload} disabled={isScanning} className="hidden" />
        </label>

        {/* Download Action Buttons */}
        {resultData && !isScanning && (
          <div className="flex items-center space-x-2">
            <a
              href={getDocxUrl()}
              download="scan_result.docx"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg flex items-center space-x-2 text-sm shadow-md transition cursor-pointer"
            >
              <FileText className="w-4 h-4 text-blue-100" />
              <span>📝 Tải File Word (.docx)</span>
            </a>

            <a
              href={getPdfUrl()}
              download="scan_result.pdf"
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-lg flex items-center space-x-1 text-xs border border-slate-300 transition cursor-pointer"
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
