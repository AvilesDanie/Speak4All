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

            // Set cached data first for instant paint
            if (cachedUserRaw) {
                try {
                    const cachedUser = JSON.parse(cachedUserRaw) as UserProfile;
                    setUser(cachedUser);
                    setAvatarUrl(buildAvatarUrl(cachedUser.avatar_path));
                } catch (err) {
                    console.error('Error parsing user data:', err);
                }
            }

            if (!token) return;

            try {
                const freshUser = await getMyProfile(token);
                setUser(freshUser);

                // Persist refreshed user data
                window.localStorage.setItem('backend_user', JSON.stringify(freshUser));

                // Prefer dedicated avatar endpoint if available
                const avatarData = await getMyAvatarUrl(token).catch(() => null);
                const url = avatarData?.url ? buildAvatarUrl(avatarData.url) : buildAvatarUrl(freshUser.avatar_path);
                setAvatarUrl(url);
            } catch (err) {
                console.error('Error loading profile for menu:', err);
            }
        };

        loadUser();
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
                        <img src={avatarUrl} alt="avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                            {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                    )}
                    <span>
                        <strong>{user?.full_name || 'Usuario'}</strong>
                        <small>{user?.role ? getRoleLabel(user.role) : 'Cargando...'}</small>
                    </span>
                </button>
            </div>
        </React.Fragment>
    );
};

export default AppMenuProfile;
