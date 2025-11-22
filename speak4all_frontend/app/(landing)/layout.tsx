import { Metadata } from 'next';
import AppConfig from '../../layout/AppConfig';
import React from 'react';

interface LandingLayoutProps {
    children: React.ReactNode;
}

export const metadata: Metadata = {
    title: 'PrimeReact Avalon',
    description: 'The ultimate collection of design-agnostic, flexible and accessible React UI Components.'
};

export default function LandingLayout({ children }: LandingLayoutProps) {
    return (
        <React.Fragment>
            <AppConfig minimal></AppConfig>
            {children}
        </React.Fragment>
    );
}
