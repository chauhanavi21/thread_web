const TOKEN_KEY = 'threads.token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: session just won't persist */
  }
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, raw, type } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (type) headers['Content-Type'] = type;
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Is the backend running?');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error || 'Something went wrong.');
  return data;
}

export const api = {
  products: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/products${qs ? `?${qs}` : ''}`);
  },
  productMeta: () => request('/products/meta'),
  product: (slug) => request(`/products/${encodeURIComponent(slug)}`),
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  me: () => request('/auth/me'),
  orders: () => request('/orders'),
  order: (id) => request(`/orders/${id}`),
  placeOrder: (body) => request('/orders', { method: 'POST', body }),
  site: () => request('/site'),
};

/** Everything under /api/admin. The server re-checks the admin role on every call. */
export const admin = {
  stats: () => request('/admin/stats'),
  products: () => request('/admin/products'),
  product: (id) => request(`/admin/products/${id}`),
  createProduct: (body) => request('/admin/products', { method: 'POST', body }),
  updateProduct: (id, body) => request(`/admin/products/${id}`, { method: 'PUT', body }),
  patchProduct: (id, body) => request(`/admin/products/${id}`, { method: 'PATCH', body }),
  deleteProduct: (id) => request(`/admin/products/${id}`, { method: 'DELETE' }),
  orders: (status) => request(`/admin/orders${status ? `?status=${status}` : ''}`),
  setOrderStatus: (id, status) => request(`/admin/orders/${id}`, { method: 'PATCH', body: { status } }),
  users: () => request('/admin/users'),
  setRole: (id, role) => request(`/admin/users/${id}`, { method: 'PATCH', body: { role } }),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
  categories: () => request('/admin/categories'),
  createCategory: (body) => request('/admin/categories', { method: 'POST', body }),
  updateCategory: (key, body) => request(`/admin/categories/${encodeURIComponent(key)}`, { method: 'PUT', body }),
  deleteCategory: (key) => request(`/admin/categories/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  settings: () => request('/admin/settings'),
  saveSettings: (body) => request('/admin/settings', { method: 'PUT', body }),
  /** Uploads an image File and resolves to its URL. */
  upload: async (file) => (await request('/admin/uploads', { method: 'POST', raw: file, type: file.type })).url,
};

export const money = (cents) => `$${(cents / 100).toFixed(2)}`;
