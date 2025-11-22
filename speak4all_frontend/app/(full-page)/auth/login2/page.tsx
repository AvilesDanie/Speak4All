'use client';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import React from 'react';
import type { Page } from '@/types';
import { signIn } from 'next-auth/react';

const Login: Page = () => {
    const router = useRouter();

    const handleGoogleLogin = () => {
        signIn('google', { callbackUrl: '/' });
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
                className="surface-card border-round-3xl shadow-6 grid w-full"
                style={{
                    maxWidth: '960px',
                    margin: '1.5rem',
                    overflow: 'hidden',
                    backdropFilter: 'blur(14px)',
                    background: 'rgba(15,23,42,0.95)',
                }}
            >
                {/* Columna izquierda: branding / descripción */}
                <div
                    className="col-12 md:col-6 p-4 md:p-5 flex flex-column justify-content-between"
                    style={{
                        background:
                            'radial-gradient(circle at top left, #6366f1 0, #4f46e5 40%, #312e81 100%)',
                        color: 'white',
                        position: 'relative',
                    }}
                >
                    <div>
                        <div className="flex align-items-center mb-3">
                            <div
                                className="flex align-items-center justify-content-center border-round-circle"
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    background: 'rgba(15,23,42,0.45)',
                                }}
                            >
                                <i className="pi pi-comments" style={{ fontSize: '1.3rem' }} />
                            </div>
                            <span className="ml-2 font-semibold text-lg">Speak4All</span>
                        </div>

                        <h1
                            className="text-2xl md:text-3xl font-bold line-height-3 mb-3"
                            style={{ color: '#f8fafc' }}   // Slate-50
                        >
                            Bienvenido a tu espacio de aprendizaje.
                        </h1>
                        <p className="m-0 text-sm md:text-base opacity-80">
                            Inicia sesión con tu cuenta de Google para acceder a sesiones
                            personalizadas, seguimiento de progreso y herramientas creadas para
                            terapeutas y estudiantes.
                        </p>
                    </div>

                    <div className="mt-4">
                        <div className="flex align-items-center mb-2">
                            <i className="pi pi-check-circle mr-2" />
                            <span className="text-sm">Acceso seguro con Google</span>
                        </div>
                        <div className="flex align-items-center mb-2">
                            <i className="pi pi-check-circle mr-2" />
                            <span className="text-sm">Experiencia adaptada a tu rol</span>
                        </div>
                        <div className="flex align-items-center">
                            <i className="pi pi-check-circle mr-2" />
                            <span className="text-sm">Datos protegidos y cifrados</span>
                        </div>
                    </div>
                </div>

                {/* Columna derecha: tarjeta de login */}
                <div className="col-12 md:col-6 p-4 md:p-5 flex align-items-center justify-content-center">
                    <div
                        className="w-full"
                        style={{
                            maxWidth: '360px',
                        }}
                    >
                        <div className="text-center mb-4">
                            <h2 className="text-xl font-semibold mb-1">Inicia sesión</h2>
                            <p className="m-0 text-600" style={{ fontSize: '0.9rem' }}>
                                Usa tu cuenta de Google para entrar a la plataforma.
                            </p>
                        </div>

                        <Button
                            label="Continuar con Google"
                            icon="pi pi-google"
                            className="w-full p-3 border-round-2xl"
                            onClick={handleGoogleLogin}
                            style={{
                                background: '#ffffff',
                                borderColor: '#e5e7eb',
                                color: '#111827',
                                fontWeight: 500,
                            }}
                        />

                        <div className="mt-4 text-center">
                            <small className="text-600" style={{ fontSize: '0.8rem' }}>
                                Al continuar aceptas nuestras políticas de privacidad y términos de
                                uso.
                            </small>
                        </div>

                        <div className="mt-4 flex align-items-center justify-content-center">
                            <span
                                className="inline-flex align-items-center px-3 py-1 border-round-2xl text-600"
                                style={{
                                    backgroundColor: '#f3f4f6',
                                    fontSize: '0.8rem',
                                }}
                            >
                                <i className="pi pi-lock mr-2" />
                                Autenticación segura mediante OAuth 2.0
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
