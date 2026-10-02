import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: 'AIzaSyBJzICtjP9tqrrk-VEOW4xvgeAYY9jp_1k',
  authDomain: 'gen-lang-client-0522534070.firebaseapp.com',
  projectId: 'gen-lang-client-0522534070',
  storageBucket: 'gen-lang-client-0522534070.firebasestorage.app',
  messagingSenderId: '671140185879',
  appId: '1:671140185879:web:6d54e130f2abee7dfb9952'
};

// Initialize Firebase safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const COORDINATION_EMAIL = 'lthac20@gmail.com';

export function getUserRole(email: string | null | undefined): 'Coordenação' | 'Leitor' {
  if (!email) return 'Leitor';
  return email.toLowerCase().trim() === COORDINATION_EMAIL.toLowerCase().trim()
    ? 'Coordenação'
    : 'Leitor';
}
