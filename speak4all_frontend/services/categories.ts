import { fetchJSON } from './apiClient';

export const categoryService = {
  // Crear categoría
  createCategory: (data: { name: string; description?: string; color?: string }, token: string) =>
    fetchJSON('/categories/', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  // Listar categorías del terapeuta
  listCategories: (token: string) =>
    fetchJSON('/categories/', { token }).catch(() => []),

  // Obtener una categoría
  getCategory: (categoryId: number, token: string) =>
    fetchJSON(`/categories/${categoryId}`, { token }).catch(() => null),

  // Actualizar categoría
  updateCategory: (categoryId: number, data: { name?: string; description?: string; color?: string }, token: string) =>
    fetchJSON(`/categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  // Eliminar categoría
  deleteCategory: (categoryId: number, token: string) =>
    fetchJSON(`/categories/${categoryId}`, {
      method: 'DELETE',
      token,
    }).catch(() => null),
};
