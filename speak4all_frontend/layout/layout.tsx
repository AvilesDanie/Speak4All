'use client';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { LayoutContext } from './context/layoutcontext';
import { classNames, DomHandler } from 'primereact/utils';
import { useEventListener, useMountEffect, useResizeListener, useUnmountEffect } from 'primereact/hooks';
import { PrimeReactContext } from 'primereact/api';
import AppConfig from './AppConfig';
import AppSidebar from './AppSidebar';
import AppTopbar from './AppTopbar';
import AppBreadcrumb from './AppBreadCrumb';
import AppFooter from './AppFooter';
import type { AppTopbarRef, ChildContainerProps } from '@/types';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const Layout = (props: ChildContainerProps) => {
    const { layoutConfig, layoutState, setLayoutState, setLayoutConfig, isSlim, isSlimPlus, isHorizontal, isDesktop, isSidebarActive } = useContext(LayoutContext);
    const { setRipple } = useContext(PrimeReactContext);
    const topbarRef = useRef<AppTopbarRef>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);

    const pathname = usePathname() || '';
    const searchParams = useSearchParams();

    let timeout: NodeJS.Timeout | null = null;

    const { data: session, status } = useSession();
    const router = useRouter();

    const isPublicRoute =
        pathname.startsWith('/auth/login') ||
        pathname.startsWith('/auth/login2') ||
        pathname.startsWith('/auth/error');

    useEffect(() => {
        if (status === 'loading') return; // esperando next-auth

        // Permitir acceso si hay token local del backend, aunque no haya sesión de Google
        const hasLocalToken =
            typeof window !== 'undefined' && !!window.localStorage.getItem('backend_token');

        if (status === 'unauthenticated' && !isPublicRoute && !hasLocalToken) {
            router.replace('/auth/login2');
        }
    }, [status, isPublicRoute, router]);



    const [bindMenuOutsideClickListener, unbindMenuOutsideClickListener] = useEventListener({
        type: 'click',
        listener: (event) => {
            const isOutsideClicked = !(
                sidebarRef.current?.isSameNode(event.target as Node) ||
                sidebarRef.current?.contains(event.target as Node) ||
                topbarRef.current?.menubutton?.isSameNode(event.target as Node) ||
                topbarRef.current?.menubutton?.contains(event.target as Node)
            );

            if (isOutsideClicked) {
                hideMenu();
            }
        }
    });

    const [bindDocumentResizeListener, unbindDocumentResizeListener] = useResizeListener({
        listener: () => {
            if (isDesktop() && !DomHandler.isTouchDevice()) {
                hideMenu();
            }
        }
    });

    const hideMenu = useCallback(() => {
        setLayoutState((prevLayoutState) => ({
            ...prevLayoutState,
            overlayMenuActive: false,
            overlaySubmenuActive: false,
            staticMenuMobileActive: false,
            menuHoverActive: false,
            resetMenu: (isSlim() || isSlimPlus() || isHorizontal()) && isDesktop()
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSlim, isSlimPlus, isHorizontal, isDesktop]);

    const blockBodyScroll = () => {
        if (document.body.classList) {
            document.body.classList.add('blocked-scroll');
        } else {
            document.body.className += ' blocked-scroll';
        }
    };

    const unblockBodyScroll = () => {
        if (document.body.classList) {
            document.body.classList.remove('blocked-scroll');
        } else {
            document.body.className = document.body.className.replace(new RegExp('(^|\\b)' + 'blocked-scroll'.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
        }
    };
    useMountEffect(() => {
        setRipple?.(layoutConfig.ripple);
    });

    const onMouseEnter = () => {
        if (!layoutState.anchored) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            setLayoutState((prevLayoutState) => ({
                ...prevLayoutState,
                sidebarActive: true
            }));
        }
    };

    const onMouseLeave = () => {
        if (!layoutState.anchored) {
            if (!timeout) {
                timeout = setTimeout(
                    () =>
                        setLayoutState((prevLayoutState) => ({
                            ...prevLayoutState,
                            sidebarActive: false
                        })),
                    300
                );
            }
        }
    };

    useEffect(() => {
        if (status !== 'authenticated') return;
        if (typeof window === 'undefined') return;

        const alreadySynced = window.localStorage.getItem('backend_synced');
        if (alreadySynced === 'true') return;

        const googleIdToken = (session as any)?.google_id_token;
        const googleSub = (session as any)?.google_sub;
        if (!googleIdToken && !googleSub) return;

        const run = async () => {
            try {
                // 1) Preguntar al backend si el usuario ya existe
                if (googleSub) {
                    const resCheck = await fetch('/api/backend/auth/check', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ google_sub: googleSub }),
                    });

                    const { exists } = await resCheck.json();

                    if (!exists) {
                        // Usuario nuevo → enviar a seleccionar rol
                        router.replace('/auth/select-role');
                        return;
                    }
                }

                // 2) Usuario ya existe → obtener token del backend
                const res = await fetch('/api/backend/auth/google', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        // Enviar siempre id_token Y datos de fallback para que funcione sin GOOGLE_CLIENT_ID
                        id_token: googleIdToken,
                        google_sub: googleSub, // Siempre enviar para fallback
                        email: session?.user?.email,
                        full_name: session?.user?.name,
                        role: 'STUDENT', // el backend ignora el role si el user ya existe
                    }),
                });

                if (!res.ok) {
                    console.error('Error /api/backend/auth/google:', await res.text());
                    return;
                }

                const data = await res.json();
                window.localStorage.setItem('backend_synced', 'true');
                window.localStorage.setItem('backend_token', data.token.access_token);
                window.localStorage.setItem('backend_user', JSON.stringify(data.user));
            } catch (err) {
                console.error('Error en sync con backend:', err);
            }
        };

        run();
    }, [status, session, router]);





    useEffect(() => {
        const onRouteChange = () => {
            if (layoutConfig.colorScheme === 'dark') {
                setLayoutConfig((prevState) => ({ ...prevState, menuTheme: 'dark' }));
            }
        };
        onRouteChange();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, searchParams]);

    useEffect(() => {
        if (isSidebarActive()) {
            bindMenuOutsideClickListener();
        }

        if (layoutState.staticMenuMobileActive) {
            blockBodyScroll();
            (isSlim() || isSlimPlus() || isHorizontal()) && bindDocumentResizeListener();
        }

        return () => {
            unbindMenuOutsideClickListener();
            unbindDocumentResizeListener();
            unblockBodyScroll();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layoutState.overlayMenuActive, layoutState.staticMenuMobileActive, layoutState.overlaySubmenuActive]);

    useEffect(() => {
        const onRouteChange = () => {
            hideMenu();
        };
        onRouteChange();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, searchParams]);

    useUnmountEffect(() => {
        unbindMenuOutsideClickListener();
    });

    const containerClassName = classNames('layout-topbar-' + layoutConfig.topbarTheme, 'layout-menu-' + layoutConfig.menuTheme, 'layout-menu-profile-' + layoutConfig.menuProfilePosition, {
        'layout-overlay': layoutConfig.menuMode === 'overlay',
        'layout-static': layoutConfig.menuMode === 'static',
        'layout-slim': layoutConfig.menuMode === 'slim',
        'layout-slim-plus': layoutConfig.menuMode === 'slim-plus',
        'layout-horizontal': layoutConfig.menuMode === 'horizontal',
        'layout-reveal': layoutConfig.menuMode === 'reveal',
        'layout-drawer': layoutConfig.menuMode === 'drawer',
        'p-input-filled': layoutConfig.inputStyle === 'filled',
        'layout-sidebar-dark': layoutConfig.colorScheme === 'dark',
        'p-ripple-disabled': !layoutConfig.ripple,
        'layout-static-inactive': layoutState.staticMenuDesktopInactive && layoutConfig.menuMode === 'static',
        'layout-overlay-active': layoutState.overlayMenuActive,
        'layout-mobile-active': layoutState.staticMenuMobileActive,
        'layout-topbar-menu-active': layoutState.topbarMenuActive,
        'layout-menu-profile-active': layoutState.menuProfileActive,
        'layout-sidebar-active': layoutState.sidebarActive,
        'layout-sidebar-anchored': layoutState.anchored
    });


    // Mientras carga la sesión, muestra algo si NO es una ruta pública
    if (status === 'loading' && !isPublicRoute) {
        return <div>Cargando...</div>;
    }

    // Si no hay sesión y no es pública, solo bloquea si NO hay token local
    const hasLocalTokenRender = typeof window !== 'undefined' && !!window.localStorage.getItem('backend_token');
    if (status === 'unauthenticated' && !isPublicRoute && !hasLocalTokenRender) {
        return null;
    }


    return (
        <React.Fragment>
            <div className={classNames('layout-container', containerClassName)}>
                <AppTopbar ref={topbarRef} />
                <div ref={sidebarRef} className="layout-sidebar" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
                    <AppSidebar />
                </div>
                <div className="layout-content-wrapper">
                    <div>
                        <AppBreadcrumb></AppBreadcrumb>
                        <div className="layout-content">{props.children}</div>
                    </div>

                    {/*<AppFooter></AppFooter>*/}
                    
                </div>
                <AppConfig />
                <div className="layout-mask"></div>
            </div>
        </React.Fragment>
    );
};

export default Layout;
