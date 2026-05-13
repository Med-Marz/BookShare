import axios from 'axios';

const baseURL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000';

const instance = axios.create({ baseURL });

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('bookshare.token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default instance;
