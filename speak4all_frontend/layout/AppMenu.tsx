import { useEffect, useState } from 'react';
import AppSubMenu from './AppSubMenu';
import type { MenuModel } from '@/types';

const AppMenu = () => {
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        // Cargar rol del usuario desde localStorage
        const loadUserRole = () => {
            if (typeof window !== 'undefined') {
                const userRaw = localStorage.getItem('backend_user');
                if (userRaw) {
                    try {
                        const user = JSON.parse(userRaw);
                        setUserRole(user.role);
                    } catch {
                        setUserRole(null);
                    }
                }
            }
        };

        loadUserRole();

        // Escuchar cambios en el usuario (login/logout)
        const handleUserChange = () => {
            loadUserRole();
        };

        window.addEventListener('user-login', handleUserChange);
        window.addEventListener('user-logout', handleUserChange);
        window.addEventListener('storage', (e) => {
            if (e.key === 'backend_user') {
                loadUserRole();
            }
        });

        return () => {
            window.removeEventListener('user-login', handleUserChange);
            window.removeEventListener('user-logout', handleUserChange);
        };
    }, []);

    const model: MenuModel[] = [
        {
            label: 'Aplicaciones ',
            icon: 'pi pi-th-large',
            items: [
                {
                    label: 'Cursos',
                    icon: 'pi pi-fw pi-book',
                    to: '/courses'
                },
                // Solo mostrar Ejercicios (IA) a terapeutas
                ...(userRole === 'THERAPIST' ? [{
                    label: 'Ejercicios (IA)',
                    icon: 'pi pi-fw pi-microchip-ai',
                    to: '/exercises'
                }] : [])
            ]
        }
    ];

    return <AppSubMenu model={model} />;
};

export default AppMenu;
