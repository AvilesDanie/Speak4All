'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import type { Page } from '@/types';

const Custom404: Page = () => {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const token = window.localStorage.getItem('backend_token');
        const user = window.localStorage.getItem('backend_user');
        setIsAuthenticated(Boolean(token && user));
    }, []);

    const handleRedirect = () => {
        router.push(isAuthenticated ? '/' : '/auth/login2');
    };

    return (
        <div
            className="flex justify-content-center align-items-center"
            style={{
                minHeight: '100vh',
                background:
                    'radial-gradient(circle at top left, #4f46e5 0, #7c3aed 18%, #ec4899 45%, #0ea5e9 80%)',
            }}
        >
            <div
                className="surface-card border-round-3xl shadow-6 p-4 md:p-5 text-center"
                style={{
                    maxWidth: '560px',
                    margin: '1.5rem',
                    width: '100%',
                    background: 'rgba(15,23,42,0.95)',
                    color: 'white',
                }}
            >
                <div className="flex align-items-center justify-content-center mb-3">
                    <div
                        className="flex align-items-center justify-content-center border-round-circle"
                        style={{
                            width: '52px',
                            height: '52px',
                            background: 'rgba(79,70,229,0.35)',
                        }}
                    >
                        <i className="pi pi-exclamation-circle" style={{ fontSize: '1.7rem' }} />
                    </div>
                </div>

                <h1 className="m-0 mb-2 text-2xl md:text-4xl font-bold">404</h1>
                <h2 className="m-0 mb-3 text-xl md:text-2xl font-semibold">Página no encontrada</h2>
                <p className="m-0 mb-4" style={{ color: '#cbd5e1' }}>
                    La ruta que intentas abrir no existe o fue movida dentro de Speak4All.
                </p>

                <Button
                    label={isAuthenticated ? 'Ir al Dashboard' : 'Ir a Iniciar sesión'}
                    icon={isAuthenticated ? 'pi pi-home' : 'pi pi-sign-in'}
                    className="w-full md:w-auto p-3 border-round-2xl"
                    onClick={handleRedirect}
                />
            </div>
        </div>
    );
};

export default Custom404;
