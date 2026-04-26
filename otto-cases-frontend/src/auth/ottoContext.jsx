import React, { createContext, useContext, useState, useEffect } from 'react';
import { setGlobalToken } from '../api/client';
import { auth, signInWithGoogle, signOutUser } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext({
    token: null,
    uid: null,
    email: null,
    status: 'loading', // 'loading' | 'authenticated' | 'standalone-login' | 'no-shell'
    loginWithGoogle: async () => {},
    logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [authState, setAuthState] = useState({
        token: null,
        uid: null,
        email: null,
        status: 'loading',
        loginWithGoogle: async () => {},
        logout: async () => {},
    });

    // Detecta se está rodando embutido num iframe (modo PWA-shell)
    const isEmbedded = window.parent !== window;

    useEffect(() => {
        // ── Modo desenvolvimento local ────────────────────────────────
        const devToken = import.meta.env.VITE_DEV_TOKEN;
        if (devToken && !isEmbedded) {
            setGlobalToken(devToken);
            setAuthState(prev => ({
                ...prev,
                token: devToken,
                uid: 'dev-user',
                email: 'dev@example.com',
                status: 'authenticated',
            }));
            return;
        }

        // ── Modo embutido: recebe token do PWA-shell via postMessage ──
        if (isEmbedded) {
            const handleMessage = (event) => {
                if (event.data?.type === 'otto-context') {
                    const { firebaseToken, uid, email } = event.data.payload || {};
                    if (firebaseToken) {
                        setGlobalToken(firebaseToken);
                        setAuthState(prev => ({
                            ...prev,
                            token: firebaseToken,
                            uid,
                            email,
                            status: 'authenticated',
                        }));
                    }
                }
            };

            window.addEventListener('message', handleMessage);

            // Se o shell não responder em 10s, mostra tela de login próprio.
            // O ModuleFrame reenvia o token até 3x (0s, 2s, 4s), então 10s é margem segura.
            const timer = setTimeout(() => {
                setAuthState(prev => {
                    if (prev.status === 'loading') {
                        return { ...prev, status: 'standalone-login' };
                    }
                    return prev;
                });
            }, 10000);

            return () => {
                window.removeEventListener('message', handleMessage);
                clearTimeout(timer);
            };
        }

        // ── Modo standalone: Firebase Auth direto ─────────────────────
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const token = await user.getIdToken();
                setGlobalToken(token);
                setAuthState(prev => ({
                    ...prev,
                    token,
                    uid: user.uid,
                    email: user.email,
                    status: 'authenticated',
                }));
            } else {
                setAuthState(prev => ({
                    ...prev,
                    token: null,
                    uid: null,
                    email: null,
                    status: 'standalone-login',
                }));
            }
        });

        return () => unsubscribe();
    }, []);

    const loginWithGoogle = async () => {
        try {
            const { user, token } = await signInWithGoogle();
            setGlobalToken(token);
            setAuthState(prev => ({
                ...prev,
                token,
                uid: user.uid,
                email: user.email,
                status: 'authenticated',
            }));
        } catch (err) {
            console.error('Erro no login Google:', err);
        }
    };

    const logout = async () => {
        await signOutUser();
        setGlobalToken(null);
        setAuthState(prev => ({
            ...prev,
            token: null,
            uid: null,
            email: null,
            status: 'standalone-login',
        }));
    };

    return (
        <AuthContext.Provider value={{ ...authState, loginWithGoogle, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
