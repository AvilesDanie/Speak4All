import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { BackendUser, Role, getUserByGoogleSub } from '@/services/auth';

export interface UseAuthReturn {
    user: BackendUser | null;
    token: string | null;
    role: Role | null;
    loading: boolean;
    isAuthenticated: boolean;
}

/**
 * Hook centralizado para manejar autenticación
 * Siempre consulta el backend si hay sesión de Google para obtener el usuario actualizado
 */
export function useAuth(): UseAuthReturn {
    const { data: session, status } = useSession();
    const [user, setUser] = useState<BackendUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const loadAuth = async () => {
            setLoading(true);
            try {
                // 1. Obtener del localStorage primero (login local)
                const storedToken = window.localStorage.getItem('backend_token');
                const storedUserRaw = window.localStorage.getItem('backend_user');
                let localUser: BackendUser | null = null;
                if (storedToken && storedUserRaw) {
                    try {
                        localUser = JSON.parse(storedUserRaw) as BackendUser;
                        setToken(storedToken);
                        setUser(localUser);
                    } catch (e) {
                        window.localStorage.removeItem('backend_user');
                        window.localStorage.removeItem('backend_token');
                    }
                }

                // 2. Si hay sesión de Google, siempre consulta el backend para obtener el usuario actualizado
                if (status === 'authenticated' && session) {
                    const googleSub = (session as any)?.google_sub;
                    if (googleSub) {
                        try {
                            const userData = await getUserByGoogleSub(googleSub);
                            setUser(userData);

                            // Re-leer el token por si se acaba de guardar en layout.tsx
                            const freshToken = window.localStorage.getItem('backend_token');
                            if (freshToken) {
                                setToken(freshToken);
                            }

                            // Actualizar localStorage
                            window.localStorage.setItem('backend_user', JSON.stringify(userData));
                        } catch {
                            // Si falla, mantener el usuario local
                        }
                    }
                }
            } finally {
                setLoading(false);
            }
        };

        loadAuth();
        
        // Escuchar cambios en localStorage (cuando layout.tsx guarda el token)
        const handleStorageChange = () => {
            const newToken = window.localStorage.getItem('backend_token');
            const newUserRaw = window.localStorage.getItem('backend_user');
            
            if (newToken && newUserRaw) {
                try {
                    const newUser = JSON.parse(newUserRaw) as BackendUser;
                    setToken(newToken);
                    setUser(newUser);
                } catch (e) {
                    // ignore
                }
            }
        };
        
        window.addEventListener('storage', handleStorageChange);
        
        // También revisar periódicamente por cambios locales (mismo tab)
        const interval = setInterval(() => {
            const currentToken = window.localStorage.getItem('backend_token');
            if (currentToken && currentToken !== token) {
                handleStorageChange();
            }
        }, 500);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, [session, status]);

    return {
        user,
        token,
        role: user?.role || null,
        loading,
        isAuthenticated: !!token && !!user,
    };
}
