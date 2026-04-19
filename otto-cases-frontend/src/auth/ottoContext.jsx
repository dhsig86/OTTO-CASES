import React, { createContext, useContext, useState, useEffect } from 'react';
import { setGlobalToken } from '../api/client';

const AuthContext = createContext({
    token: null,
    uid: null,
    email: null,
    status: 'loading' // 'loading', 'authenticated', 'no-shell'
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [authState, setAuthState] = useState({
        token: null,
        uid: null,
        email: null,
        status: 'loading'
    });

    useEffect(() => {
        // Fallback para desenvolvimento local sem o PWA
        const devToken = import.meta.env.VITE_DEV_TOKEN;
        if (devToken && window.parent === window) {
            setGlobalToken(devToken);
            setAuthState({
                token: devToken,
                uid: 'dev-user',
                email: 'dev@example.com',
                status: 'authenticated'
            });
            return;
        }

        const handleMessage = (event) => {
            // OBS: Adicione if (event.origin !== 'https://pwa.otto.med.br') return; para produção se desejar
            
            if (event.data?.type === 'otto-context') {
                const { firebaseToken, uid, email } = event.data.payload || {};
                if (firebaseToken) {
                    setGlobalToken(firebaseToken);
                    setAuthState({
                        token: firebaseToken,
                        uid,
                        email,
                        status: 'authenticated'
                    });
                }
            }
        };

        window.addEventListener('message', handleMessage);

        // Timeout: se após 8s não receber o contexto, mostra 'no-shell'
        const timer = setTimeout(() => {
            setAuthState((prev) => {
                if (prev.status === 'loading') {
                    return { ...prev, status: 'no-shell' };
                }
                return prev;
            });
        }, 8000);

        return () => {
            window.removeEventListener('message', handleMessage);
            clearTimeout(timer);
        };
    }, []);

    return (
        <AuthContext.Provider value={authState}>
            {children}
        </AuthContext.Provider>
    );
};
