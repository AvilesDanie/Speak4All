'use client';

import React, { useState, useEffect, useContext } from 'react';

import { MailContext } from '../../../../../../demo/components/apps/mail/context/mailcontext';
import AppMailTable from '../../../../../../demo/components/apps/mail/AppMailTable';
import type { Demo, Page } from '@/types';

const MailTrash: Page = () => {
    const [trashMails, setTrashMails] = useState<Demo.Mail[]>([]);
    const { mails } = useContext(MailContext);
    useEffect(() => {
        const _mails = mails.filter((d) => d.trash);
        setTrashMails(_mails);
    }, [mails]);

    return (
        <React.Fragment>
            <AppMailTable mails={trashMails} />
        </React.Fragment>
    );
};

export default MailTrash;
