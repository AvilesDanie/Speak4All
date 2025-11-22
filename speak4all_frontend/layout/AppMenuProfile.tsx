import { classNames } from 'primereact/utils';
import React, { useContext, useEffect, useRef } from 'react';
import { Tooltip } from 'primereact/tooltip';
import { LayoutContext } from './context/layoutcontext';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePathname } from 'next/navigation';

const AppMenuProfile = () => {
    const { layoutState, layoutConfig, isSlim, isHorizontal, onMenuProfileToggle } = useContext(LayoutContext);
    const router = useRouter();
    const ulRef = useRef<HTMLUListElement | null>(null);
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const hiddenClassName = classNames({ hidden: layoutConfig.menuMode === 'drawer' && !layoutState.sidebarActive });

    const toggleMenu = () => {
        if (layoutState.menuProfileActive) {
            setTimeout(() => {
                (ulRef.current as any).style.maxHeight = '0';
            }, 1);
            (ulRef.current as any).style.opacity = '0';
            if (isHorizontal()) {
                (ulRef.current as any).style.transform = 'scaleY(0.8)';
            }
        } else {
            setTimeout(() => {
                (ulRef.current as any).style.maxHeight = (ulRef.current as any).scrollHeight.toString() + 'px';
            }, 1);
            (ulRef.current as any).style.opacity = '1';
            if (isHorizontal()) {
                (ulRef.current as any).style.transform = 'scaleY(1)';
            }
        }
        onMenuProfileToggle();
    };

    useEffect(() => {
        if (layoutState.menuProfileActive) toggleMenu();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, searchParams]);

    const tooltipValue = (tooltipText: string) => {
        return isSlim() ? tooltipText : null;
    };

    return (
        <React.Fragment>
            <div className="layout-menu-profile">
                <Tooltip target={'.avatar-button'} content={tooltipValue('Profile') as string} />
                <button className="avatar-button p-link border-noround" onClick={toggleMenu}>
                    <img src="/layout/images/avatar/amyelsner.png" alt="avatar" style={{ width: '32px', height: '32px' }} />
                    <span>
                        <strong>Amy Elsner</strong>
                        <small>Webmaster</small>
                    </span>
                    <i
                        className={classNames('layout-menu-profile-toggler pi pi-fw', {
                            'pi-angle-down': layoutConfig.menuProfilePosition === 'start' || isHorizontal(),
                            'pi-angle-up': layoutConfig.menuProfilePosition === 'end' && !isHorizontal()
                        })}
                    ></i>
                </button>

                <ul ref={ulRef} className={classNames('menu-transition', { overlay: isHorizontal() })} style={{ overflow: 'hidden', maxHeight: 0, opacity: 0 }}>
                    {layoutState.menuProfileActive && (
                        <>
                            <li>
                                <button className="p-link" onClick={() => router.push('/profile/create')}>
                                    <i className="pi pi-cog pi-fw"></i>
                                    <span className={hiddenClassName}>Settings</span>
                                </button>
                            </li>

                            <li>
                                <button className="p-link" onClick={() => router.push('/profile/list')}>
                                    <i className="pi pi-file-o pi-fw"></i>
                                    <span className={hiddenClassName}>Profile</span>
                                </button>
                            </li>
                            <li>
                                <button className="p-link" onClick={() => router.push('/documentation')}>
                                    <i className="pi pi-compass pi-fw"></i>
                                    <span className={hiddenClassName}>Support</span>
                                </button>
                            </li>
                            <li>
                                <button className="p-link" onClick={() => router.push('/auth/login2')}>
                                    <i className="pi pi-power-off pi-fw"></i>
                                    <span className={hiddenClassName}>Logout</span>
                                </button>
                            </li>
                        </>
                    )}
                </ul>
            </div>
        </React.Fragment>
    );
};

export default AppMenuProfile;
