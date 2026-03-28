import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService, User, AuthResponse } from '@/services/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signup: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (neonToken: string, userData: any) => Promise<void>;
  updateProfile: (name: string, location: string) => Promise<{ savedRemotely: boolean }>;
  logout: () => Promise<void>;
  restoreToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore token on app startup
  useEffect(() => {
    bootstrapAsync();
  }, []);

  const bootstrapAsync = async () => {
    try {
      const data = await AuthService.restoreToken();
      if (data) {
        setToken(data.token);
        setUser(data.user);
      }
    } catch (error) {
      console.error('Failed to restore token:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const persistUser = async (nextUser: User | null) => {
    setUser(nextUser);
    if (nextUser) {
      await AsyncStorage.setItem('user', JSON.stringify(nextUser));
    } else {
      await AsyncStorage.removeItem('user');
    }
  };

  const saveAuthData = async (authResponse: AuthResponse) => {
    setToken(authResponse.token);
    await AsyncStorage.setItem('token', authResponse.token);
    await persistUser(authResponse.user);
    if (authResponse.neonToken) {
      await AsyncStorage.setItem('neonToken', authResponse.neonToken);
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    try {
      const authResponse = await AuthService.signup(email, password, name);
      await saveAuthData(authResponse);
    } catch (error) {
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const authResponse = await AuthService.login(email, password);
      await saveAuthData(authResponse);
    } catch (error) {
      throw error;
    }
  };

  const googleLogin = async (neonToken: string, userData: any) => {
    try {
      const authResponse = await AuthService.handleGoogleCallback(neonToken, userData);
      await saveAuthData(authResponse);
    } catch (error) {
      throw error;
    }
  };

  const updateProfile = async (name: string, location: string) => {
    if (!user) {
      throw new Error('You need to be signed in to update your profile.');
    }

    const trimmedName = name.trim();
    const trimmedLocation = location.trim();
    const optimisticUser: User = {
      ...user,
      name: trimmedName,
      location: trimmedLocation,
    };

    try {
      const remoteUser = await AuthService.updateProfile(trimmedName, trimmedLocation);
      await persistUser({
        ...optimisticUser,
        ...remoteUser,
        location: remoteUser.location ?? trimmedLocation,
      });
      return { savedRemotely: true };
    } catch (error: any) {
      const message = String(error?.message || "").toLowerCase();
      const shouldFallbackToLocal =
        message.includes('unreachable') ||
        message.includes('temporarily unavailable') ||
        message.includes('database') ||
        message.includes('timeout') ||
        message.includes('fetch failed') ||
        message.includes('network');

      if (!shouldFallbackToLocal) {
        throw error;
      }

      await persistUser(optimisticUser);
      return { savedRemotely: false };
    }
  };

  const logout = async () => {
    try {
      await AuthService.logout();
    } finally {
      setToken(null);
      await AsyncStorage.removeItem('token');
      await persistUser(null);
      await AsyncStorage.removeItem('neonToken');
    }
  };

  const restoreToken = async () => {
    await bootstrapAsync();
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, signup, login, googleLogin, updateProfile, logout, restoreToken }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
