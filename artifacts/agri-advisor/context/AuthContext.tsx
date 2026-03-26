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

  const saveAuthData = async (authResponse: AuthResponse) => {
    setToken(authResponse.token);
    setUser(authResponse.user);
    await AsyncStorage.setItem('token', authResponse.token);
    await AsyncStorage.setItem('user', JSON.stringify(authResponse.user));
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

  const logout = async () => {
    try {
      await AuthService.logout();
    } finally {
      setToken(null);
      setUser(null);
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('neonToken');
    }
  };

  const restoreToken = async () => {
    await bootstrapAsync();
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, signup, login, googleLogin, logout, restoreToken }}
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