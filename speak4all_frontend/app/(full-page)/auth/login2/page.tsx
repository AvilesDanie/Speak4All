'use client';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Dropdown } from 'primereact/dropdown';
import React, { useState } from 'react';
import type { Page } from '@/types';
import { signIn } from 'next-auth/react';

const Login: Page = () => {
    const router = useRouter();

    // Estado para login/registro local
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState<'THERAPIST' | 'STUDENT' | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGoogleLogin = () => {
        signIn('google', { callbackUrl: '/' });
    };

    const handleLocalAuth = async () => {
        try {
            setLoading(true);
            setError(null);

            if (!email || !password) {
                setError('Completa email y contraseña.');
                return;
            }

            if (mode === 'register') {
                if (!fullName || !role) {
                    setError('Completa nombre y rol.');
                    return;
                }
                const res = await fetch('/api/backend/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, full_name: fullName, role }),
                });
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({ detail: 'No se pudo registrar.' }));
                    setError(errorData.detail || 'No se pudo registrar.');
                    return;
                }
                const data = await res.json();
                // Guardar correctamente el usuario y token
                window.localStorage.setItem('backend_synced', 'true');
                window.localStorage.setItem('backend_token', data.token.access_token);
                window.localStorage.setItem('backend_user', JSON.stringify(data.user));
                // Disparar evento para que los componentes se actualicen
                window.dispatchEvent(new CustomEvent('user-login', { detail: { user: data.user, token: data.token.access_token } }));
                router.replace('/');
                return;
            }

            // login
            const res = await fetch('/api/backend/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ detail: 'Credenciales inválidas.' }));
                setError(errorData.detail || 'Credenciales inválidas.');
                return;
            }
            const data = await res.json();
            // Guardar correctamente el usuario y token
            window.localStorage.setItem('backend_synced', 'true');
            window.localStorage.setItem('backend_token', data.token.access_token);
            window.localStorage.setItem('backend_user', JSON.stringify(data.user));
            router.replace('/');
        } catch (e) {
            setError('Error de red. Intenta nuevamente.');
        } finally {
            setLoading(false);
        }
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
                                Usa Google o tu correo para entrar.
                            </p>
                        </div>

                        {/* Google */}
                        <Button
                            label="Continuar con Google"
                            icon="pi pi-google"
                            className="w-full p-3 border-round-2xl mb-3"
                            onClick={handleGoogleLogin}
                            style={{
                                background: '#ffffff',
                                borderColor: '#e5e7eb',
                                color: '#111827',
                                fontWeight: 500,
                            }}
                        />

                        {/* Divider */}
                        <div className="flex align-items-center my-3">
                            <div className="flex-1" style={{ height: 1, background: '#e5e7eb' }} />
                            <span className="px-2 text-600" style={{ fontSize: '0.8rem' }}>o</span>
                            <div className="flex-1" style={{ height: 1, background: '#e5e7eb' }} />
                        </div>

                        {/* Local auth */}
                        <div className="grid">
                            {mode === 'register' && (
                                <div className="col-12 mb-2">
                                    <label className="text-600 text-sm mb-1 block">Nombre completo</label>
                                    <InputText value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full" />
                                </div>
                            )}
                            <div className="col-12 mb-2">
                                <label className="text-600 text-sm mb-1 block">Correo</label>
                                <InputText value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
                            </div>
                            <div className="col-12 mb-2">
                                <label className="text-600 text-sm mb-1 block">Contraseña</label>
                                <Password value={password} onChange={(e) => setPassword(e.target.value)} className="w-full" inputClassName="w-full" toggleMask feedback={false} />
                            </div>
                            {mode === 'register' && (
                                <div className="col-12 mb-2">
                                    <label className="text-600 text-sm mb-1 block">Rol</label>
                                    <Dropdown value={role} onChange={(e) => setRole(e.value)} className="w-full" options={[{ label: 'Terapeuta', value: 'THERAPIST' }, { label: 'Estudiante', value: 'STUDENT' }]} placeholder="Selecciona rol" />
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="p-2 border-round text-red-500" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>{error}</div>
                        )}

                        <Button
                            label={mode === 'login' ? 'Entrar' : 'Crear cuenta'}
                            icon={mode === 'login' ? 'pi pi-sign-in' : 'pi pi-user-plus'}
                            className="w-full p-3 border-round-2xl mt-2"
                            onClick={handleLocalAuth}
                            loading={loading}
                        />

                        <div className="mt-3 text-center">
                            <Button
                                label={mode === 'login' ? 'Crear una cuenta' : 'Ya tengo cuenta'}
                                className="p-button-text"
                                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                            />
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
                                Autenticación con Google y con correo
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
