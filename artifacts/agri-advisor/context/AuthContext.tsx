import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

type User = {
  id: string;
  name: string;
  phone: string;
  location: string;
  cropTypes: string[];
  language: string;
  avatar?: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  signIn: (userData: User) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
  updateUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const stored = await AsyncStorage.getItem("agri_user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load user", e);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (userData: User) => {
    await AsyncStorage.setItem("agri_user", JSON.stringify(userData));
    setUser(userData);
  };

  const signOut = async () => {
    await AsyncStorage.removeItem("agri_user");
    setUser(null);
  };

  const updateUser = async (data: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...data };
    await AsyncStorage.setItem("agri_user", JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
