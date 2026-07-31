import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DualViewer from './components/DualViewer';
import LayoutEditor from './components/LayoutEditor';
import { checkStatus, startPDFScan, getTaskStatus } from './api';
import { Loader2, Clock, Cpu, Sparkles, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [gpuStatus, setGpuStatus] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [taskProgress, setTaskProgress] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [activeTab, setActiveTab] = useState('viewer');
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    checkStatus().then(setGpuStatus).catch(console.error);
  }, []);

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

    setIsScanning(true);
    setResultData(null);
    setTaskProgress({ status: 'processing', current_page: 0, total_pages: 1, progress_percent: 0 });

    try {
      const scanRes = await startPDFScan(file);
      const taskId = scanRes.task_id;

      // Poll task status until complete or failed
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
            alert("Lỗi khi scan PDF: " + (statusRes.error || "Unknown error"));
          }
        } catch (err) {
          console.error("Polling error:", err);
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
    <div className="h-screen w-screen flex flex-col bg-slate-950 font-sans overflow-hidden relative">
      <Header
        onUpload={handleFileUpload}
        isScanning={isScanning}
        gpuStatus={gpuStatus}
        resultData={resultData}
      />

      <div className="flex border-b border-slate-800 bg-slate-900 px-6 shrink-0">
        <button
          onClick={() => setActiveTab('viewer')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'viewer' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Màn hình Đối xứng 1-vs-1
        </button>
        <button
          onClick={() => setActiveTab('layout')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'layout' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Interactive Layout & Chi tiết Bảng
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col relative">
        {/* Real-Time Processing Progress Modal */}
        {isScanning && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div className="w-20 h-20 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center animate-pulse">
                  <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-1.5 rounded-lg shadow">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>

              <h3 className="text-xl font-bold text-white mb-1">Đang Scan & Nhận diện PDF</h3>
              <p className="text-xs text-slate-400 mb-6">Mô hình PaddleOCR GPU Gia tốc Tiếng Việt</p>

              {/* Progress Bar & Percentage */}
              <div className="w-full mb-6">
                <div className="flex justify-between items-center text-xs font-semibold mb-2">
                  <span className="text-slate-300">
                    Trang {taskProgress?.current_page || 0} / {taskProgress?.total_pages || 1}
                  </span>
                  <span className="text-blue-400 font-mono font-bold text-sm">
                    {taskProgress?.progress_percent || 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-sm"
                    style={{ width: `${taskProgress?.progress_percent || 0}%` }}
                  />
                </div>
              </div>

              {/* Real-time Timer display */}
              <div className="w-full bg-slate-950 rounded-xl p-4 border border-slate-800 mb-6 flex justify-around items-center">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Thời gian đã chạy</span>
                  <div className="flex items-center space-x-1.5 mt-1">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="font-mono text-2xl font-bold text-amber-300">{formatSec(elapsedSec)}</span>
                  </div>
                </div>

                <div className="h-8 w-px bg-slate-800" />

                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Gia tốc Phần cứng</span>
                  <div className="flex items-center space-x-1.5 mt-1 text-emerald-400">
                    <Cpu className="w-4 h-4" />
                    <span className="text-xs font-bold font-mono">RTX 3050</span>
                  </div>
                </div>
              </div>

              <div className="w-full bg-slate-800/50 rounded-lg p-3 text-xs text-slate-300 flex items-center justify-center space-x-2 border border-slate-700/50">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Đang xử lý trang {taskProgress?.current_page || 0} trên GPU...</span>
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
