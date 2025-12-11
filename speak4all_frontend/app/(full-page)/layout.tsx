import { Metadata } from 'next';
import React from 'react';

interface FullPageLayoutProps {
    children: React.ReactNode;
}

export const metadata: Metadata = {
    title: 'Speak4All',
    description: 'Dashboard de Speak4All',
    icons: {
        icon: '/icon-message.svg'
    }
};

export default function FullPageLayout({ children }: FullPageLayoutProps) {
    return <React.Fragment>{children}</React.Fragment>;
}
