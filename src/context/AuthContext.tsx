import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { auth, googleProvider, getUserRole, COORDINATION_EMAIL } from '../lib/firebase';

export type UserRole = 'Coordenação' | 'Leitor';

interface AuthContextType {
  user: User | null;
  userEmail: string | null;
  isAuthenticated: boolean;
  role: UserRole;
  isCoordination: boolean;
  isReader: boolean;
  loading: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginAsDemo: (demoEmail: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [customDemoEmail, setCustomDemoEmail] = useState<string | null>(() => {
    return localStorage.getItem('lthac_demo_user_email');
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const effectiveEmail = user?.email || customDemoEmail;
  const role: UserRole = getUserRole(effectiveEmail);
  const isCoordination = role === 'Coordenação';
  const isReader = role === 'Leitor';

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      localStorage.removeItem('lthac_demo_user_email');
      setCustomDemoEmail(null);
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (err: any) {
      // If user doesn't exist yet, try creating it automatically for seamless first-time access
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        try {
          await createUserWithEmailAndPassword(auth, email.trim(), pass);
          return;
        } catch (subErr) {
          throw err;
        }
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signupWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      localStorage.removeItem('lthac_demo_user_email');
      setCustomDemoEmail(null);
      await createUserWithEmailAndPassword(auth, email.trim(), pass);
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      localStorage.removeItem('lthac_demo_user_email');
      setCustomDemoEmail(null);
      await signInWithPopup(auth, googleProvider);
    } finally {
      setLoading(false);
    }
  };

  const loginAsDemo = async (demoEmail: string) => {
    // Allows instant 1-click login for test credentials
    setLoading(true);
    try {
      const email = demoEmail.trim();
      const defaultPass = 'lthac2026';
      
      try {
        await signInWithEmailAndPassword(auth, email, defaultPass);
      } catch (err: any) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          try {
            await createUserWithEmailAndPassword(auth, email, defaultPass);
          } catch (createErr) {
            // Fallback to local session demo state
            setCustomDemoEmail(email);
            localStorage.setItem('lthac_demo_user_email', email);
          }
        } else {
          setCustomDemoEmail(email);
          localStorage.setItem('lthac_demo_user_email', email);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      localStorage.removeItem('lthac_demo_user_email');
      setCustomDemoEmail(null);
      await firebaseSignOut(auth);
    } finally {
      setLoading(false);
    }
  };

  const isAuthenticated = Boolean(user || customDemoEmail);

  return (
    <AuthContext.Provider
      value={{
        user,
        userEmail: effectiveEmail,
        isAuthenticated,
        role,
        isCoordination,
        isReader,
        loading,
        loginWithEmail,
        signupWithEmail,
        loginWithGoogle,
        loginAsDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
