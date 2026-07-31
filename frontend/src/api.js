import axios from 'axios';

const API_BASE = 'http://localhost:8000';

export const checkStatus = async () => {
  const res = await axios.get(`${API_BASE}/api/status`);
  return res.data;
};

export const uploadAndScanPDF = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await axios.post(`${API_BASE}/api/scan`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};
