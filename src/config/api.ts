import axios from 'axios'
import { jwtDecode } from 'jwt-decode'

export const API_BASE_URL = 'https://aeasy-movie-server-220072593630.us-central1.run.app/api'

export const API_ENDPOINTS = {
  USERS: '/users',
} as const;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true
})

interface JwtPayload {
  sub: string;  // email
  exp: number;
}

// Добавляем интерсептор для добавления токена к запросам
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Добавляем интерсептор для обработки ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          localStorage.removeItem('token')
          window.dispatchEvent(new CustomEvent('tokenExpired'))
          break
        case 403:
          throw new Error('Доступ запрещен')
        case 429:
          throw new Error('Слишком много запросов. Пожалуйста, подождите')
        case 500:
          throw new Error('Внутренняя ошибка сервера')
        default:
          throw new Error(error.response.data?.detail || 'Произошла ошибка')
      }
    } else if (error.request) {
      throw new Error('Нет ответа от сервера')
    } else {
      throw new Error('Ошибка при выполнении запроса')
    }
    return Promise.reject(error)
  }
)

export const auth = {
  login: async (email: string, password: string) => {
    try {
      const formData = new URLSearchParams()
      formData.append('username', email)
      formData.append('password', password)
      
      const response = await api.post('/auth/token', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        withCredentials: true
      })
      
      if (!response.data || !response.data.access_token) {
        throw new Error('Токен не получен')
      }
      
      return response.data
    } catch (error: any) {
      if (error.response?.status === 429) {
        throw new Error('Слишком много попыток входа. Пожалуйста, подождите.')
      }
      if (error.response?.status === 403) {
        throw new Error('Аккаунт заблокирован')
      }
      if (error.response?.status === 401) {
        throw new Error('Неверный email или пароль')
      }
      throw new Error(error.response?.data?.detail || 'Ошибка при входе в систему')
    }
  },
  
  loginWithGoogle: async () => {
    try {
      // Открываем окно авторизации Google
      const width = 500
      const height = 600
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2
      
      const authWindow = window.open(
        'https://aeasy-movie-server-220072593630.us-central1.run.app/api/auth/google/login',
        'Google Auth',
        `width=${width},height=${height},left=${left},top=${top}`
      )

      // Ждем ответа от окна авторизации
      return new Promise((resolve, reject) => {
        const checkWindow = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkWindow)
            reject(new Error('Окно авторизации было закрыто'))
          }
        }, 1000)

        window.addEventListener('message', async (event) => {
          if (event.origin === 'https://aeasy-movie-server-220072593630.us-central1.run.app') {
            clearInterval(checkWindow)
            if (authWindow) {
              authWindow.close()
            }
            
            if (event.data.error) {
              reject(new Error(event.data.error))
            } else if (event.data.access_token) {
              resolve(event.data)
            }
          }
        })
      })
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка при входе через Google')
    }
  },
  
  register: (name: string, surname: string, username: string, email: string, password: string) =>
    api.post('/users/', { name, surname, username, email, password }),
  
  getProfile: async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      throw new Error('Токен не найден')
    }
    
    try {
      const decoded = jwtDecode<JwtPayload>(token)
      if (decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem('token')
        throw new Error('Токен истек')
      }
      
      const response = await api.get('/users/me')
      return response.data
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Не удалось получить профиль пользователя')
    }
  },
  
  logout: () => {
    localStorage.removeItem('token')
    window.location.href = '/login'
  }
}

export const users = {
  getUsers: async () => {
    const response = await api.get('/users/')
    return response.data
  },
  
  getUserById: async (userId: number) => {
    try {
      const response = await api.get(`/users/${userId}`)
      return response.data
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Пользователь не найден')
      }
      throw new Error(error.response?.data?.detail || 'Ошибка при получении профиля пользователя')
    }
  }
}

export const comments = {
  createComment: async (data: {
    content: string;
    rating: number;
    movie_id: number;
    parent_comment_id?: number | null;
  }) => {
    try {
      const response = await api.post('/comments/', data);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Требуется авторизация');
      }
      if (error.response?.status === 403) {
        throw new Error('У вас нет прав для создания комментария');
      }
      if (error.response?.status === 404) {
        throw new Error('Фильм не найден');
      }
      throw new Error(error.response?.data?.detail || 'Ошибка при создании комментария');
    }
  },

  getComments: async (movieId: number) => {
    try {
      const response = await api.get(`/comments/movie/${movieId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Требуется авторизация');
      }
      if (error.response?.status === 404) {
        throw new Error('Фильм не найден');
      }
      throw new Error('Ошибка при загрузке комментариев');
    }
  },

  getComment: async (commentId: number) => {
    try {
      const response = await api.get(`/comments/${commentId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Комментарий не найден');
      }
      throw new Error('Ошибка при загрузке комментария');
    }
  },

  updateComment: async (commentId: number, data: {
    content?: string;
    rating?: number;
  }) => {
    try {
      const response = await api.patch(`/comments/${commentId}`, data);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('У вас нет прав для редактирования этого комментария');
      }
      if (error.response?.status === 404) {
        throw new Error('Комментарий не найден');
      }
      throw new Error('Ошибка при обновлении комментария');
    }
  },

  deleteComment: async (commentId: number) => {
    try {
      await api.delete(`/comments/${commentId}`);
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('У вас нет прав для удаления этого комментария');
      }
      if (error.response?.status === 404) {
        throw new Error('Комментарий не найден');
      }
      throw new Error('Ошибка при удалении комментария');
    }
  },

  getReplies: async (commentId: number) => {
    try {
      const response = await api.get(`/comments/${commentId}/replies`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Комментарий не найден');
      }
      throw new Error('Ошибка при загрузке ответов');
    }
  }
};

export const movies = {
  createMovie: async (data: {
    title: string;
    original_title: string;
    description: string;
    poster?: string;
    backdrop?: string;
    release_date: string;
    duration: number;
    director: string;
    genres: string[];
  }) => {
    try {
      const response = await api.post('/movies/', data);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Требуется авторизация');
      }
      if (error.response?.status === 403) {
        throw new Error('У вас нет прав для создания фильма');
      }
      throw new Error(error.response?.data?.detail || 'Ошибка при создании фильма');
    }
  },

  getMovies: async () => {
    try {
      const response = await api.get('/movies/');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Требуется авторизация');
      }
      throw new Error('Ошибка при загрузке фильмов');
    }
  },

  getMovie: async (movieId: number) => {
    try {
      const response = await api.get(`/movies/${movieId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Фильм не найден');
      }
      throw new Error('Ошибка при загрузке фильма');
    }
  },

  updateMovie: async (movieId: number, data: {
    title?: string;
    original_title?: string;
    description?: string;
    poster?: string;
    backdrop?: string;
    release_date?: string;
    duration?: number;
    director?: string;
    genres?: string[];
  }) => {
    try {
      const response = await api.patch(`/movies/${movieId}`, data);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('У вас нет прав для редактирования этого фильма');
      }
      if (error.response?.status === 404) {
        throw new Error('Фильм не найден');
      }
      throw new Error('Ошибка при обновлении фильма');
    }
  },

  deleteMovie: async (movieId: number) => {
    try {
      const response = await api.delete(`/movies/${movieId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('У вас нет прав для удаления этого фильма');
      }
      if (error.response?.status === 404) {
        throw new Error('Фильм не найден');
      }
      throw new Error('Ошибка при удалении фильма');
    }
  },

  uploadMovieImage: async (movieId: number, type: 'poster' | 'backdrop', file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post(`/movies/${movieId}/upload/${type}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('У вас нет прав для загрузки изображений');
      }
      throw new Error('Ошибка при загрузке изображения');
    }
  }
};