'use client';

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getMyCourses } from '@/services/courses';
import { getMyExercises } from '@/services/exercises';
import { API_BASE } from '@/services/apiClient';

export default function Dashboard() {
    const { user, token, role, loading } = useAuth();
    const [stats, setStats] = useState({ courses: 0, exercises: 0, submissions: 0 });
    const [statsLoading, setStatsLoading] = useState(false);

    useEffect(() => {
        // Solo ejecutar cuando la autenticación haya terminado de cargar Y tengamos token
        if (loading || !token) {
            return;
        }
        
        const fetchStats = async () => {
            try {
                setStatsLoading(true);

                const [coursesData, exercisesData, submissionsRes] = await Promise.all([
                    getMyCourses(token, 1, 1000).catch(() => ({ items: [], total: 0, page: 1, page_size: 1000, total_pages: 0 })),
                    role === 'THERAPIST' ? getMyExercises(token, 1, 1000).catch(() => ({ items: [], total: 0, page: 1, page_size: 1000, total_pages: 0 })) : Promise.resolve({ items: [], total: 0, page: 1, page_size: 1000, total_pages: 0 }),
                    fetch(`${API_BASE}/submissions/my/count`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
                ]);

                const courses = coursesData.total;
                const exercises = exercisesData.total;
                const submissionsData = submissionsRes && submissionsRes.ok ? await submissionsRes.json() : { count: 0 };

                setStats({ courses, exercises, submissions: submissionsData.count });
            } catch (err) {
                console.error('Error fetching stats:', err);
            } finally {
                setStatsLoading(false);
            }
        };

        fetchStats();
    }, [loading, token, role]);

    if (loading) {
        return (
            <div className="flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
                <div className="text-center">
                    <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }} />
                    <p className="mt-3">Cargando tu dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="surface-ground min-h-screen">
            {/* Header con gradiente */}
            <div 
                className="p-6 mb-4"
                style={{
                    background: role === 'THERAPIST' 
                        ? 'linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%)'
                        : 'linear-gradient(135deg, #10b981 0%, #22c55e 100%)',
                    color: 'white'
                }}
            >
                <div className="flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <div className="flex align-items-center gap-2 mb-2">
                            <i className="pi pi-comments" style={{ fontSize: '2rem' }} />
                            <h1 className="text-4xl font-bold m-0">Speak4All</h1>
                        </div>
                        <p className="text-xl m-0 opacity-90">
                            Bienvenido{user?.full_name ? `, ${user.full_name}` : ''}
                        </p>
                        <div className="flex align-items-center gap-2 mt-2">
                            <span 
                                className="px-3 py-1 border-round-2xl text-sm font-semibold"
                                style={{ background: 'rgba(255,255,255,0.2)' }}
                            >
                                {role === 'THERAPIST' ? '👨‍⚕️ Terapeuta' : '👤 Estudiante'}
                            </span>
                            {user?.email && (
                                <span className="text-sm opacity-80">
                                    <i className="pi pi-envelope mr-1" />
                                    {user.email}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 pb-6">
                <div className="grid">
                    {/* Estadísticas Cards */}
                    <div className="col-12 md:col-4">
                        <Card 
                            className="shadow-3 border-round-2xl h-full"
                            style={{ 
                                background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                                border: 'none'
                            }}
                        >
                            <div className="flex align-items-center gap-3">
                                <div 
                                    className="flex align-items-center justify-content-center border-round-circle"
                                    style={{ 
                                        width: '60px', 
                                        height: '60px',
                                        background: '#4f46e5',
                                        color: 'white'
                                    }}
                                >
                                    <i className="pi pi-book" style={{ fontSize: '1.5rem' }} />
                                </div>
                                <div>
                                    <p className="m-0 text-600 text-sm">Mis Cursos</p>
                                    <h2 className="m-0 text-4xl font-bold text-900">{stats.courses}</h2>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {role === 'THERAPIST' && (
                        <div className="col-12 md:col-4">
                            <Card 
                                className="shadow-3 border-round-2xl h-full"
                                style={{ 
                                    background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
                                    border: 'none'
                                }}
                            >
                                <div className="flex align-items-center gap-3">
                                    <div 
                                        className="flex align-items-center justify-content-center border-round-circle"
                                        style={{ 
                                            width: '60px', 
                                            height: '60px',
                                            background: '#8b5cf6',
                                            color: 'white'
                                        }}
                                    >
                                        <i className="pi pi-microphone" style={{ fontSize: '1.5rem' }} />
                                    </div>
                                    <div>
                                        <p className="m-0 text-600 text-sm">Ejercicios Creados</p>
                                        <h2 className="m-0 text-4xl font-bold text-900">{stats.exercises}</h2>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                    <div className="col-12 md:col-4">
                        <Card 
                            className="shadow-3 border-round-2xl h-full"
                            style={{ 
                                background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                                border: 'none'
                            }}
                        >
                            <div className="flex align-items-center gap-3">
                                <div 
                                    className="flex align-items-center justify-content-center border-round-circle"
                                    style={{ 
                                        width: '60px', 
                                        height: '60px',
                                        background: '#10b981',
                                        color: 'white'
                                    }}
                                >
                                    <i className="pi pi-upload" style={{ fontSize: '1.5rem' }} />
                                </div>
                                <div>
                                    <p className="m-0 text-600 text-sm">
                                        {role === 'THERAPIST' ? 'Entregas Recibidas' : 'Mis Entregas'}
                                    </p>
                                    <h2 className="m-0 text-4xl font-bold text-900">{stats.submissions}</h2>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Acciones rápidas */}
                    <div className="col-12 lg:col-8">
                        <Card className="shadow-3 border-round-2xl h-full">
                            <h3 className="text-2xl font-semibold mb-4 flex align-items-center gap-2">
                                <i className="pi pi-bolt" />
                                Acciones Rápidas
                            </h3>
                            
                            {role === 'THERAPIST' ? (
                                <div className="grid">
                                    <div className="col-12 sm:col-6 md:col-4">
                                        <Link href="/exercises/create" className="no-underline">
                                            <div 
                                                className="p-4 border-round-2xl text-center cursor-pointer hover:shadow-3 transition-all transition-duration-200"
                                                style={{ background: '#f9fafb', border: '2px solid #e5e7eb' }}
                                            >
                                                <i className="pi pi-plus-circle mb-3" style={{ fontSize: '2.5rem', color: '#8b5cf6' }} />
                                                <h4 className="m-0 text-900">Crear Ejercicio</h4>
                                                <p className="mt-2 text-600 text-sm">Genera nuevo contenido con IA</p>
                                            </div>
                                        </Link>
                                    </div>
                                    
                                    <div className="col-12 sm:col-6 md:col-4">
                                        <Link href="/courses" className="no-underline">
                                            <div 
                                                className="p-4 border-round-2xl text-center cursor-pointer hover:shadow-3 transition-all transition-duration-200"
                                                style={{ background: '#f9fafb', border: '2px solid #e5e7eb' }}
                                            >
                                                <i className="pi pi-users mb-3" style={{ fontSize: '2.5rem', color: '#4f46e5' }} />
                                                <h4 className="m-0 text-900">Gestionar Cursos</h4>
                                                <p className="mt-2 text-600 text-sm">Organiza tus estudiantes</p>
                                            </div>
                                        </Link>
                                    </div>
                                    
                                    <div className="col-12 sm:col-6 md:col-4">
                                        <Link href="/exercises" className="no-underline">
                                            <div 
                                                className="p-4 border-round-2xl text-center cursor-pointer hover:shadow-3 transition-all transition-duration-200"
                                                style={{ background: '#f9fafb', border: '2px solid #e5e7eb' }}
                                            >
                                                <i className="pi pi-list mb-3" style={{ fontSize: '2.5rem', color: '#10b981' }} />
                                                <h4 className="m-0 text-900">Mis Ejercicios</h4>
                                                <p className="mt-2 text-600 text-sm">Ver ejercicios guardados</p>
                                            </div>
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid">
                                    <div className="col-12 md:col-6">
                                        <Link href="/courses" className="no-underline">
                                            <div 
                                                className="p-4 border-round-2xl text-center cursor-pointer hover:shadow-3 transition-all transition-duration-200"
                                                style={{ background: '#f9fafb', border: '2px solid #e5e7eb' }}
                                            >
                                                <i className="pi pi-book mb-3" style={{ fontSize: '2.5rem', color: '#10b981' }} />
                                                <h4 className="m-0 text-900">Mis Cursos</h4>
                                                <p className="mt-2 text-600 text-sm">Accede a tus cursos activos</p>
                                            </div>
                                        </Link>
                                    </div>
                                    
                                    <div className="col-12 md:col-6">
                                        <Link href="/courses" className="no-underline">
                                            <div 
                                                className="p-4 border-round-2xl text-center cursor-pointer hover:shadow-3 transition-all transition-duration-200"
                                                style={{ background: '#f9fafb', border: '2px solid #e5e7eb' }}
                                            >
                                                <i className="pi pi-play-circle mb-3" style={{ fontSize: '2.5rem', color: '#4f46e5' }} />
                                                <h4 className="m-0 text-900">Continuar Ejercicios</h4>
                                                <p className="mt-2 text-600 text-sm">Retoma donde lo dejaste</p>
                                            </div>
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Información del usuario */}
                    <div className="col-12 lg:col-4">
                        <Card className="shadow-3 border-round-2xl h-full">
                            <h3 className="text-2xl font-semibold mb-4 flex align-items-center gap-2">
                                <i className="pi pi-info-circle" />
                                Tu Cuenta
                            </h3>
                            
                            <div className="flex flex-column gap-3">
                                <div className="flex align-items-center gap-3 p-3 surface-100 border-round-xl">
                                    <i className="pi pi-user text-2xl text-600" />
                                    <div>
                                        <p className="m-0 text-600 text-sm">Nombre</p>
                                        <p className="m-0 font-semibold">{user?.full_name || 'No disponible'}</p>
                                    </div>
                                </div>
                                
                                <div className="flex align-items-center gap-3 p-3 surface-100 border-round-xl">
                                    <i className="pi pi-envelope text-2xl text-600" />
                                    <div style={{ overflow: 'hidden' }}>
                                        <p className="m-0 text-600 text-sm">Email</p>
                                        <p className="m-0 font-semibold" style={{ wordBreak: 'break-word' }}>
                                            {user?.email || 'No disponible'}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex align-items-center gap-3 p-3 surface-100 border-round-xl">
                                    <i className="pi pi-shield text-2xl text-600" />
                                    <div>
                                        <p className="m-0 text-600 text-sm">Tipo de Cuenta</p>
                                        <p className="m-0 font-semibold">
                                            {role === 'THERAPIST' ? 'Terapeuta' : 'Estudiante'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
