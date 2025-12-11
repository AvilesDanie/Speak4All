import { Metadata } from 'next';
import Layout from '../../layout/layout';

interface MainLayoutProps {
    children: React.ReactNode;
}
export const metadata: Metadata = {
    title: 'Speak4All',
    description: 'Dashboard de Speak4All',
    robots: { index: false, follow: false },
    viewport: { initialScale: 1, width: 'device-width' },
    openGraph: {
        type: 'website',
        title: 'Speak4All',
        url: '/',
        description: 'Dashboard de Speak4All',
        images: ['/icon-message.svg'],
        ttl: 604800
    },
    icons: {
        icon: '/icon-message.svg'
    }
};

export default function MainLayout({ children }: MainLayoutProps) {
    return <Layout>{children}</Layout>;
}
