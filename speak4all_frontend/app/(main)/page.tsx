'use client';

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

type Role = 'THERAPIST' | 'STUDENT' | string;

export default function Dashboard() {
    const { data: session } = useSession();
    const [role, setRole] = useState<Role>('STUDENT');
    const [stats, setStats] = useState({ courses: 0, exercises: 0, submissions: 0 });
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    useEffect(() => {
        // Determine google_sub from session (next-auth stores it at top-level in our setup)
        const googleSub = (session as any)?.google_sub || (session as any)?.user?.google_sub || null;

        // If we have a google_sub, request the user from backend to obtain role reliably
        const fetchMeAndStats = async () => {
            try {
                if (googleSub) {
                    const meRes = await fetch(`${API_BASE}/auth/me?google_sub=${encodeURIComponent(googleSub)}`);
                    if (meRes.ok) {
                        const me = await meRes.json();
                        setRole(me.role || (me as any).role);
                    }
                }

                // Fetch lightweight stats (best-effort; endpoints may vary)
                const [coursesRes, exercisesRes, submissionsRes] = await Promise.all([
                    fetch(`${API_BASE}/courses`).catch(() => null),
                    fetch(`${API_BASE}/exercises`).catch(() => null),
                    fetch(`${API_BASE}/submissions`).catch(() => null),
                ]);

                const courses = coursesRes && coursesRes.ok ? (await coursesRes.json()).length : 0;
                const exercises = exercisesRes && exercisesRes.ok ? (await exercisesRes.json()).length : 0;
                const submissions = submissionsRes && submissionsRes.ok ? (await submissionsRes.json()).length : 0;

                setStats({ courses, exercises, submissions });
            } catch (err) {
                // ignore - stats are optional
            }
        };

        fetchMeAndStats();
    }, [session]);

    return (
        <div className="surface-ground min-h-screen p-6">
            <div className="grid">
            <div className="col-12">
                    <div className="card surface-0 border-none p-6 shadow-2">
                        <div className="flex align-items-center justify-content-between">
                            <div>
                                <h1 className="text-3xl m-0">Speak4All</h1>
                                <p className="text-color-secondary m-0 mt-2">Panel de control · Rol detectado: <strong>{role}</strong></p>
                            </div>
                            <div>
                                <Button label="Mi perfil" icon="pi pi-user" className="p-button-rounded p-button-outlined" />
                            </div>
                        </div>
                    </div>
            </div>

            <div className="col-12 md:col-6 lg:col-4">
                <div className="card shadow-1">
                    <h4 className="m-0 mb-3">Acciones rápidas</h4>
                    {role === 'THERAPIST' ? (
                        <div className="flex flex-column gap-2">
                            <Link href="/exercises/create">
                                <Button label="Crear ejercicio" icon="pi pi-plus" className="p-button-sm" />
                            </Link>
                            <Link href="/courses/manage">
                                <Button label="Gestionar cursos" icon="pi pi-users" className="p-button-sm" />
                            </Link>
                            <Link href="/submissions/review">
                                <Button label="Revisar entregas" icon="pi pi-check" className="p-button-sm" />
                            </Link>
                        </div>
                    ) : (
                        <div className="flex flex-column gap-2">
                            <Link href="/courses">
                                <Button label="Mis cursos" icon="pi pi-book" className="p-button-sm" />
                            </Link>
                            <Link href="/exercises">
                                <Button label="Ejercicios disponibles" icon="pi pi-list" className="p-button-sm" />
                            </Link>
                            <Link href="/submissions/new">
                                <Button label="Entregar ejercicio" icon="pi pi-upload" className="p-button-sm" />
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            <div className="col-12 md:col-6 lg:col-4">
                <div className="card shadow-1">
                    <h4 className="m-0 mb-3">Estadísticas rápidas</h4>
                    <ul>
                        <li> Cursos: <strong>{stats.courses}</strong></li>
                        <li> Ejercicios publicados: <strong>{stats.exercises}</strong></li>
                        <li> Entregas: <strong>{stats.submissions}</strong></li>
                    </ul>
                </div>
            </div>

            <div className="col-12 lg:col-4">
                <div className="card shadow-1">
                    <h4 className="m-0 mb-3">Información útil</h4>
                    <p className="m-0">Enlaces rápidos y documentación.</p>
                    <ul className="mt-2">
                        <li><a href="/help">Guía de uso</a></li>
                        <li><a href="/profile">Mi perfil</a></li>
                        <li><a href="/settings">Ajustes</a></li>
                    </ul>
                </div>
            </div>

            <div className="col-12">
                <div className="card shadow-1">
                    <h4 className="m-0 mb-3">Actividad reciente</h4>
                    <p className="text-color-secondary">Listado breve de actividad relevante para tu rol (demo).</p>
                    {role === 'THERAPIST' ? (
                        <ul>
                            <li>Nuevo join request pendiente</li>
                            <li>3 entregas sin revisar</li>
                        </ul>
                    ) : (
                        <ul>
                            <li>Próxima fecha de entrega: 2025-12-01</li>
                            <li>Nuevo ejercicio disponible en "Curso A"</li>
                        </ul>
                    )}
                </div>
            </div>
            </div>
        </div>
    );
}
