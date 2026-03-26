import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface User {
  id: number;
  email: string;
  name?: string;
  picture?: string;
}

export interface AuthResponse {
  token: string;
  neonToken?: string;
  user: User;
}

// Create axios instance with token management
const apiClient = axios.create({
  baseURL: `${API_URL}/auth`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests automatically
apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const AuthService = {
  /**
   * Sign up with email and password
   */
  async signup(email: string, password: string, name: string): Promise<AuthResponse> {
    try {
      console.log('🚀 Signup attempt:', { email, apiUrl: API_URL });
      const response = await apiClient.post<AuthResponse>('/signup', {
        email,
        password,
        name,
      });
      console.log('✅ Signup successful');
      return response.data;
    } catch (error: any) {
      console.error('❌ Signup error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        apiUrl: API_URL,
      });
      
      // Provide more specific error messages
      if (error.message === 'Network Error' || !error.response) {
        throw new Error(`Cannot connect to server at ${API_URL}. Make sure API is running and IP is correct for your device.`);
      }
      if (error.response?.status === 400) {
        throw new Error(error.response.data?.error || 'Invalid email or password format');
      }
      if (error.response?.status === 409) {
        throw new Error('Email already registered. Please login instead.');
      }
      throw new Error(
        error.response?.data?.error || 'Sign up failed. Please try again.'
      );
    }
  },

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      console.log('🚀 Login attempt:', { email, apiUrl: API_URL });
      const response = await apiClient.post<AuthResponse>('/login', {
        email,
        password,
      });
      console.log('✅ Login successful');
      return response.data;
    } catch (error: any) {
      console.error('❌ Login error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        apiUrl: API_URL,
      });
      
      if (error.message === 'Network Error' || !error.response) {
        throw new Error(`Cannot connect to server at ${API_URL}. Make sure API is running.`);
      }
      throw new Error(
        error.response?.data?.error || 'Login failed. Invalid credentials.'
      );
    }
  },

  /**
   * Google OAuth callback (after Neon redirects)
   */
  async handleGoogleCallback(neonToken: string, userData: any): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/google-callback', {
        neonToken,
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        sub: userData.sub,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error || 'Google authentication failed.'
      );
    }
  },

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User> {
    try {
      const response = await apiClient.get<{ user: User }>('/me');
      return response.data.user;
    } catch (error: any) {
      throw new Error('Failed to fetch user');
    }
  },

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/logout');
    } catch (error) {
      console.log('Logout error:', error);
      // Continue logout even if API call fails
    }
  },

  /**
   * Restore token from storage (for app startup)
   */
  async restoreToken(): Promise<{ token: string; user: User } | null> {
    try {
      const token = await AsyncStorage.getItem('token');
      const userJson = await AsyncStorage.getItem('user');

      if (token && userJson) {
        const user = JSON.parse(userJson);
        return { token, user };
      }
      return null;
    } catch (error) {
      console.error('Token restore error:', error);
      return null;
    }
  },

  /**
   * Update user profile (name and location)
   */
  async updateProfile(name: string, location: string): Promise<User> {
    try {
      const response = await apiClient.patch<{ user: User }>('/profile', {
        name,
        location,
      });
      return response.data.user;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error || 'Failed to update profile'
      );
    }
  },

  /**
   * Change user password
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      await apiClient.post('/change-password', {
        currentPassword,
        newPassword,
      });
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error || 'Failed to change password'
      );
    }
  },
};
