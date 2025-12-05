import { usePathname, useSearchParams } from 'next/navigation';
import React, { useContext, useEffect, useState } from 'react';
import { LayoutContext } from './context/layoutcontext';
import type { Breadcrumb } from '@/types';
import { Button } from 'primereact/button';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

const AppBreadcrumb = () => {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [breadcrumb, setBreadcrumb] = useState<Breadcrumb | null>(null);
    const { breadcrumbs } = useContext(LayoutContext);

    const isDashboard =
        pathname + searchParams.toString() !== '/' &&
        pathname + searchParams.toString() !== '/dashboards/banking';

    useEffect(() => {
        if (!breadcrumbs) {
            setBreadcrumb(null);
            return;
        }

        // 1) coincidencia exacta
        let filtered =
            breadcrumbs.find(
                (crumb) => crumb.to?.replace(/\/$/, '') === pathname.replace(/\/$/, '')
            ) ?? null;

        // 2) detalle de curso: usamos el crumb de /courses
        if (!filtered && pathname.startsWith('/courses/')) {
            const parent = breadcrumbs.find(
                (crumb) => crumb.to?.replace(/\/$/, '') === '/courses'
            );

            if (parent) {
                filtered = {
                    ...parent,
                    labels: [...(parent.labels ?? []), 'Detalle del curso']
                };
            }
        }
        // 3) crear ejercicio: usamos el crumb de /exercises
        if (!filtered && pathname.startsWith('/exercises/create')) {
            const parent = breadcrumbs.find(
                (crumb) => crumb.to?.replace(/\/$/, '') === '/exercises'
            );

            if (parent) {
                filtered = {
                    ...parent,
                    labels: [...(parent.labels ?? []), 'Crear ejercicio'],
                };
            }
        }




        setBreadcrumb(filtered);
    }, [pathname, breadcrumbs]);

    const handleLogout = () => {
        if (typeof window !== 'undefined') {
            // Limpiar todas las notificaciones guardadas
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('stored_notifications_')) {
                    localStorage.removeItem(key);
                }
            });
            
            localStorage.removeItem('backend_synced');
            localStorage.removeItem('backend_token');
            localStorage.removeItem('backend_user');
            localStorage.removeItem('pending_role');
        }

        signOut({ callbackUrl: '/auth/login2' });
    };

    return (
        <div className="layout-breadcrumb-container">
            <nav className="layout-breadcrumb">
                <ol>
                    {/* Home siempre clicable */}
                    <li>
                        <Link href="/" style={{ color: 'inherit' }}>
                            <i className="pi pi-home"></i>
                        </Link>
                    </li>

                    {breadcrumb?.labels && breadcrumb.labels.length > 0 && isDashboard ? (
                        breadcrumb.labels.map((label, index) => {
                            const isLast = index === breadcrumb.labels!.length - 1;

                            // usamos breadcrumb.to como base, no el pathname completo
                            const baseSegments = (breadcrumb.to ?? '').split('/').filter(Boolean);
                            const href =
                                !isLast && baseSegments.length
                                    ? '/' + baseSegments.slice(0, index + 1).join('/')
                                    : null;

                            return (
                                <React.Fragment key={index}>
                                    <i className="pi pi-angle-right"></i>
                                    <li>
                                        {href ? (
                                            <Link href={href} style={{ color: 'inherit' }}>
                                                {label}
                                            </Link>
                                        ) : (
                                            <span>{label}</span>
                                        )}
                                    </li>
                                </React.Fragment>
                            );
                        })
                    ) : (
                        <>
                            <i className="pi pi-angle-right"></i>
                            {pathname + searchParams.toString() === '/' && (
                                <li>E-Commerce Dashboard</li>
                            )}
                            {pathname + searchParams.toString() === '/dashboards/banking' && (
                                <li>Banking Dashboard</li>
                            )}
                        </>
                    )}
                </ol>
            </nav>

            <div className="layout-breadcrumb-buttons">
                <Button icon="pi pi-cloud-upload" rounded text className="p-button-plain" />
                <Button icon="pi pi-bookmark" rounded text className="p-button-plain" />
                <Button
                    icon="pi pi-power-off"
                    rounded
                    text
                    className="p-button-plain"
                    onClick={handleLogout}
                />
            </div>
        </div>
    );
};

export default AppBreadcrumb;
