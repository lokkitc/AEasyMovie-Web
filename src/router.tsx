import { createBrowserRouter } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Home from './pages/Home'
import Movies from './pages/Movies'
import MovieDetails from './pages/MovieDetails'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Profile from './pages/Profile'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Users from './pages/Users'
import GoogleCallback from './pages/auth/GoogleCallback'
import UserProfile from './components/UserProfile'
import CreateMovie from './components/CreateMovie'

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      children: [
        {
          index: true,
          element: <Home />,
        },
        {
          path: 'movies',
          element: <Movies />,
        },
        {
          path: 'movies/create',
          element: (
            <ProtectedRoute>
              <CreateMovie />
            </ProtectedRoute>
          ),
        },
        {
          path: 'movies/:id',
          element: <MovieDetails />,
        },
        {
          path: 'login',
          element: <Login />,
        },
        {
          path: 'register',
          element: <Register />,
        },
        {
          path: 'users',
          element: <Users />,
        },
        {
          path: 'users/:userId',
          element: <UserProfile />,
        },
        {
          path: 'profile',
          element: (
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          ),
        },
      ],
    },
    {
      path: '/auth/callback',
      element: <GoogleCallback />,
    },
  ],
  {
    future: {
      v7_normalizeFormMethod: true,
      v7_relativeSplatPath: true,
      v7_startTransition: true
    },
  }
) 