'use client';

import React, { useState, useEffect, useContext } from 'react';

import { MailContext } from '../../../../../../demo/components/apps/mail/context/mailcontext';
import AppMailTable from '../../../../../../demo/components/apps/mail/AppMailTable';

import type { Demo, Page } from '@/types';

const MailSent: Page = () => {
    const [sentMails, setSentMails] = useState<Demo.Mail[]>([]);
    const { mails } = useContext(MailContext);
    useEffect(() => {
        const _mails = mails.filter((d) => d.sent && !d.trash && !d.archived);
        setSentMails(_mails);
    }, [mails]);

    return (
        <React.Fragment>
            <AppMailTable mails={sentMails} />
        </React.Fragment>
    );
};

export default MailSent;
