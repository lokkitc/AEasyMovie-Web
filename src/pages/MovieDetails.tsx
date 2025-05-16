import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, comments as commentsService } from '@/config/api'
import {
   useEffect, useRef, useState } from 'react'
import Player from '@vimeo/player'
import ReactPlayer from 'react-player'
import { auth } from '../config/api'
import { FaLock, FaCoins, FaCrown, FaStar, FaEdit } from 'react-icons/fa'
import { toast } from 'react-hot-toast'
import { API_BASE_URL } from '@/config/api'

interface Movie {
  movie_id: number
  title: string
  description: string
  release_date: string
  rating: number
  director: string
  genres: string[]
  poster: string
  backdrop: string
  movie_url: string
}

interface Episode {
  episode_id: number
  movie_id: number
  title: string
  episode_number: number
  cost: number
  created_at: string
  updated_at: string
  has_access: boolean
}

interface EpisodeDetail extends Episode {
  video_file: string
}

interface Comment {
  comment_id: number
  content: string
  user_id: number
  movie_id: number
  created_at: string
  rating: number
  parent_comment_id: number | null
  user: {
    username: string
    photo: string
    is_premium: boolean
    title: string
  }
  replies: Comment[]
}

interface User {
  role: string;
  is_premium: boolean;
  money: number;
}

interface CreateEpisodeForm {
  title: string;
  episode_number: number;
  video: File | null;
  cost: number;
}

export default function MovieDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const playerRef = useRef<YT.Player | null>(null)
  const vimeoPlayerRef = useRef<Player | null>(null)
  const [isYouTubeApiReady, setIsYouTubeApiReady] = useState(false)
  const [backdropType, setBackdropType] = useState<'image' | 'vimeo' | 'youtube' | 'dailymotion'>('image')
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null)
  const [isWatching, setIsWatching] = useState(false)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [episodeToPurchase, setEpisodeToPurchase] = useState<Episode | null>(null)
  const [newComment, setNewComment] = useState('')
  const [rating, setRating] = useState(5)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [showCreateEpisodeModal, setShowCreateEpisodeModal] = useState(false)
  const [createEpisodeForm, setCreateEpisodeForm] = useState<CreateEpisodeForm>({
    title: '',
    episode_number: 1,
    video: null,
    cost: 0
  })
  const [isCreatingEpisode, setIsCreatingEpisode] = useState(false)

  const { data: movie, isLoading: movieLoading, error: movieError } = useQuery<Movie>({
    queryKey: ['movie', id],
    queryFn: async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          navigate('/login')
          throw new Error('Требуется авторизация')
        }
        const response = await api.get(`/movies/${id}`)
        return response.data
      } catch (error: any) {
        if (error.response?.status === 401) {
          navigate('/login')
          throw new Error('Требуется авторизация')
        }
        if (error.response?.status === 403) {
          throw new Error('У вас нет доступа к этому фильму')
        }
        if (error.response?.status === 404) {
          throw new Error('Фильм не найден')
        }
        throw new Error('Ошибка при загрузке фильма')
      }
    },
  })

  const { data: episodes, isLoading: episodesLoading, error: episodesError } = useQuery<Episode[]>({
    queryKey: ['episodes', id],
    queryFn: async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          navigate('/login')
          throw new Error('Требуется авторизация')
        }
        const response = await api.get(`/episodes/movie/${id}`)
        return response.data
      } catch (error: any) {
        if (error.response?.status === 401) {
          navigate('/login')
          throw new Error('Требуется авторизация')
        }
        throw new Error('Ошибка при загрузке эпизодов')
      }
    },
  })

  const { data: selectedEpisodeDetail, isLoading: selectedEpisodeLoading } = useQuery<EpisodeDetail>({
    queryKey: ['episode', selectedEpisode?.episode_id],
    queryFn: async () => {
      if (!selectedEpisode) return null
      try {
        const response = await api.get(`/episodes/${selectedEpisode.episode_id}`)
        console.log('Episode response:', response.data)
        return response.data
      } catch (error: any) {
        console.error('Error loading episode:', error)
        if (error.response?.status === 403) {
          toast.error('У вас нет доступа к этому эпизоду')
          setSelectedEpisode(null)
        }
        throw error
      }
    },
    enabled: !!selectedEpisode,
  })

  const { data: comments, isLoading: commentsLoading, error: commentsError } = useQuery<Comment[]>({
    queryKey: ['comments', id],
    queryFn: async () => {
      const response = await commentsService.getComments(Number(id));
      return response;
    },
    retry: false
  })

  const { data: user } = useQuery<User>({
    queryKey: ['user'],
    queryFn: () => auth.getProfile(),
    retry: false
  });

  const canEditMovie = user?.role === 'MODERATOR' || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  const purchaseMutation = useMutation({
    mutationFn: async (episodeId: number) => {
      const response = await api.post(`/episodes/${episodeId}/purchase`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes', id] })
      queryClient.invalidateQueries({ queryKey: ['user'] })
      toast.success('Эпизод успешно куплен!')
      setShowPurchaseModal(false)
      setEpisodeToPurchase(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Ошибка при покупке эпизода')
    }
  })

  const createCommentMutation = useMutation({
    mutationFn: async () => {
      if (!newComment.trim()) {
        throw new Error('Комментарий не может быть пустым')
      }
      
      return commentsService.createComment({
        content: newComment,
        rating: rating,
        movie_id: Number(id),
        parent_comment_id: null
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', id] })
      setNewComment('')
      setRating(5)
      toast.success('Комментарий успешно добавлен')
    },
    onError: (error: any) => {
      if (error.message === 'Требуется авторизация') {
        navigate('/login')
      }
      toast.error(error.message || 'Ошибка при добавлении комментария')
    }
  })

  const createEpisodeMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      try {
        const response = await api.post('/episodes', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Accept': 'application/json',
          },
          withCredentials: true,
          timeout: 30000,
          validateStatus: (status) => {
            return status >= 200 && status < 500
          }
        })
        return response.data
      } catch (error: any) {
        if (error.code === 'ERR_NETWORK') {
          throw new Error('Ошибка сети. Проверьте подключение к интернету.')
        }
        if (error.response?.status === 413) {
          throw new Error('Размер файла слишком большой')
        }
        if (error.response?.status === 415) {
          throw new Error('Неподдерживаемый формат файла')
        }
        if (error.message.includes('Mixed Content')) {
          throw new Error('Ошибка безопасности. Пожалуйста, используйте HTTPS.')
        }
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes', id] })
      toast.success('Эпизод успешно создан!')
      setShowCreateEpisodeModal(false)
      setCreateEpisodeForm({
        title: '',
        episode_number: 1,
        video: null,
        cost: 0
      })
    },
    onError: (error: any) => {
      if (error.message === 'Нет ответа от сервера') {
        toast.error('Ошибка соединения с сервером. Проверьте подключение к интернету.')
      } else if (error.message.includes('Mixed Content')) {
        toast.error('Ошибка безопасности. Пожалуйста, используйте HTTPS.')
      } else {
        toast.error(error.message || 'Ошибка при создании эпизода')
      }
      console.error('Error creating episode:', error)
    }
  })

  useEffect(() => {
    // Проверяем, не загружен ли уже API
    if (window.YT) {
      setIsYouTubeApiReady(true)
      return
    }

    // Загружаем YouTube Player API
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

    // Инициализируем плеер, когда API готов
    window.onYouTubeIframeAPIReady = () => {
      setIsYouTubeApiReady(true)
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
      }
    }
  }, [])

  useEffect(() => {
    if (isYouTubeApiReady && movie?.movie_url) {
      const videoId = extractVideoId(movie.movie_url)
      if (videoId) {
        try {
          playerRef.current = new window.YT.Player('youtube-player', {
            height: '500',
            width: '100%',
            videoId: videoId,
            playerVars: {
              autoplay: 0,
              modestbranding: 1,
              rel: 0,
            },
            events: {
              onError: (event: any) => {
                console.error('YouTube Player Error:', event.data)
              }
            }
          })
        } catch (error) {
          console.error('Error initializing YouTube player:', error)
        }
      }
    }
  }, [isYouTubeApiReady, movie?.movie_url])

  useEffect(() => {
    if (movie?.backdrop) {
      if (movie.backdrop.includes('vimeo.com')) {
        setBackdropType('vimeo')
        const videoId = extractVimeoId(movie.backdrop)
        if (videoId) {
          const element = document.getElementById('vimeo-backdrop')
          if (element) {
            vimeoPlayerRef.current = new Player(element, {
              id: parseInt(videoId),
              background: true,
              responsive: true,
              dnt: true,
              autopause: false,
              autoplay: true,
              loop: true,
              muted: true,
              playsinline: true
            })
          }
        }
      } else if (movie.backdrop.includes('youtube.com') || movie.backdrop.includes('youtu.be')) {
        setBackdropType('youtube')
      } else if (movie.backdrop.includes('dailymotion.com')) {
        setBackdropType('dailymotion')
      } else {
        setBackdropType('image')
      }
    }

    return () => {
      if (vimeoPlayerRef.current) {
        vimeoPlayerRef.current.destroy()
      }
    }
  }, [movie?.backdrop])

  // Функция для извлечения ID видео из URL YouTube
  const extractVideoId = (url: string) => {
    try {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
      const match = url.match(regExp)
      return match && match[2].length === 11 ? match[2] : null
    } catch (error) {
      console.error('Error extracting video ID:', error)
      return null
    }
  }

  const extractVimeoId = (url: string) => {
    try {
      // Поддержка стандартного формата vimeo.com/ID
      let regExp = /vimeo\.com\/([0-9]+)/
      let match = url.match(regExp)

      if (!match) {
        // Поддержка формата player.vimeo.com/video/ID
        regExp = /player\.vimeo\.com\/video\/([0-9]+)/
        match = url.match(regExp)
      }

      if (match) {
        // Удаляем все параметры после ID
        const id = match[1].split(/[?#]/)[0]
        return id
      }

      return null
    } catch (error) {
      console.error('Error extracting Vimeo ID:', error)
      return null
    }
  }

  const extractDailymotionId = (url: string) => {
    try {
      const regExp = /dailymotion\.com\/video\/([a-zA-Z0-9]+)/
      const match = url.match(regExp)
      return match ? match[1] : null
    } catch (error) {
      console.error('Error extracting Dailymotion ID:', error)
      return null
    }
  }

    const handleEpisodeClick = (episode: Episode) => {
    if (episode.has_access || user?.is_premium) {
      setSelectedEpisode(episode)
            } else {
      toast.error('У вас нет доступа к этому эпизоду')
    }
  }

  const handleWatchClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsWatching(true)
  }

  const handlePurchaseClick = (e: React.MouseEvent, episode: Episode) => {
    e.stopPropagation()
    setEpisodeToPurchase(episode)
    setShowPurchaseModal(true)
  }

  const handleConfirmPurchase = async () => {
    if (episodeToPurchase) {
      try {
        await purchaseMutation.mutateAsync(episodeToPurchase.episode_id)
      } catch (error) {
        console.error('Error purchasing episode:', error)
      }
    }
  }

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) {
      toast.error('Комментарий не может быть пустым')
      return
    }
    createCommentMutation.mutate()
  }

  const handleCreateEpisode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createEpisodeForm.video) {
      toast.error('Пожалуйста, выберите видеофайл')
      return
    }

    if (!id) {
      toast.error('ID фильма не найден')
      return
    }

    // Проверка размера файла (максимум 100MB)
    if (createEpisodeForm.video.size > 100 * 1024 * 1024) {
      toast.error('Размер файла не должен превышать 100MB')
      return
    }

    // Проверка формата файла
    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg']
    if (!allowedTypes.includes(createEpisodeForm.video.type)) {
      toast.error('Поддерживаются только форматы MP4, WebM и OGG')
      return
    }

    setIsCreatingEpisode(true)
    const formData = new FormData()
    formData.append('movie_id', id)
    formData.append('title', createEpisodeForm.title)
    formData.append('episode_number', createEpisodeForm.episode_number.toString())
    formData.append('video', createEpisodeForm.video)
    formData.append('cost', createEpisodeForm.cost.toString())

    try {
      await createEpisodeMutation.mutateAsync(formData)
    } catch (error) {
      console.error('Error creating episode:', error)
    } finally {
      setIsCreatingEpisode(false)
    }
  }

  if (movieLoading || commentsLoading) {
    return <div className="text-center">Загрузка...</div>
  }

  if (movieError) {
    return <div className="text-center text-red-600">{movieError.message}</div>
  }

  if (!movie) {
    return <div className="text-center text-red-600">Фильм не найден</div>
  }

  return (
    <div className="mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-transparent dark:bg-dark-transparent rounded-lg shadow-md p-4 sm:p-8">
        {movie.backdrop && (
          <div className="relative h-48 sm:h-64 md:h-80 lg:h-96 -mx-4 sm:-mx-8 -mt-4 sm:-mt-8 mb-4 sm:mb-8 overflow-hidden">
            {backdropType === 'vimeo' && (
              <div
                id="vimeo-backdrop"
                className="absolute inset-0 w-full h-full"
                style={{ minHeight: '384px' }}
              />
            )}
            {backdropType === 'youtube' && (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${extractVideoId(movie.backdrop)}?autoplay=1&mute=1&loop=1&playlist=${extractVideoId(movie.backdrop)}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&background=1`}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            )}
            {backdropType === 'dailymotion' && (
              <iframe
                src={`https://www.dailymotion.com/embed/video/${extractDailymotionId(movie.backdrop)}?autoplay=1&mute=1&loop=1&controls=0&ui-logo=0&ui-start-screen-info=0&ui-end-screen-info=0&ui-highlight=0&ui-video-info=0`}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            )}
            {backdropType === 'image' && (
              <img
                src={movie.backdrop}
                alt={movie.title}
                className="w-full h-full object-cover rounded-t-lg"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black/50 to-black" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black" />
          </div>
        )}
        <div className="flex flex-col md:flex-row gap-4 sm:gap-8 -mt-16 sm:-mt-32 relative z-10">
          {movie.poster && (
            <img
              src={movie.poster}
              alt={movie.title}
              className="w-full md:w-72 h-auto md:h-108 object-cover rounded-lg shadow-md"
            />
          )}
          <div className="flex-1">
            <div className="flex justify-between items-start mb-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{movie.title}</h1>
              {canEditMovie && (
                <button
                  onClick={() => navigate(`/movies/${id}/edit`)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  <FaEdit />
                  <span>Редактировать</span>
                </button>
              )}
            </div>
            
            {/* Подробная информация о фильме */}
            <div className="bg-dark-primary rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4">Информация о фильме</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Основная информация */}
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-400">Год выпуска</p>
                    <p className="font-semibold text-white">{new Date(movie.release_date).getFullYear()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Режиссер</p>
                    <p className="font-semibold text-white">{movie.director}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Рейтинг</p>
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[...Array(10)].map((_, i) => (
                          <FaStar
                            key={i}
                            className={`text-sm ${
                              i < movie.rating ? 'text-yellow-500' : 'text-gray-400'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-white font-semibold">{movie.rating}/10</span>
                    </div>
                  </div>
                </div>

                {/* Жанры и теги */}
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-400">Жанры</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {movie.genres.map((genre, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Дополнительная информация */}
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-400">Дата добавления</p>
                    <p className="font-semibold text-white">
                      {new Date(movie.release_date).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">ID фильма</p>
                    <p className="font-semibold text-white">{movie.movie_id}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Описание фильма */}
            <div className="bg-dark-primary rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4">Описание</h2>
              <p className="text-white whitespace-pre-line leading-relaxed">{movie.description}</p>
            </div>

            {/* Ссылки и ресурсы */}
            <div className="bg-dark-primary rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">Ресурсы</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {movie.movie_url && (
                  <div>
                    <p className="text-gray-400 mb-2">Ссылка на видео</p>
                    <a
                      href={movie.movie_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 break-all"
                    >
                      {movie.movie_url}
                    </a>
                  </div>
                )}
                {movie.poster && (
                  <div>
                    <p className="text-gray-400 mb-2">Постер</p>
                    <a
                      href={movie.poster}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 break-all"
                    >
                      {movie.poster}
                    </a>
                  </div>
                )}
                {movie.backdrop && (
                  <div>
                    <p className="text-gray-400 mb-2">Фоновое изображение</p>
                    <a
                      href={movie.backdrop}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 break-all"
                    >
                      {movie.backdrop}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {movie.movie_url && (
          <div className="mt-4 max-w-72">
            <div className="relative aspect-video rounded-lg shadow-md overflow-hidden">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${extractVideoId(movie.movie_url)}?modestbranding=1&rel=0&origin=${window.location.origin}`}
                title={movie.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute top-0 left-0 w-full h-full"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        )}
      </div>
          <div className="mt-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Эпизоды</h2>
              {canEditMovie && (
                <button
                  onClick={() => setShowCreateEpisodeModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  Добавить эпизод
                </button>
              )}
            </div>
        {episodesLoading ? (
          <div className="text-center text-white">Загрузка эпизодов...</div>
        ) : episodesError ? (
          <div className="text-center text-red-600">Ошибка при загрузке эпизодов</div>
        ) : episodes?.length === 0 ? (
          <div className="text-center text-white">Эпизоды отсутствуют</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {episodes?.map((episode) => (
              <div
                key={episode.episode_id}
                className={`relative bg-dark-secondary rounded-lg p-4 cursor-pointer transition-transform hover:scale-105 ${
                  !episode.has_access && !user?.is_premium ? 'opacity-75' : ''
                }`}
                onClick={() => handleEpisodeClick(episode)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-white">Эпизод {episode.episode_number}</h3>
                  {!episode.has_access && !user?.is_premium && (
                    <div className="flex items-center gap-2">
                      <FaLock className="text-yellow-500" />
                      <span className="text-yellow-500">{episode.cost} монет</span>
                    </div>
                  )}
                  {user?.is_premium && (
                    <div className="flex items-center gap-2">
                      <FaCrown className="text-yellow-500" />
                      <span className="text-yellow-500">Премиум доступ</span>
          </div>
        )}
                </div>
                <p className="text-gray-300">{episode.title}</p>
                {!episode.has_access && !user?.is_premium && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                    <button
                      className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                      onClick={(e) => handlePurchaseClick(e, episode)}
                      disabled={purchaseMutation.isPending}
                    >
                      {purchaseMutation.isPending ? 'Покупка...' : `Купить за ${episode.cost} монет`}
                    </button>
          </div>
        )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedEpisode && selectedEpisodeDetail && (
        <div className="mt-8">
          <h3 className="text-xl font-bold mb-4 text-white">
            Эпизод {selectedEpisode.episode_number}: {selectedEpisode.title}
          </h3>
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video
              src={selectedEpisodeDetail.video_file}
              controls
              className="w-full h-full"
              onError={(e) => {
                console.error('Video error details:', {
                  error: e,
                  videoUrl: selectedEpisodeDetail.video_file,
                  episode: selectedEpisodeDetail
                });
                toast.error('Ошибка загрузки видео. Проверьте консоль для деталей.');
              }}
              onLoadStart={() => {
                console.log('Video loading started:', selectedEpisodeDetail.video_file);
              }}
              onLoadedData={() => {
                console.log('Video loaded successfully');
              }}
            />
          </div>
        </div>
      )}

      <div className="bg-dark-secondary rounded-lg shadow-md p-4 sm:p-8 mt-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-6 text-white">Комментарии</h2>
        
        {/* Форма добавления комментария */}
        <form onSubmit={handleSubmitComment} className="mb-8">
          <div className="mb-4">
            <label className="block text-white mb-2">Ваша оценка</label>
            <div className="flex flex-wrap gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="text-2xl focus:outline-none"
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(star)}
                >
                  <FaStar
                    className={`${
                      star <= (hoveredRating || rating)
                        ? 'text-yellow-500'
                        : 'text-gray-400'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-white mb-2">Ваш комментарий</label>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full p-2 rounded bg-dark-primary text-white border border-gray-600 min-h-[100px]"
              placeholder="Напишите ваш комментарий..."
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            disabled={createCommentMutation.isPending}
          >
            {createCommentMutation.isPending ? 'Отправка...' : 'Отправить комментарий'}
          </button>
        </form>

        {commentsError ? (
          <div className="text-red-600">Ошибка при загрузке комментариев</div>
        ) : comments?.length === 0 ? (
          <p className="text-white">Пока нет комментариев</p>
        ) : (
          <div className="space-y-6">
            {comments?.filter(comment => !comment.parent_comment_id).map((comment) => (
              <div key={comment.comment_id} className="bg-dark-primary rounded-lg p-4 sm:p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <img 
                      src={comment.user.photo} 
                      alt={comment.user.username} 
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{comment.user.username}</span>
                        {comment.user.is_premium && (
                          <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-xs text-white">
                            Премиум
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-400">{comment.user.title}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    {[...Array(10)].map((_, i) => (
                      <FaStar
                        key={i}
                        className={`text-sm ${
                          i < comment.rating ? 'text-yellow-500' : 'text-gray-400'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-400">
                      {new Date(comment.created_at).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                </span>
                  </div>
                </div>
                <p className="text-white mb-4">{comment.content}</p>
                
                {/* Вложенные комментарии */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="ml-8 sm:ml-12 space-y-4 mt-4 border-l-2 border-gray-700 pl-4">
                    {comment.replies.map((reply) => (
                      <div key={reply.comment_id} className="bg-dark-secondary rounded-lg p-3 sm:p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <img 
                              src={reply.user.photo} 
                              alt={reply.user.username} 
                              className="w-8 h-8 rounded-full"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white text-sm">{reply.user.username}</span>
                                {reply.user.is_premium && (
                                  <span className="px-1.5 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-xs text-white">
                                    Премиум
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-400">{reply.user.title}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center">
                              {[...Array(10)].map((_, i) => (
                                <FaStar
                                  key={i}
                                  className={`text-xs ${
                                    i < reply.rating ? 'text-yellow-500' : 'text-gray-400'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-gray-400">
                              {new Date(reply.created_at).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                        <p className="text-white text-sm">{reply.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            </div>
        )}
      </div>

      {/* Модальное окно подтверждения покупки */}
      {showPurchaseModal && episodeToPurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-secondary rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Подтверждение покупки</h3>
            <div className="space-y-4">
              <p className="text-white">
                Вы собираетесь купить эпизод {episodeToPurchase.episode_number}: {episodeToPurchase.title}
              </p>
              {user?.is_premium && (
                <div className="bg-yellow-500 bg-opacity-20 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-500">
                    <FaCrown />
                    <span>У вас есть премиум-доступ! Вы можете смотреть этот эпизод бесплатно.</span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between bg-dark-primary p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <FaCoins className="text-yellow-500" />
                  <span className="text-white">Ваш баланс:</span>
                </div>
                <span className="text-white font-semibold">{user?.money || 0} монет</span>
              </div>
              <div className="flex items-center justify-between bg-dark-primary p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <FaCoins className="text-yellow-500" />
                  <span className="text-white">Стоимость:</span>
                </div>
                <span className="text-white font-semibold">{episodeToPurchase.cost} монет</span>
              </div>
              <div className="flex items-center justify-between bg-dark-primary p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <FaCoins className="text-yellow-500" />
                  <span className="text-white">Останется после покупки:</span>
                </div>
                <span className="text-white font-semibold">
                  {((user?.money || 0) - episodeToPurchase.cost).toFixed(1)} монет
                </span>
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  onClick={() => {
                    setShowPurchaseModal(false)
                    setEpisodeToPurchase(null)
                  }}
                >
                  Отмена
                </button>
                <button
                  className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                  onClick={handleConfirmPurchase}
                  disabled={purchaseMutation.isPending || (user?.money || 0) < episodeToPurchase.cost}
                >
                  {purchaseMutation.isPending ? 'Покупка...' : 'Подтвердить покупку'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно создания эпизода */}
      {showCreateEpisodeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-secondary rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Создание нового эпизода</h3>
            <form onSubmit={handleCreateEpisode} className="space-y-4">
              <div>
                <label className="block text-white mb-2">Название эпизода</label>
                <input
                  type="text"
                  value={createEpisodeForm.title}
                  onChange={(e) => setCreateEpisodeForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full p-2 rounded bg-dark-primary text-white border border-gray-600"
                  required
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-white mb-2">Номер эпизода</label>
                <input
                  type="number"
                  value={createEpisodeForm.episode_number || ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? '' : parseInt(e.target.value)
                    if (!isNaN(value as number)) {
                      setCreateEpisodeForm(prev => ({ ...prev, episode_number: value as number }))
                    }
                  }}
                  className="w-full p-2 rounded bg-dark-primary text-white border border-gray-600"
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="block text-white mb-2">Видеофайл (макс. 100MB)</label>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/ogg"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      if (file.size > 100 * 1024 * 1024) {
                        toast.error('Размер файла не должен превышать 100MB')
                        e.target.value = ''
                        return
                      }
                      if (!['video/mp4', 'video/webm', 'video/ogg'].includes(file.type)) {
                        toast.error('Поддерживаются только форматы MP4, WebM и OGG')
                        e.target.value = ''
                        return
                      }
                      setCreateEpisodeForm(prev => ({ ...prev, video: file }))
                    }
                  }}
                  className="w-full p-2 rounded bg-dark-primary text-white border border-gray-600"
                  required
                />
                <p className="text-sm text-gray-400 mt-1">
                  Поддерживаемые форматы: MP4, WebM, OGG
                </p>
              </div>
              <div>
                <label className="block text-white mb-2">Стоимость (монеты)</label>
                <input
                  type="number"
                  value={createEpisodeForm.cost || ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? '' : parseFloat(e.target.value)
                    if (!isNaN(value as number)) {
                      setCreateEpisodeForm(prev => ({ ...prev, cost: value as number }))
                    }
                  }}
                  className="w-full p-2 rounded bg-dark-primary text-white border border-gray-600"
                  min="0"
                  step="0.1"
                  required
                />
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  onClick={() => setShowCreateEpisodeModal(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  disabled={isCreatingEpisode}
                >
                  {isCreatingEpisode ? 'Создание...' : 'Создать эпизод'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
} 