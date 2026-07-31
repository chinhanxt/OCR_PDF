import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DualViewer from './components/DualViewer';
import LayoutEditor from './components/LayoutEditor';
import { checkStatus, startPDFScan, getTaskStatus } from './api';
import { Loader2, Clock, Cpu, Sparkles, Layers, Bot } from 'lucide-react';

export default function App() {
  const [gpuStatus, setGpuStatus] = useState(null);
  const [selectedEngine, setSelectedEngine] = useState('paddleocr'); // 'paddleocr' | 'docling' | 'gemini'
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [isScanning, setIsScanning] = useState(false);
  const [taskProgress, setTaskProgress] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [activeTab, setActiveTab] = useState('viewer');
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    checkStatus().then(setGpuStatus).catch(console.error);
  }, []);

  useEffect(() => {
    if (geminiApiKey) {
      localStorage.setItem('gemini_api_key', geminiApiKey);
    }
  }, [geminiApiKey]);

  useEffect(() => {
    let timer = null;
    if (isScanning) {
      setElapsedSec(0);
      timer = setInterval(() => {
        setElapsedSec(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [isScanning]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (selectedEngine === 'gemini' && !geminiApiKey.trim()) {
      alert("⚠️ Vui lòng nhập Gemini API Key trước khi thực hiện scan Mode 3!");
      return;
    }

    setIsScanning(true);
    setResultData(null);
    setTaskProgress({ status: 'processing', current_page: 0, total_pages: 1, progress_percent: 0, engine: selectedEngine });

    try {
      const scanRes = await startPDFScan(file, selectedEngine, geminiApiKey, geminiModel);
      const taskId = scanRes.task_id;

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await getTaskStatus(taskId);
          setTaskProgress(statusRes);

          if (statusRes.status === 'completed') {
            clearInterval(pollInterval);
            setResultData({ data: statusRes });
            setIsScanning(false);
          } else if (statusRes.status === 'failed') {
            clearInterval(pollInterval);
            setIsScanning(false);
            alert(`Lỗi khi scan PDF (${selectedEngine.toUpperCase()}): ` + (statusRes.error || "Unknown error"));
          }
        } catch (err) {
          console.error("Polling error:", err);
          clearInterval(pollInterval);
          setIsScanning(false);
          alert("Tiến trình scan bị ngắt kết nối hoặc server đã khởi động lại. Vui lòng bấm Upload để thử lại!");
        }

      }, 800);

    } catch (err) {
      alert("Lỗi khi tải file PDF: " + err.message);
      setIsScanning(false);
    }
  };

  const formatSec = (s) => {
    const mins = Math.floor(s / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 font-sans overflow-hidden relative text-slate-900">
      <Header
        onUpload={handleFileUpload}
        isScanning={isScanning}
        gpuStatus={gpuStatus}
        resultData={resultData}
        selectedEngine={selectedEngine}
        setSelectedEngine={setSelectedEngine}
        geminiApiKey={geminiApiKey}
        setGeminiApiKey={setGeminiApiKey}
        geminiModel={geminiModel}
        setGeminiModel={setGeminiModel}
      />

      {/* Tab Navigation (Light Theme) */}
      <div className="flex border-b border-slate-200 bg-white px-6 shrink-0 shadow-xs">
        <button
          onClick={() => setActiveTab('viewer')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition ${
            activeTab === 'viewer' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Màn hình Đối xứng 1-vs-1
        </button>
        <button
          onClick={() => setActiveTab('layout')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition ${
            activeTab === 'layout' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Interactive Layout & Dữ liệu JSON OCR ({selectedEngine === 'gemini' ? 'Gemini 2.5 AI' : selectedEngine === 'docling' ? 'Docling AI' : 'PaddleOCR'})
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col relative">
        {/* Real-Time Processing Progress Modal */}
        {isScanning && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div className={`w-20 h-20 border rounded-2xl flex items-center justify-center animate-pulse ${
                  selectedEngine === 'gemini'
                    ? 'bg-cyan-50 border-cyan-200'
                    : selectedEngine === 'docling'
                    ? 'bg-purple-50 border-purple-200'
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <Loader2 className={`w-10 h-10 animate-spin ${
                    selectedEngine === 'gemini'
                      ? 'text-cyan-600'
                      : selectedEngine === 'docling'
                      ? 'text-purple-600'
                      : 'text-blue-600'
                  }`} />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1.5 rounded-lg shadow">
                  {selectedEngine === 'gemini' ? <Bot className="w-4 h-4" /> : selectedEngine === 'docling' ? <Layers className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                </div>
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-1">
                Đang Scan PDF bằng Engine {selectedEngine === 'gemini' ? 'Gemini 2.5 AI' : selectedEngine === 'docling' ? 'Docling AI (IBM)' : 'PaddleOCR GPU'}
              </h3>
              <p className="text-xs text-slate-500 mb-6 font-medium">
                {selectedEngine === 'gemini'
                  ? `Nhận diện đa thức Multimodal Google ${geminiModel}`
                  : selectedEngine === 'docling'
                  ? 'Phân tích cấu trúc bảng TableFormer của IBM Research'
                  : 'Nhận diện chuỗi Tiếng Việt gia tốc GPU CUDA'}
              </p>

              {/* Progress Bar & Percentage */}
              <div className="w-full mb-6">
                <div className="flex justify-between items-center text-xs font-semibold mb-2">
                  <span className="text-slate-700 font-bold">
                    Trang {taskProgress?.current_page || 0} / {taskProgress?.total_pages || 1}
                  </span>
                  <span className={`font-mono font-bold text-sm ${
                    selectedEngine === 'gemini'
                      ? 'text-cyan-700'
                      : selectedEngine === 'docling'
                      ? 'text-purple-700'
                      : 'text-blue-700'
                  }`}>
                    {taskProgress?.progress_percent || 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 p-0.5 border border-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-300 shadow-xs ${
                      selectedEngine === 'gemini'
                        ? 'bg-gradient-to-r from-cyan-600 to-teal-400'
                        : selectedEngine === 'docling'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-500'
                        : 'bg-gradient-to-r from-blue-600 to-emerald-500'
                    }`}
                    style={{ width: `${taskProgress?.progress_percent || 0}%` }}
                  />
                </div>
              </div>

              {/* Real-time Timer display */}
              <div className="w-full bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6 flex justify-around items-center">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Thời gian đã chạy</span>
                  <div className="flex items-center space-x-1.5 mt-1">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span className="font-mono text-2xl font-bold text-amber-700">{formatSec(elapsedSec)}</span>
                  </div>
                </div>

                <div className="h-8 w-px bg-slate-200" />

                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Mô hình Engine</span>
                  <div className="flex items-center space-x-1.5 mt-1 text-slate-800">
                    <span className="text-xs font-bold font-mono">
                      {selectedEngine === 'gemini' ? geminiModel : selectedEngine === 'docling' ? 'Docling TableFormer' : 'PaddleOCR GPU'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full bg-slate-50 rounded-lg p-3 text-xs text-slate-600 flex items-center justify-center space-x-2 border border-slate-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="font-medium">Đang xử lý trang {taskProgress?.current_page || 0} trên {selectedEngine.toUpperCase()}...</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'viewer' ? (
          <DualViewer resultData={resultData} />
        ) : (
          <LayoutEditor resultData={resultData} />
        )}
      </div>
    </div>
  );
}
