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

// 401 handling: when the gateway tells us "session expired" on any non-auth
// request, wipe localStorage and bounce to /login. The auth-path exclusion
// is essential — without it, a failed login (also a 401) would loop forever.
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || '';
    if (status === 401 && !url.includes('/api/v1/auth/')) {
      localStorage.removeItem('bookshare.token');
      localStorage.removeItem('bookshare.user');
      // Hard navigation — guarantees fresh state. Future stories can switch
      // to a React Router redirect via a custom event if it becomes noisy.
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default instance;
