'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Password } from 'primereact/password';

type Role = 'THERAPIST' | 'STUDENT';

export default function SelectRolePage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [registering, setRegistering] = useState(false);

    // Si no está autenticado, mándalo al login
    useEffect(() => {
        if (status === 'loading') return;
        if (status !== 'authenticated') {
            router.replace('/auth/login2');
        }
    }, [status, router]);

    const handleSelectRole = (role: Role) => {
        setSelectedRole(role);
        setShowPasswordDialog(true);
        setPassword('');
        setConfirmPassword('');
        setPasswordError(null);
    };

    const handleRegisterWithPassword = async () => {
        setPasswordError(null);

        // Validación de contraseñas
        if (!password) {
            setPasswordError('Por favor ingresa una contraseña');
            return;
        }

        if (password !== confirmPassword) {
            setPasswordError('Las contraseñas no coinciden');
            return;
        }

        if (password.length < 6) {
            setPasswordError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        if (!session || !selectedRole) return;

        try {
            setRegistering(true);
            const googleSub = (session as any).google_sub;

            const res = await fetch('/api/backend/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    google_sub: googleSub,
                    email: session.user?.email,
                    full_name: session.user?.name,
                    role: selectedRole,
                    password: password,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ detail: 'Error al registrar' }));
                setPasswordError(errorData.detail || 'Error al registrar');
                return;
            }

            const data = await res.json();

            if (typeof window !== 'undefined') {
                localStorage.setItem('backend_synced', 'true');
                localStorage.setItem('backend_token', data.token.access_token);
                localStorage.setItem('backend_user', JSON.stringify(data.user));
                
                // Dispatch event to notify components of new login
                window.dispatchEvent(new CustomEvent('user-login', {
                    detail: { user: data.user, token: data.token.access_token }
                }));
            }

            router.push('/');
        } catch (err) {
            console.error('Error en handleRegisterWithPassword:', err);
            setPasswordError('Error de red. Intenta nuevamente.');
        } finally {
            setRegistering(false);
        }
    };

    const handleSkipPassword = async () => {
        if (!session || !selectedRole) return;

        try {
            setRegistering(true);
            const googleSub = (session as any).google_sub;

            const res = await fetch('/api/backend/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    google_sub: googleSub,
                    email: session.user?.email,
                    full_name: session.user?.name,
                    role: selectedRole,
                    // Sin contraseña
                }),
            });

            if (!res.ok) {
                console.error('Error registrando usuario:', await res.text());
                return;
            }

            const data = await res.json();

            if (typeof window !== 'undefined') {
                localStorage.setItem('backend_synced', 'true');
                localStorage.setItem('backend_token', data.token.access_token);
                localStorage.setItem('backend_user', JSON.stringify(data.user));
                
                // Dispatch event to notify components of new login
                window.dispatchEvent(new CustomEvent('user-login', {
                    detail: { user: data.user, token: data.token.access_token }
                }));
            }

            router.push('/');
        } catch (err) {
            console.error('Error en handleSkipPassword:', err);
        } finally {
            setRegistering(false);
        }
    };

    const roles: {
        key: Role;
        title: string;
        description: string;
        icon: string;
        color: string;
        lightColor: string;
    }[] = [
        {
            key: 'THERAPIST',
            title: 'Terapista',
            description: 'Acceso al panel de control para terapeutas.',
            icon: 'pi pi-user-plus',
            color: '#8b5cf6',
            lightColor: '#ede9fe',
        },
        {
            key: 'STUDENT',
            title: 'Estudiante',
            description: 'Acceso a actividades y sesiones personalizadas.',
            icon: 'pi pi-user',
            color: '#10b981',
            lightColor: '#dcfce7',
        },
    ];

    return (
        <div
            className="flex justify-content-center align-items-center"
            style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #4f46e5 0%, #ec4899 50%, #10b981 100%)',
            }}
        >
            <div
                className="surface-card border-round-3xl shadow-4 p-4 md:p-5 lg:p-6"
                style={{
                    maxWidth: '960px',
                    width: '90%',
                    backdropFilter: 'blur(10px)',
                    background: 'rgba(255,255,255,0.95)',
                }}
            >
                <div className="text-center mb-4">
                    <span
                        className="inline-flex align-items-center justify-content-center border-round-2xl px-3 py-1 mb-3"
                        style={{ background: '#eef2ff', color: '#4f46e5', fontSize: '0.85rem' }}
                    >
                        <i className="pi pi-sparkles mr-2" />
                        Bienvenido a Speak4All
                    </span>

                    <h1 className="text-2xl md:text-3xl font-bold mb-2">Selecciona tu rol</h1>
                    <p className="text-600 m-0">
                        Elige cómo quieres usar la plataforma. Esto nos ayuda a personalizar tu experiencia.
                    </p>
                </div>

                <div className="grid mt-4">
                    {roles.map((role) => (
                        <div key={role.key} className="col-12 md:col-6">
                            <div
                                onClick={() => handleSelectRole(role.key)}
                                className="h-full cursor-pointer transition-all border-round-2xl shadow-1 hover:shadow-4"
                                style={{
                                    border: '2px solid transparent',
                                    background: 'white',
                                }}
                                onMouseEnter={(e: any) => {
                                    e.currentTarget.style.border = `2px solid ${role.color}`;
                                    e.currentTarget.style.transform =
                                        'translateY(-4px) scale(1.01)';
                                }}
                                onMouseLeave={(e: any) => {
                                    e.currentTarget.style.border = '2px solid transparent';
                                    e.currentTarget.style.transform =
                                        'translateY(0) scale(1)';
                                }}
                            >
                                <div className="p-4 md:p-5 flex flex-column align-items-center text-center gap-3">
                                    <div
                                        className="flex align-items-center justify-content-center border-round-circle"
                                        style={{
                                            width: '64px',
                                            height: '64px',
                                            background: role.lightColor,
                                        }}
                                    >
                                        <i
                                            className={role.icon}
                                            style={{
                                                fontSize: '1.8rem',
                                                color: role.color,
                                            }}
                                        ></i>
                                    </div>

                                    <div>
                                        <h2 className="text-xl font-semibold mb-1">
                                            {role.title}
                                        </h2>
                                        <p
                                            className="text-600 m-0"
                                            style={{ maxWidth: '260px' }}
                                        >
                                            {role.description}
                                        </p>
                                    </div>

                                    <div
                                        className="mt-2 px-3 py-1 border-round-2xl inline-flex align-items-center gap-2"
                                        style={{
                                            backgroundColor: role.lightColor,
                                            color: role.color,
                                            fontSize: '0.85rem',
                                            fontWeight: 500,
                                        }}
                                    >
                                        <i className="pi pi-mouse" />
                                        <span>Toca para continuar</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Modal de contraseña */}
                <Dialog
                    header="Configurar contraseña (opcional)"
                    visible={showPasswordDialog}
                    onHide={() => {
                        setShowPasswordDialog(false);
                        setSelectedRole(null);
                    }}
                    modal
                    style={{ width: '26rem', maxWidth: '95vw' }}
                >
                    <div className="flex flex-column gap-3">
                        <div>
                            <label className="block text-sm font-medium mb-2">Contraseña</label>
                            <Password
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Ingresa una contraseña (opcional)"
                                toggleMask
                                className="w-full"
                                inputClassName="w-full"
                            />
                            <p className="text-xs text-600 mt-1">
                                Mínimo 6 caracteres. Si omites esto, solo podrás ingresar con Google.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Confirmar contraseña</label>
                            <Password
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirma tu contraseña"
                                toggleMask
                                className="w-full"
                                inputClassName="w-full"
                                feedback={false}
                            />
                        </div>

                        {passwordError && (
                            <div
                                className="border-round-lg p-3 text-sm"
                                style={{ background: '#fee2e2', color: '#991b1b' }}
                            >
                                {passwordError}
                            </div>
                        )}

                        <div className="flex gap-2 justify-content-end">
                            <Button
                                label="Omitir"
                                severity="secondary"
                                onClick={handleSkipPassword}
                                loading={registering}
                                disabled={registering}
                            />
                            <Button
                                label="Continuar"
                                onClick={handleRegisterWithPassword}
                                loading={registering}
                                disabled={registering || !password || !confirmPassword}
                            />
                        </div>
                    </div>
                </Dialog>
            </div>
        </div>
    );
}
