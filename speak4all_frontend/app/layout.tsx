'use client';
import { LayoutProvider } from '../layout/context/layoutcontext';
import { PrimeReactProvider } from 'primereact/api';
import { SessionProvider } from 'next-auth/react';
import { StoredNotificationProvider } from '@/contexts/StoredNotificationContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ExerciseNotificationProvider } from '@/contexts/ExerciseNotificationContext';
import { GlobalWebSocketListener } from '@/components/GlobalWebSocketListener';
import { GlobalSubmissionNotifier } from '@/components/GlobalSubmissionNotifier';
import { GlobalExerciseNotifier } from '@/components/GlobalExerciseNotifier';
import '../styles/layout/layout.scss';
import 'primeflex/primeflex.css';
import 'primeicons/primeicons.css';
import 'primereact/resources/primereact.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <link id="theme-link" href={`/theme/theme-light/purple/theme.css`} rel="stylesheet"></link>
            </head>
            <body>
                <SessionProvider>
                    <PrimeReactProvider>
                        <StoredNotificationProvider>
                            <NotificationProvider>
                                <ExerciseNotificationProvider>
                                    <GlobalWebSocketListener />
                                    <GlobalSubmissionNotifier />
                                    <GlobalExerciseNotifier />
                                    <LayoutProvider>{children}</LayoutProvider>
                                </ExerciseNotificationProvider>
                            </NotificationProvider>
                        </StoredNotificationProvider>
                    </PrimeReactProvider>
                </SessionProvider>
            </body>
        </html>
    );
}
