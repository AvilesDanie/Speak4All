import { forwardRef, useContext, useImperativeHandle, useRef } from 'react';
import { LayoutContext } from './context/layoutcontext';
import type { AppTopbarRef } from '@/types';
import Link from 'next/link';
import { StyleClass } from 'primereact/styleclass';
import { Ripple } from 'primereact/ripple';

const AppTopbar = forwardRef<AppTopbarRef>((props, ref) => {
    const { onMenuToggle, onTopbarMenuToggle } = useContext(LayoutContext);
    const menubuttonRef = useRef(null);

    const mobileButtonRef = useRef(null);

    const bellRef = useRef(null);
    const avatarRef = useRef(null);
    const tableRef = useRef(null);

    const onMenuButtonClick = () => {
        onMenuToggle();
    };

    const onMobileTopbarMenuButtonClick = () => {
        onTopbarMenuToggle();
    };

    useImperativeHandle(ref, () => ({
        menubutton: menubuttonRef.current
    }));

    return (
        <div className="layout-topbar">
            <div className="layout-topbar-start">
                <Link className="layout-topbar-logo" href="/">
                    <svg width="100" viewBox="0 0 64 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3.528 0.399995H7.7L10.892 20H7.812L7.252 16.108V16.164H3.752L3.192 20H0.335999L3.528 0.399995ZM6.888 13.504L5.516 3.816H5.46L4.116 13.504H6.888Z" fill="var(--topbar-item-text-color)" />
                        <path d="M10.7813 0.399995H13.8893L15.9053 15.604H15.9613L17.9773 0.399995H20.8053L17.8373 20H13.7493L10.7813 0.399995Z" fill="var(--topbar-item-text-color)" />
                        <path d="M23.8717 0.399995H28.0437L31.2358 20H28.1557L27.5957 16.108V16.164H24.0957L23.5357 20H20.6797L23.8717 0.399995ZM27.2317 13.504L25.8597 3.816H25.8037L24.4597 13.504H27.2317Z" fill="var(--topbar-item-text-color)" />
                        <path d="M32.73 0.399995H35.81V17.2H40.878V20H32.73V0.399995Z" fill="var(--topbar-item-text-color)" />
                        <path
                            d="M46.6977 20.28C45.1857 20.28 44.0283 19.8507 43.2257 18.992C42.423 18.1333 42.0217 16.92 42.0217 15.352V5.048C42.0217 3.48 42.423 2.26666 43.2257 1.408C44.0283 0.549329 45.1857 0.119995 46.6977 0.119995C48.2097 0.119995 49.367 0.549329 50.1697 1.408C50.9723 2.26666 51.3737 3.48 51.3737 5.048V15.352C51.3737 16.92 50.9723 18.1333 50.1697 18.992C49.367 19.8507 48.2097 20.28 46.6977 20.28ZM46.6977 17.48C47.7617 17.48 48.2937 16.836 48.2937 15.548V4.852C48.2937 3.564 47.7617 2.92 46.6977 2.92C45.6337 2.92 45.1017 3.564 45.1017 4.852V15.548C45.1017 16.836 45.6337 17.48 46.6977 17.48Z"
                            fill="var(--topbar-item-text-color)"
                        />
                        <path d="M53.4566 0.399995H57.3206L60.3166 12.132H60.3726V0.399995H63.1166V20H59.9526L56.2566 5.692H56.2006V20H53.4566V0.399995Z" fill="var(--topbar-item-text-color)" />
                    </svg>
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
                        <li className="layout-topbar-search">
                            <input type="text" placeholder="Search" />
                            <i className="pi-fw pi pi-search"></i>
                        </li>
                        <li>
                            <StyleClass nodeRef={bellRef} selector="@next" enterClassName="hidden" enterActiveClassName="px-scalein" leaveToClassName="hidden" leaveActiveClassName="px-fadeout" hideOnOutsideClick>
                                <a className="p-ripple" ref={bellRef}>
                                    <i className="pi pi-bell"></i>
                                    <Ripple />
                                </a>
                            </StyleClass>
                            <div className="hidden">
                                <ul className="list-none p-0 m-0">
                                    <li>
                                        <a className="py-2 px-3 flex gap-2 cursor-pointer text-color hover:text-primary">
                                            <i className="pi pi-fw pi-sliders-h text-lg"></i>
                                            <span>Pending tasks</span>
                                        </a>
                                    </li>
                                    <li>
                                        <a className="py-2 px-3 flex gap-2 cursor-pointer text-color hover:text-primary">
                                            <i className="pi pi-fw pi-calendar text-lg"></i>
                                            <span>Meeting today at 3pm</span>
                                        </a>
                                    </li>
                                    <li>
                                        <a className="py-2 px-3 flex gap-2 cursor-pointer text-color hover:text-primary">
                                            <i className="pi pi-fw pi-download text-lg"></i>
                                            <span>Download documents</span>
                                        </a>
                                    </li>
                                    <li>
                                        <a className="py-2 px-3 flex gap-2 cursor-pointer text-color hover:text-primary">
                                            <i className="pi pi-fw pi-bookmark text-lg"></i>
                                            <span>Book flight</span>
                                        </a>
                                    </li>
                                </ul>
                            </div>
                        </li>
                        <li>
                            <StyleClass nodeRef={tableRef} selector="@next" enterClassName="hidden" enterActiveClassName="px-scalein" leaveToClassName="hidden" leaveActiveClassName="px-fadeout" hideOnOutsideClick>
                                <a className="p-ripple" ref={tableRef}>
                                    <i className="pi pi-envelope"></i>
                                    <Ripple />
                                </a>
                            </StyleClass>
                            <div className="hidden">
                                <ul className="list-none p-0 m-0 flex flex-column text-color">
                                    <li>
                                        <a className="cursor-pointer flex align-items-center px-3 py-2 gap-3 hover:text-primary">
                                            <img src="/layout/images/avatar/avatar5.png" className="w-3rem h-3rem" alt="avatar5" />
                                            <span>Give me a call</span>
                                        </a>
                                    </li>
                                    <li>
                                        <a className="cursor-pointer flex align-items-center px-3 py-2 gap-3 hover:text-primary">
                                            <img src="/layout/images/avatar/avatar1.png" className="w-3rem h-3rem" alt="avatar1" />
                                            <span>Sales reports attached</span>
                                        </a>
                                    </li>
                                    <li>
                                        <a className="cursor-pointer flex align-items-center px-3 py-2 gap-3 hover:text-primary">
                                            <img src="/layout/images/avatar/avatar2.png" className="w-3rem h-3rem" alt="avatar2" />
                                            <span>About your invoice</span>
                                        </a>
                                    </li>
                                    <li>
                                        <a className="cursor-pointer flex align-items-center px-3 py-2 gap-3 hover:text-primary">
                                            <img src="/layout/images/avatar/avatar3.png" className="w-3rem h-3rem" alt="avatar3" />
                                            <span>Meeting today at 10pm</span>
                                        </a>
                                    </li>
                                    <li>
                                        <a className="cursor-pointer flex align-items-center px-3 py-2 gap-3 hover:text-primary">
                                            <img src="/layout/images/avatar/avatar4.png" className="w-3rem h-3rem" alt="avatar4" />
                                            <span>Out of office</span>
                                        </a>
                                    </li>
                                </ul>
                            </div>
                        </li>
                        <li>
                            <StyleClass nodeRef={avatarRef} selector="@next" enterClassName="hidden" enterActiveClassName="px-scalein" leaveToClassName="hidden" leaveActiveClassName="px-fadeout" hideOnOutsideClick>
                                <a className="p-ripple" ref={avatarRef}>
                                    <i className="pi pi-cog"></i> <Ripple />
                                </a>
                            </StyleClass>
                            <div className="hidden">
                                <ul className="list-none p-0 m-0">
                                    <li>
                                        <a className="py-2 px-3 flex gap-2 cursor-pointer text-color hover:text-primary">
                                            <i className="pi pi-fw pi-palette text-lg"></i>
                                            <span>Change Theme</span>
                                        </a>
                                    </li>
                                    <li>
                                        <a className="py-2 px-3 flex gap-2 cursor-pointer text-color hover:text-primary">
                                            <i className="pi pi-fw pi-star text-lg"></i>
                                            <span>Favorites</span>
                                        </a>
                                    </li>
                                    <li>
                                        <a className="py-2 px-3 flex gap-2 cursor-pointer text-color hover:text-primary">
                                            <i className="pi pi-fw pi-lock text-lg"></i>
                                            <span>Lock Screen</span>
                                        </a>
                                    </li>
                                    <li>
                                        <a className="py-2 px-3 flex gap-2 cursor-pointer text-color hover:text-primary">
                                            <i className="pi pi-fw pi-image text-lg"></i>
                                            <span>Wallpaper</span>
                                        </a>
                                    </li>
                                </ul>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
});

AppTopbar.displayName = 'AppTopbar';

export default AppTopbar;
