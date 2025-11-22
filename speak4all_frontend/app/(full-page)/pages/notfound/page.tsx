'use client';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import React, { useContext, useEffect } from 'react';
import { PrimeReactContext } from 'primereact/api';
import type { ColorScheme } from '@/types';
import { LayoutContext } from '../../../../layout/context/layoutcontext';

function NotFound() {
    const router = useRouter();
    const { layoutConfig, setLayoutConfig } = useContext(LayoutContext);
    const { changeTheme } = useContext(PrimeReactContext);

    const navigateToDashboard = () => {
        router.push('/');
    };
    const changeColorScheme = (colorScheme: ColorScheme) => {
        changeTheme?.(layoutConfig.colorScheme, colorScheme, 'theme-link', () => {
            setLayoutConfig((prevState) => ({
                ...prevState,
                colorScheme,
                menuTheme: layoutConfig.colorScheme === 'dark' ? 'dark' : 'light'
            }));
        });
    };
    useEffect(() => {
        changeColorScheme('light');
        setLayoutConfig((prevState) => ({
            ...prevState,
            menuTheme: 'light'
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <React.Fragment>
            <div className="overflow-hidden m-0 relative h-screen bg-cover bg-center" style={{ backgroundImage: 'url(/layout/images/pages/exception/bg-404.png' }}>
                <div className="text-center text-5xl pt-5 font-bold text-white">
                    <div className="inline-block py-1 px-2 text-white surface-900">
                        <span>Page</span>
                    </div>
                    <span className="text-color">Not Found</span>
                </div>
                <div className="w-full absolute bottom-0 text-center surface-900 h-14rem">
                    <div className="w-full absolute text-center z-1" style={{ top: '-36px' }}>
                        <img src="/layout/images/pages/exception/icon-error.png" alt="avalon-react" />
                    </div>
                    <div className="w-29rem relative text-white" style={{ marginLeft: '-200px', left: '50%', top: '30px' }}>
                        <div className="p-3">
                            <h3 className="m-0 mb-2 text-white">Page Not Found.</h3>
                            <p className="m-0">Please contact system administrator.</p>
                        </div>
                        <Button onClick={navigateToDashboard} label="Go To Dashboard"></Button>
                    </div>
                </div>
            </div>
        </React.Fragment>
    );
}

export default NotFound;
