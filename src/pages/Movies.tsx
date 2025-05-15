import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/config/api'
import { useState } from 'react'
import { FaSort, FaFilter, FaStar, FaPlus } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'

interface Movie {
  movie_id: number
  title: string
  description: string
  release_date: string
  rating: number
  poster: string
  backdrop: string
  director: string
  genres: string[]
}

interface User {
  is_moderator: boolean;
}

type SortOption = 'rating_desc' | 'rating_asc' | 'year_desc' | 'year_asc' | 'title_asc' | 'title_desc'

export default function Movies() {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<SortOption>('rating_desc')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [minRating, setMinRating] = useState<number>(0)
  const [yearRange, setYearRange] = useState<[number, number]>([1900, new Date().getFullYear()])

  const { data: moviesList, isLoading, error } = useQuery<Movie[]>({
    queryKey: ['movies'],
    queryFn: async () => {
      try {
        const response = await api.get('/movies/')
        return response.data
      } catch (error: any) {
        if (error.response?.status === 401) {
          navigate('/login')
          throw new Error('Требуется авторизация')
        }
        throw error
      }
    },
    retry: false
  })

  const { data: user } = useQuery<User>({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        const response = await api.get('/users/me')
        return response.data
      } catch (error: any) {
        if (error.response?.status === 401) {
          navigate('/login')
          throw new Error('Требуется авторизация')
        }
        throw error
      }
    },
    retry: false
  })

  // Получаем уникальные жанры из всех фильмов
  const allGenres = Array.from(new Set(moviesList?.flatMap(movie => movie?.genres || []) || []))

  // Фильтрация и сортировка фильмов
  const filteredAndSortedMovies = moviesList?.filter(movie => {
    if (!movie) return false;
    
    const movieYear = new Date(movie.release_date).getFullYear()
    
    // Проверка жанров: фильм должен содержать ВСЕ выбранные жанры
    const matchesGenres = selectedGenres.length === 0 || 
      selectedGenres.every(genre => movie.genres?.includes(genre))
    
    const matchesRating = movie.rating >= minRating
    const matchesYear = movieYear >= yearRange[0] && movieYear <= yearRange[1]
    
    return matchesGenres && matchesRating && matchesYear
  }).sort((a, b) => {
    if (!a || !b) return 0;
    
    switch (sortBy) {
      case 'rating_desc':
        return b.rating - a.rating
      case 'rating_asc':
        return a.rating - b.rating
      case 'year_desc':
        return new Date(b.release_date).getTime() - new Date(a.release_date).getTime()
      case 'year_asc':
        return new Date(a.release_date).getTime() - new Date(b.release_date).getTime()
      case 'title_asc':
        return a.title.localeCompare(b.title)
      case 'title_desc':
        return b.title.localeCompare(a.title)
      default:
        return 0
    }
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">Загрузка фильмов...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center bg-red-900/50 p-6 rounded-lg">
          <h3 className="text-xl font-semibold text-white mb-2">Ошибка</h3>
          <p className="text-red-200">{error instanceof Error ? error.message : 'Неизвестная ошибка'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Фильмы</h1>
        {user?.is_moderator && (
          <Link
            to="/movies/create"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <FaPlus />
            <span>Добавить фильм</span>
          </Link>
        )}
      </div>

      {!filteredAndSortedMovies || filteredAndSortedMovies.length === 0 ? (
        <div className="text-center text-white">Фильмы не найдены</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAndSortedMovies.map((movie) => (
            movie && (
              <Link
                key={movie.movie_id}
                to={`/movies/${movie.movie_id}`}
                className="bg-dark-secondary rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="aspect-[2/3] relative">
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <h2 className="text-lg font-semibold text-white mb-2">{movie.title}</h2>
                  <p className="text-gray-400 text-sm line-clamp-2">{movie.description}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-yellow-500">{movie.rating.toFixed(1)}</span>
                    <span className="text-gray-400 text-sm">{new Date(movie.release_date).getFullYear()}</span>
                  </div>
                </div>
              </Link>
            )
          ))}
        </div>
      )}

      <div className="flex gap-8 mt-8">
        <div className="flex-1">
          {/* Панель фильтров */}
          <div className="w-80 bg-dark-secondary p-6 rounded-lg h-fit">
            <div className="space-y-6">
              {/* Сортировка */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <FaSort />
                  Сортировка
                </h3>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full p-2 rounded bg-dark-primary text-white border border-gray-600"
                >
                  <option value="rating_desc">По рейтингу (убыв.)</option>
                  <option value="rating_asc">По рейтингу (возр.)</option>
                  <option value="year_desc">По году (убыв.)</option>
                  <option value="year_asc">По году (возр.)</option>
                  <option value="title_asc">По названию (А-Я)</option>
                  <option value="title_desc">По названию (Я-А)</option>
                </select>
              </div>

              {/* Фильтр по жанрам */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <FaFilter />
                  Жанры
                </h3>
                {allGenres.length === 0 ? (
                  <p className="text-gray-400 text-sm">Нет доступных жанров</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allGenres.map((genre) => (
                      <button
                        key={genre}
                        onClick={() => {
                          if (selectedGenres.includes(genre)) {
                            setSelectedGenres(selectedGenres.filter(g => g !== genre))
                          } else {
                            setSelectedGenres([...selectedGenres, genre])
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                          selectedGenres.includes(genre)
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                            : 'bg-dark-primary text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Фильтр по рейтингу */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <FaStar />
                  Минимальный рейтинг
                </h3>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={minRating}
                  onChange={(e) => setMinRating(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="text-white text-center mt-1">{minRating.toFixed(1)}</div>
              </div>

              {/* Фильтр по годам */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Годы выпуска</h3>
                <div className="flex gap-4">
                  <div>
                    <label className="text-white text-sm">От</label>
                    <input
                      type="number"
                      value={yearRange[0]}
                      onChange={(e) => setYearRange([parseInt(e.target.value), yearRange[1]])}
                      className="w-full p-2 rounded bg-dark-primary text-white border border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="text-white text-sm">До</label>
                    <input
                      type="number"
                      value={yearRange[1]}
                      onChange={(e) => setYearRange([yearRange[0], parseInt(e.target.value)])}
                      className="w-full p-2 rounded bg-dark-primary text-white border border-gray-600"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 