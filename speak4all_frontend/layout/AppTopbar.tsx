import { forwardRef, useContext, useImperativeHandle, useRef } from 'react';
import { LayoutContext } from './context/layoutcontext';
import type { AppTopbarRef } from '@/types';
import Link from 'next/link';
import { Ripple } from 'primereact/ripple';
import { NotificationBell } from '@/components/NotificationBell';
import { signOut } from 'next-auth/react';

const AppTopbar = forwardRef<AppTopbarRef>((props, ref) => {
    const { onMenuToggle, onTopbarMenuToggle, setLayoutState } = useContext(LayoutContext);
    const menubuttonRef = useRef(null);
    const mobileButtonRef = useRef(null);

    const onMenuButtonClick = () => {
        onMenuToggle();
    };

    const onMobileTopbarMenuButtonClick = () => {
        onTopbarMenuToggle();
    };

    const onConfigButtonClick = () => {
        setLayoutState((prevState) => ({ ...prevState, configSidebarVisible: true }));
    };

    useImperativeHandle(ref, () => ({
        menubutton: menubuttonRef.current
    }));

    const handleLogout = async () => {
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

            // Disparar evento personalizado para que otros componentes se enteren
            window.dispatchEvent(new Event('user-logout'));
        }

        try {
            await signOut({ redirect: false });
        } finally {
            if (typeof window !== 'undefined') {
                window.location.assign('/auth/login2');
            }
        }
    };

    return (
        <div className="layout-topbar">
            <div className="layout-topbar-start">
                <Link className="layout-topbar-logo" href="/">
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--topbar-item-text-color)' }}>
                        Speak4All
                    </span>
                </Link>
                <a ref={menubuttonRef} className="p-ripple layout-menu-button" onClick={onMenuButtonClick}>
                    <i className="pi pi-angle-right"></i>
                    <Ripple />
                </a>

                <a ref={mobileButtonRef} className="p-ripple layout-topbar-mobile-button" onClick={onMobileTopbarMenuButtonClick}>
                    <i className="pi pi-ellipsis-v"></i>
                    <Ripple />
                </a>
            </div>

            <div className="layout-topbar-end">
                <div className="layout-topbar-actions-end">
                    <ul className="layout-topbar-items">
                        <li>
                            <a className="p-ripple cursor-pointer" onClick={onConfigButtonClick}>
                                <i className="pi pi-cog"></i>
                                <Ripple />
                            </a>
                        </li>
                        <li>
                            <NotificationBell />
                        </li>
                        <li>
                            <a className="p-ripple cursor-pointer" onClick={handleLogout}>
                                <i className="pi pi-power-off"></i>
                                <Ripple />
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
});

AppTopbar.displayName = 'AppTopbar';

export default AppTopbar;
