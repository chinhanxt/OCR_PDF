import axios from 'axios';

const API_BASE = 'http://localhost:8000';

export const checkStatus = async () => {
  const res = await axios.get(`${API_BASE}/api/status`);
  return res.data;
};

export const startPDFScan = async (file, engine = 'paddleocr') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('engine', engine);
  const res = await axios.post(`${API_BASE}/api/scan`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};

export const getTaskStatus = async (taskId) => {
  const res = await axios.get(`${API_BASE}/api/task/${taskId}`);
  return res.data;
};
