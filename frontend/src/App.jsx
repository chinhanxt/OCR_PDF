import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DualViewer from './components/DualViewer';
import LayoutEditor from './components/LayoutEditor';
import { checkStatus, uploadAndScanPDF } from './api';

export default function App() {
  const [gpuStatus, setGpuStatus] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [activeTab, setActiveTab] = useState('viewer');

  useEffect(() => {
    checkStatus().then(setGpuStatus).catch(console.error);
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const data = await uploadAndScanPDF(file);
      setResultData(data);
    } catch (err) {
      alert("Lỗi khi scan PDF: " + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 font-sans overflow-hidden">
      <Header
        onUpload={handleFileUpload}
        isScanning={isScanning}
        gpuStatus={gpuStatus}
        resultData={resultData}
      />

      <div className="flex border-b border-slate-800 bg-slate-900 px-6">
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

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'viewer' ? (
          <DualViewer resultData={resultData} />
        ) : (
          <LayoutEditor resultData={resultData} />
        )}
      </div>
    </div>
  );
}
