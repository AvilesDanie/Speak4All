'use client';
import React, { useState, useEffect, useContext } from 'react';
import { Toast } from 'primereact/toast';
import { MailContext } from '../../../../../../demo/components/apps/mail/context/mailcontext';
import AppMailTable from '../../../../../../demo/components/apps/mail/AppMailTable';
import type { Demo, Page } from '@/types';

const MailArchived: Page = () => {
    const [archivedMails, setArchivedMails] = useState<Demo.Mail[]>([]);
    const { mails } = useContext(MailContext);
    useEffect(() => {
        const _mails = mails.filter((d) => d.archived);
        setArchivedMails(_mails);
    }, [mails]);

    return (
        <React.Fragment>
            <Toast></Toast>
            <AppMailTable mails={archivedMails} />
        </React.Fragment>
    );
};

export default MailArchived;
