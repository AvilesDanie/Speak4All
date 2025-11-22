'use client';

import React, { useState, useEffect, useContext } from 'react';

import { MailContext } from '../../../../../../demo/components/apps/mail/context/mailcontext';
import AppMailTable from '../../../../../../demo/components/apps/mail/AppMailTable';

import type { Demo, Page } from '@/types';

const MailSpam: Page = () => {
    const [spamMails, setSpamMails] = useState<Demo.Mail[]>([]);
    const { mails } = useContext(MailContext);
    useEffect(() => {
        const _mails = mails.filter((d) => d.spam && !d.archived && !d.trash && !d.hasOwnProperty('sent'));
        setSpamMails(_mails);
    }, [mails]);

    return (
        <React.Fragment>
            <AppMailTable mails={spamMails} />
        </React.Fragment>
    );
};

export default MailSpam;
