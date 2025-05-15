import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { auth } from '@/config/api'

export default function Navbar() {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => auth.getProfile(),
    retry: false
  })

  return (
    <nav className="bg-dark-primary shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 sm:h-20">
          <div className="flex items-center">
            <Link to="/" className="text-white text-lg sm:text-xl font-bold">
              NubeMovie
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {user && (
              <>
                {user.is_premium && (
                  <div className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1 rounded-full">
                    <span className="text-white text-sm">Премиум</span>
                  </div>
                )}
                <div className="flex items-center gap-1 sm:gap-2 bg-dark-secondary px-2 sm:px-3 py-1 rounded-full">
                  <span className="text-yellow-400 text-sm sm:text-base">💰</span>
                  <span className="text-white text-sm sm:text-base">{user.money}</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <img
                    src={user.photo}
                    alt={user.username}
                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full"
                  />
                  <Link to="/profile" className="text-white text-sm sm:text-base hover:text-gray-300 hidden sm:block">
                    {user.username}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
} 