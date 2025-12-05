import Link from 'next/link';
import React, { useContext } from 'react';
import AppMenu from './AppMenu';
import { LayoutContext } from './context/layoutcontext';
import { MenuProvider } from './context/menucontext';
import AppMenuProfile from './AppMenuProfile';

const AppSidebar = () => {
    const { layoutConfig, setLayoutState } = useContext(LayoutContext);

    const anchor = () => {
        setLayoutState((prevLayoutState) => ({
            ...prevLayoutState,
            anchored: !prevLayoutState.anchored
        }));
    };

    return (
        <React.Fragment>
            <div className="layout-sidebar-top">
                <Link href="/">
                    <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--sidebar-item-text-color)', padding: '0.5rem' }} className="layout-sidebar-logo">
                        Speak4All
                    </span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--sidebar-item-text-color)' }} className="layout-sidebar-logo-slim">
                        S4A
                    </span>
                </Link>
                <button className="layout-sidebar-anchor p-link" type="button" onClick={anchor}></button>
            </div>

            {layoutConfig.menuProfilePosition === 'start' && <AppMenuProfile />}
            <div className="layout-menu-container">
                <MenuProvider>
                    <AppMenu />
                </MenuProvider>
            </div>
            {layoutConfig.menuProfilePosition === 'end' && <AppMenuProfile />}
        </React.Fragment>
    );
};

AppSidebar.displayName = 'AppSidebar';

export default AppSidebar;
