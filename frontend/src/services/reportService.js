import api from '../utils/axiosConfig';

export const reportService = {
  getDashboard: () => api.get('/reports/dashboard'),
  getProfit: (params) => api.get('/reports/profit', { params }),
  getDailySales: (params) => api.get('/reports/daily-sales', { params }),
  getMonthlySales: (params) => api.get('/reports/monthly-sales', { params }),
  getStock: () => api.get('/reports/stock'),
  getPurchase: (params) => api.get('/reports/purchases', { params }),
};
