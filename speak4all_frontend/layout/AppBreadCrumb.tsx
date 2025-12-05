import { usePathname, useSearchParams } from 'next/navigation';
import React, { useContext, useEffect, useState } from 'react';
import { LayoutContext } from './context/layoutcontext';
import type { Breadcrumb } from '@/types';
import Link from 'next/link';

const AppBreadcrumb = () => {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [breadcrumb, setBreadcrumb] = useState<Breadcrumb | null>(null);
    const { breadcrumbs } = useContext(LayoutContext);

    const isDashboard = pathname + searchParams.toString() !== '/';

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
                                <li>Dashboard</li>
                            )}
                        </>
                    )}
                </ol>
            </nav>
        </div>
    );
};

export default AppBreadcrumb;
