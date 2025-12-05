import React, { useContext, useEffect, useState } from 'react';
import { Tooltip } from 'primereact/tooltip';
import { LayoutContext } from './context/layoutcontext';
import { useRouter } from 'next/navigation';
import { API_BASE } from '@/services/apiClient';
import { getMyAvatarUrl, getMyProfile, UserProfile } from '@/services/profile';

const AppMenuProfile = () => {
    const { layoutConfig, isSlim } = useContext(LayoutContext);
    const router = useRouter();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    const buildAvatarUrl = (path?: string | null) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        const normalized = path.startsWith('/') ? path : `/${path}`;
        return `${API_BASE}${normalized}`;
    };

    useEffect(() => {
        const buildAvatarUrl = (path?: string | null) => {
            if (!path) return null;
            if (path.startsWith('http')) return path;
            const normalized = path.startsWith('/') ? path : `/${path}`;
            return `${API_BASE}${normalized}`;
        };

        const loadUser = async () => {
            const token = window.localStorage.getItem('backend_token');
            const cachedUserRaw = window.localStorage.getItem('backend_user');

            console.log('[AppMenuProfile] Loading user with token:', !!token);

            // Si no hay token, limpiar el estado
            if (!token) {
                setUser(null);
                setAvatarUrl(null);
                return;
            }

            // Set cached data first for instant paint
            if (cachedUserRaw) {
                try {
                    const cachedUser = JSON.parse(cachedUserRaw) as UserProfile;
                    console.log('[AppMenuProfile] Cached user:', cachedUser.full_name, 'avatar_path:', cachedUser.avatar_path);
                    setUser(cachedUser);
                    setAvatarUrl(buildAvatarUrl(cachedUser.avatar_path));
                } catch (err) {
                    console.error('Error parsing user data:', err);
                }
            }

            try {
                const freshUser = await getMyProfile(token);
                console.log('[AppMenuProfile] Fresh user loaded:', freshUser.full_name, 'avatar_path:', freshUser.avatar_path);
                setUser(freshUser);

                // Persist refreshed user data
                window.localStorage.setItem('backend_user', JSON.stringify(freshUser));

                // Prefer dedicated avatar endpoint if available
                const avatarData = await getMyAvatarUrl(token).catch(() => null);
                console.log('[AppMenuProfile] Avatar data from endpoint:', avatarData);
                const url = avatarData?.url ? buildAvatarUrl(avatarData.url) : buildAvatarUrl(freshUser.avatar_path);
                console.log('[AppMenuProfile] Final avatar URL:', url);
                setAvatarUrl(url);
            } catch (err) {
                console.error('Error loading profile for menu:', err);
                // Si falla la llamada, limpiar el estado
                setUser(null);
                setAvatarUrl(null);
            }
        };

        loadUser();

        // Escuchar cambios en el storage (cuando se inicia/cierra sesión)
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'backend_token' || e.key === 'backend_user') {
                loadUser();
            }
        };

        // Escuchar evento personalizado de logout
        const handleLogout = () => {
            setUser(null);
            setAvatarUrl(null);
        };

        const handleLogin = () => {
            loadUser();
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('user-logout', handleLogout);
        window.addEventListener('user-login', handleLogin);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('user-logout', handleLogout);
            window.removeEventListener('user-login', handleLogin);
        };
    }, []);

    useEffect(() => {
        const onAvatarUpdated = (e: any) => {
            const detail = e?.detail || {};
            setAvatarUrl(detail.url ?? buildAvatarUrl(detail.avatarPath));
            setUser((prev) => (prev ? { ...prev, avatar_path: detail.avatarPath ?? null } : prev));
        };

        window.addEventListener('avatar-updated', onAvatarUpdated);
        return () => window.removeEventListener('avatar-updated', onAvatarUpdated);
    }, []);

    const tooltipValue = (tooltipText: string) => {
        return isSlim() ? tooltipText : null;
    };

    const getRoleLabel = (role: string) => {
        return role === 'THERAPIST' ? 'Terapeuta' : 'Estudiante';
    };

    const handleProfileClick = () => {
        router.push('/profile');
    };

    return (
        <React.Fragment>
            <div className="layout-menu-profile">
                <Tooltip target={'.avatar-button'} content={tooltipValue('Mi Perfil') as string} />
                <button className="avatar-button p-link border-noround" onClick={handleProfileClick}>
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="avatar" className="avatar-image" />
                    ) : (
                        <div className="avatar-placeholder">
                            {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                    )}
                    <span className="layout-menu-profile-text">
                        <strong>{user?.full_name || 'Usuario'}</strong>
                        <small>{user?.role ? getRoleLabel(user.role) : 'Cargando...'}</small>
                    </span>
                </button>
            </div>
        </React.Fragment>
    );
};

export default AppMenuProfile;
