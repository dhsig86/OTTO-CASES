import axios from 'axios';

let currentToken = null;

export const setGlobalToken = (token) => {
    currentToken = token;
};

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

// Request Interceptor
api.interceptors.request.use((config) => {
    // Lê o token sempre fresco
    if (currentToken) {
        config.headers['Authorization'] = `Bearer ${currentToken}`;
    }
    return config;
}, (error) => Promise.reject(error));

// Response Interceptor para Refresh Token / Sessão Expirada
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true; // flag para evitar loops infinitos
            
            // Dispara evento para o PWA (Shell pai) pedindo novo token
            if (window.parent !== window) {
                window.parent.postMessage({ type: 'otto-request-refresh' }, '*');
                
                // Aguarda até 10s pelo novo token
                return new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        window.removeEventListener('message', messageListener);
                        reject(error); // desiste
                    }, 10000);

                    const messageListener = (event) => {
                        if (event.data?.type === 'otto-context' && event.data?.payload?.firebaseToken) {
                            clearTimeout(timeout);
                            window.removeEventListener('message', messageListener);
                            setGlobalToken(event.data.payload.firebaseToken);
                            
                            // refaz a requisição original
                            originalRequest.headers['Authorization'] = `Bearer ${event.data.payload.firebaseToken}`;
                            resolve(api(originalRequest));
                        }
                    };
                    
                    window.addEventListener('message', messageListener);
                });
            }
        }
        
        return Promise.reject(error);
    }
);

export default api;
