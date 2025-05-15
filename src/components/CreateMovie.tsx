import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { movies } from '@/config/api';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { auth } from '@/config/api';

interface MovieFormData {
  title: string;
  original_title: string;
  description: string;
  release_date: string;
  duration: number;
  director: string;
  genres: string[];
}

export default function CreateMovie() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<MovieFormData>({
    title: '',
    original_title: '',
    description: '',
    release_date: '',
    duration: 0,
    director: '',
    genres: []
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => auth.getProfile(),
    retry: false
  });

  const createMovieMutation = useMutation({
    mutationFn: (data: MovieFormData) => movies.createMovie(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movies'] });
      toast.success('Фильм успешно создан');
      navigate('/movies');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Ошибка при создании фильма');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMovieMutation.mutate(formData);
  };

  const handleGenreChange = (genre: string) => {
    setFormData(prev => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter(g => g !== genre)
        : [...prev.genres, genre]
    }));
  };

  if (!user?.can_moderate()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center bg-red-900/50 p-6 rounded-lg">
          <h3 className="text-xl font-semibold text-white mb-2">Доступ запрещен</h3>
          <p className="text-red-200">У вас нет прав для создания фильмов</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Создать новый фильм</h1>
      
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
            <label className="block text-white mb-2">Длительность (в минутах)</label>
            <input
              type="number"
              value={formData.duration}
              onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
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
            onClick={() => navigate('/movies')}
            className="px-4 py-2 text-white hover:text-gray-300 transition-colors"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={createMovieMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {createMovieMutation.isPending ? 'Создание...' : 'Создать фильм'}
          </button>
        </div>
      </form>
    </div>
  );
} 