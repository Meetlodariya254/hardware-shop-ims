import api from '../utils/axiosConfig';

export const productService = {
  getAll: (params) => api.get('/products', { params }),
  getOne: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  getLowStock: () => api.get('/products/low-stock'),
  getStockValue: () => api.get('/products/stock-value'),
  getCategories: () => api.get('/products/categories'),
};
