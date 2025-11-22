'use client';

import React, { useState, useEffect, useContext } from 'react';

import { MailContext } from '../../../../../../demo/components/apps/mail/context/mailcontext';
import AppMailTable from '../../../../../../demo/components/apps/mail/AppMailTable';

import type { Demo, Page } from '@/types';

const MailStarred: Page = () => {
    const [starredMails, setStarredMails] = useState<Demo.Mail[]>([]);
    const { mails } = useContext(MailContext);
    useEffect(() => {
        const _mails = mails.filter((d) => d.starred && !d.archived && !d.trash);
        setStarredMails(_mails);
    }, [mails]);

    return (
        <React.Fragment>
            <AppMailTable mails={starredMails} />
        </React.Fragment>
    );
};

export default MailStarred;
