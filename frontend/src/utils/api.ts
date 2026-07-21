const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('auth-storage') 
    ? JSON.parse(localStorage.getItem('auth-storage') as string)?.state?.token 
    : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['X-API-KEY'] = token;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    let errorMessage = 'Ocurrió un error en la petición';
    
    if (errorData.detail) {
      if (typeof errorData.detail === 'string') {
        errorMessage = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        errorMessage = errorData.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
      } else if (typeof errorData.detail === 'object') {
        errorMessage = errorData.detail.message || errorData.detail.msg || JSON.stringify(errorData.detail);
      }
    } else if (errorData.message) {
      errorMessage = errorData.message;
    }
    
    throw new Error(errorMessage);
  }

  return res.json();
};
