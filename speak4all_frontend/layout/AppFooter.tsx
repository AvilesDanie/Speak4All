import React, { useContext } from 'react';
import { Button } from 'primereact/button';
import { LayoutContext } from './context/layoutcontext';

const AppFooter = () => {
    const { layoutConfig } = useContext(LayoutContext);
    const footerLogoSrc = `/layout/images/logo/footer-${layoutConfig.colorScheme === 'light' ? 'avalon' : 'avalon-dark'}.svg`;

    return (
        <div className="layout-footer">
            <img src={footerLogoSrc} alt="avalon-footer-logo" />
            <div className="flex gap-2">
                <Button icon="pi pi-github" rounded text className="p-button-plain"></Button>
                <Button icon="pi pi-facebook" rounded text className="p-button-plain"></Button>
                <Button icon="pi pi-twitter" rounded text className="p-button-plain"></Button>
            </div>
        </div>
    );
};

export default AppFooter;
