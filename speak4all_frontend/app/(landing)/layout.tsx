import { Metadata } from 'next';
import AppConfig from '../../layout/AppConfig';
import React from 'react';

interface LandingLayoutProps {
    children: React.ReactNode;
}

export const metadata: Metadata = {
    title: 'Speak4All',
    description: 'Dashboard de Speak4All',
    icons: {
        icon: '/icon-message.svg'
    }
};

export default function LandingLayout({ children }: LandingLayoutProps) {
    return (
        <React.Fragment>
            <AppConfig minimal></AppConfig>
            {children}
        </React.Fragment>
    );
}
