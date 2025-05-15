import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { movies } from '@/config/api';
import { toast } from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { auth } from '@/config/api';
import { api } from '@/config/api';

interface MovieFormData {
  title: string;
  original_title: string;
  description: string;
  release_date: string;
  duration: number;
  poster: string;
  backdrop: string;
  director: string;
  genres: string[];
  movie_url?: string;
}

interface User {
  role: string;
}

interface Movie {
  title: string;
  original_title: string;
  description: string;
  release_date: string;
  duration: number;
  poster: string;
  backdrop: string;
  director: string;
  genres: string[];
  movie_url?: string;
}

export default function EditMovie() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<MovieFormData>({
    title: '',
    original_title: '',
    description: '',
    release_date: '',
    poster: '',
    backdrop: '',
    duration: 0,
    director: '',
    genres: [],
    movie_url: ''
  });

  const { data: user } = useQuery<User>({
    queryKey: ['user'],
    queryFn: () => auth.getProfile(),
    retry: false
  });

  const { data: movie, isLoading } = useQuery<Movie>({
    queryKey: ['movie', id],
    queryFn: () => movies.getMovie(Number(id))
  });

  useEffect(() => {
    if (movie) {
      setFormData({
        title: movie.title,
        original_title: movie.original_title,
        description: movie.description,
        release_date: new Date(movie.release_date).toISOString().split('T')[0],
        poster: movie.poster,
        backdrop: movie.backdrop,
        duration: movie.duration,
        director: movie.director,
        genres: movie.genres,
        movie_url: movie.movie_url || ''
      });
    }
  }, [movie]);

  const updateMovieMutation = useMutation({
    mutationFn: async (data: MovieFormData) => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          navigate('/login')
          throw new Error('Требуется авторизация')
        }
        const movieData = {
          ...data,
          duration: Number(data.duration)
        };
        const response = await api.patch(`/api/movies/${id}`, movieData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          withCredentials: true
        });
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          navigate('/login')
          throw new Error('Требуется авторизация')
        }
        if (error.response?.status === 403) {
          throw new Error('У вас нет прав для редактирования этого фильма')
        }
        if (error.response?.status === 404) {
          throw new Error('Фильм не найден')
        }
        throw new Error(error.response?.data?.detail || 'Ошибка при обновлении фильма')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movie', id] });
      toast.success('Фильм успешно обновлен');
      navigate(`/movies/${id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Ошибка при обновлении фильма');
    }
  });

  const uploadImageMutation = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: 'poster' | 'backdrop' }) => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          navigate('/login')
          throw new Error('Требуется авторизация')
        }
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await api.post(`/api/movies/${id}/upload/${type}`, formData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
            'Accept': 'application/json',
          },
          withCredentials: true
        });
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          navigate('/login')
          throw new Error('Требуется авторизация')
        }
        if (error.response?.status === 403) {
          throw new Error('У вас нет прав для загрузки изображений')
        }
        throw new Error(error.response?.data?.detail || 'Ошибка при загрузке изображения')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movie', id] });
      toast.success('Изображение успешно загружено');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Ошибка при загрузке изображения');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMovieMutation.mutate(formData);
  };

  const handleGenreChange = (genre: string) => {
    setFormData(prev => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter(g => g !== genre)
        : [...prev.genres, genre]
    }));
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      duration: value === '' ? 0 : parseInt(value) || 0
    }));
  };

  const canEditMovie = user?.role === 'MODERATOR' || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  if (!canEditMovie) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center bg-red-900/50 p-6 rounded-lg">
          <h3 className="text-xl font-semibold text-white mb-2">Доступ запрещен</h3>
          <p className="text-red-200">У вас нет прав для редактирования фильмов</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">Загрузка данных фильма...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Редактировать фильм</h1>
      
      <form onSubmit={handleSubmit} className="max-w-2xl bg-dark-secondary p-6 rounded-lg">
        <div className="space-y-4">
          <div>
            <label className="block text-white mb-2">Название</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full p-2 rounded bg-dark-primary text-white border border-gray-600"
              required
            />
          </div>

          <div>
            <label className="block text-white mb-2">Оригинальное название</label>
            <input
              type="text"
              value={formData.original_title}
              onChange={(e) => setFormData(prev => ({ ...prev, original_title: e.target.value }))}
              className="w-full p-2 rounded bg-dark-primary text-white border border-gray-600"
              required
            />
          </div>

          <div>
            <label className="block text-white mb-2">Описание</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full p-2 rounded bg-dark-primary text-white border border-gray-600 h-32"
              required
            />
          </div>

          <div>
            <label className="block text-white mb-2">Дата выпуска</label>
            <input
              type="date"
              value={formData.release_date}
              onChange={(e) => setFormData(prev => ({ ...prev, release_date: e.target.value }))}
              className="w-full p-2 rounded bg-dark-primary text-white border border-gray-600"
              required
            />
          </div>

          <div>
            <label className="block text-white mb-2">Постер</label>
            <input
              type="text"
              value={formData.poster}
              onChange={(e) => setFormData(prev => ({ ...prev, poster: e.target.value }))}
              className="w-full p-2 rounded bg-dark-primary text-white border border-gray-600"
              required
            />
          </div>

          <div>
            <label className="block text-white mb-2">Бэкграунд ссылка на видео ютуб</label>
            <input
              type="text"
              value={formData.backdrop}
              onChange={(e) => setFormData(prev => ({ ...prev, backdrop: e.target.value }))}
              className="w-full p-2 rounded bg-dark-primary text-white border border-gray-600"
              required
            />
          </div>

          <div>
            <label className="block text-white mb-2">Ссылка на фильм</label>
            <input
              type="text"
              value={formData.movie_url}
              onChange={(e) => setFormData(prev => ({ ...prev, movie_url: e.target.value }))}
              className="w-full p-2 rounded bg-dark-primary text-white border border-gray-600"
            />
          </div>

          <div>
            <label className="block text-white mb-2">Длительность (в минутах)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={handleDurationChange}
              className="w-full p-2 rounded bg-dark-primary text-white border border-gray-600"
              min="1"
              required
            />
          </div>

          <div>
            <label className="block text-white mb-2">Режиссер</label>
            <input
              type="text"
              value={formData.director}
              onChange={(e) => setFormData(prev => ({ ...prev, director: e.target.value }))}
              className="w-full p-2 rounded bg-dark-primary text-white border border-gray-600"
              required
            />
          </div>

          <div>
            <label className="block text-white mb-2">Жанры</label>
            <div className="flex flex-wrap gap-2">
              {['Боевик', 'Комедия', 'Драма', 'Фантастика', 'Ужасы', 'Мелодрама', 'Приключения', 'Триллер'].map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => handleGenreChange(genre)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    formData.genres.includes(genre)
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-dark-primary text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(`/movies/${id}`)}
            className="px-4 py-2 text-white hover:text-gray-300 transition-colors"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={updateMovieMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {updateMovieMutation.isPending ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </form>
    </div>
  );
} 