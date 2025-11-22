'use client';
import { PrimeReactContext } from 'primereact/api';
import { Button } from 'primereact/button';
import { InputSwitch, InputSwitchChangeEvent } from 'primereact/inputswitch';
import { RadioButton, RadioButtonChangeEvent } from 'primereact/radiobutton';
import { Sidebar } from 'primereact/sidebar';
import { classNames } from 'primereact/utils';
import { useContext, useEffect, useState } from 'react';
import { LayoutContext } from './context/layoutcontext';
import type { AppConfigProps, ColorScheme } from '@/types';
interface Scene {
    id: number;
    sceneName: string;
    colorScheme: ColorScheme;
    colorSchemeColor: string;
    menuTheme: string;
    menuThemeColor: string;
    componentTheme: string;
    componentThemeColor: string;
    topbarTheme: string;
    topbarThemeColor: string;
    menuMode: string;
    cardColor: string;
}

const AppConfig = (props: AppConfigProps) => {
    const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
    const { layoutConfig, setLayoutConfig, layoutState, setLayoutState, isSlim, isSlimPlus, isHorizontal } = useContext(LayoutContext);
    const { setRipple, changeTheme } = useContext(PrimeReactContext);
    const scales = [12, 13, 14, 15, 16];
    const componentThemes = [
        { name: 'purple', color: '#6f42c1' },
        { name: 'indigo', color: '#6610f2' },
        { name: 'pink', color: '#d63384' },
        { name: 'blue', color: '#0d6efd' },
        { name: 'cyan', color: '#0dcaf0' },
        { name: 'teal', color: '#20c997' },
        { name: 'green', color: '#198754' },
        { name: 'yellow', color: '#ffc107' },
        { name: 'orange', color: '#fd7e14' },
        { name: 'black', color: '#000000' }
    ];

    const menuThemes: {
        name: string;
        color: string;
    }[] = [
        { name: 'light', color: '#ffffff' },
        { name: 'dark', color: '#212529' }
    ];

    const topbarThemes = [
        { name: 'light', color: '#FFFFFF' },
        { name: 'dark', color: '#212529' },
        { name: 'blue', color: '#1565C0' },
        { name: 'purple', color: '#6A1B9A' },
        { name: 'pink', color: '#AD1457' },
        { name: 'cyan', color: '#0097A7' },
        { name: 'teal', color: '#00796B' },
        { name: 'green', color: '#43A047' },
        { name: 'yellow', color: '#FBC02D' },
        { name: 'orange', color: '#FB8C00' },
        { name: 'indigo', color: '#3F51B5' }
    ];

    const scenes: Scene[] = [
        {
            id: 0,
            sceneName: 'Green Light',
            colorScheme: 'light',
            colorSchemeColor: '#EFEFEF',
            menuTheme: 'light',
            menuThemeColor: '#ffffff',
            componentTheme: 'green',
            componentThemeColor: '#198754',
            topbarTheme: 'green',
            topbarThemeColor: '#43A047',
            menuMode: 'static',
            cardColor: '#ffffff'
        },
        {
            id: 1,
            sceneName: 'Dark Sea',
            colorScheme: 'dark',
            colorSchemeColor: '#20262e',
            menuTheme: 'dark',
            menuThemeColor: '#2a323d',
            componentTheme: 'cyan',
            componentThemeColor: '#0dcaf0',
            topbarTheme: 'cyan',
            topbarThemeColor: '#0097A7',
            menuMode: 'static',
            cardColor: '#2a323d'
        },
        {
            id: 2,
            sceneName: 'Blue Marble',
            colorScheme: 'light',
            colorSchemeColor: '#EFEFEF',
            menuTheme: 'light',
            menuThemeColor: '#ffffff',
            componentTheme: 'blue',
            componentThemeColor: '#0d6efd',
            topbarTheme: 'blue',
            topbarThemeColor: '#1565C0',
            menuMode: 'static',
            cardColor: '#ffffff'
        },
        {
            id: 3,
            sceneName: 'Emerald',
            colorScheme: 'dark',
            colorSchemeColor: '#20262e',
            menuTheme: 'dark',
            menuThemeColor: '#2a323d',
            componentTheme: 'teal',
            componentThemeColor: '#20c997',
            topbarTheme: 'teal',
            topbarThemeColor: '#00796B',
            menuMode: 'static',
            cardColor: '#2a323d'
        },
        {
            id: 4,
            sceneName: 'Piano Black',
            colorScheme: 'light',
            colorSchemeColor: '#EFEFEF',
            menuTheme: 'light',
            menuThemeColor: '#ffffff',
            componentTheme: 'black',
            componentThemeColor: '#000000',
            topbarTheme: 'light',
            topbarThemeColor: '#FFFFFF',
            menuMode: 'static',
            cardColor: '#ffffff'
        },
        {
            id: 5,
            sceneName: 'Bolt',
            colorScheme: 'dark',
            colorSchemeColor: '#20262e',
            menuTheme: 'dark',
            menuThemeColor: '#2a323d',
            componentTheme: 'yellow',
            componentThemeColor: '#ffc107',
            topbarTheme: 'yellow',
            topbarThemeColor: '#FBC02D',
            menuMode: 'static',
            cardColor: '#2a323d'
        },
        {
            id: 6,
            sceneName: 'Amber',
            colorScheme: 'light',
            colorSchemeColor: '#EFEFEF',
            menuTheme: 'dark',
            menuThemeColor: '#212529',
            componentTheme: 'yellow',
            componentThemeColor: '#ffc107',
            topbarTheme: 'yellow',
            topbarThemeColor: '#FBC02D',
            menuMode: 'horizontal',
            cardColor: '#ffffff'
        },
        {
            id: 7,
            sceneName: 'Kingdom',
            colorScheme: 'dark',
            colorSchemeColor: '#20262e',
            menuTheme: 'dark',
            menuThemeColor: '#2a323d',
            componentTheme: 'indigo',
            componentThemeColor: '#6610f2',
            topbarTheme: 'purple',
            topbarThemeColor: '#6A1B9A',
            menuMode: 'reveal',
            cardColor: '#2a323d'
        }
    ];

    useEffect(() => {
        if (isSlim() || isSlimPlus() || isHorizontal()) {
            setLayoutState((prevState) => ({ ...prevState, resetMenu: true }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layoutConfig.menuMode]);

    const onInlineMenuPositionChange = (e: RadioButtonChangeEvent) => {
        setLayoutConfig((prevState) => ({
            ...prevState,
            menuProfilePosition: e.value
        }));
    };
    const onConfigButtonClick = () => {
        setLayoutState((prevState) => ({
            ...prevState,
            configSidebarVisible: true
        }));
    };

    const onConfigSidebarHide = () => {
        setLayoutState((prevState) => ({
            ...prevState,
            configSidebarVisible: false
        }));
    };

    const changeInputStyle = (e: RadioButtonChangeEvent) => {
        setLayoutConfig((prevState) => ({ ...prevState, inputStyle: e.value }));
    };

    const changeRipple = (e: InputSwitchChangeEvent) => {
        setRipple?.(e.value as boolean);
        setLayoutConfig((prevState) => ({
            ...prevState,
            ripple: e.value as boolean
        }));
    };

    const changeMenuMode = (e: RadioButtonChangeEvent) => {
        setLayoutConfig((prevState) => ({ ...prevState, menuMode: e.value }));
    };

    const onChangeMenuTheme = (name: string) => {
        setLayoutConfig((prevState) => ({ ...prevState, menuTheme: name }));
    };

    const changeColorScheme = (colorScheme: ColorScheme) => {
        changeTheme?.(layoutConfig.colorScheme, colorScheme, 'theme-link', () => {
            setLayoutConfig((prevState) => ({
                ...prevState,
                colorScheme,
                menuTheme: colorScheme === 'dark' ? 'dark' : 'light'
            }));
        });
    };

    const _changeTheme = (componentTheme: string) => {
        changeTheme?.(layoutConfig.componentTheme, componentTheme, 'theme-link', () => {
            setLayoutConfig((prevState) => ({ ...prevState, componentTheme }));
        });
    };
    const onTopbarChangeTheme = (name: string) => {
        setLayoutConfig((prevState) => ({ ...prevState, topbarTheme: name }));
    };

    const decrementScale = () => {
        setLayoutConfig((prevState) => ({
            ...prevState,
            scale: prevState.scale - 1
        }));
    };

    const incrementScale = () => {
        setLayoutConfig((prevState) => ({
            ...prevState,
            scale: prevState.scale + 1
        }));
    };

    const applyScale = () => {
        document.documentElement.style.fontSize = layoutConfig.scale + 'px';
    };

    useEffect(() => {
        applyScale();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layoutConfig.scale]);

    const changeScene = (item: any) => {
        changeTheme?.(layoutConfig.componentTheme, item.componentTheme, 'theme-link', () => {
            changeColorScheme(item.colorScheme);
            setLayoutConfig((prevState) => ({ ...prevState, colorScheme: item.colorScheme, componentTheme: item.componentTheme, menuMode: item.menuMode }));
            onTopbarChangeTheme(item.topbarTheme);
            onChangeMenuTheme(item.menuTheme);
            setSelectedScene(item);
        });
    };

    return (
        <>
            <button className="layout-config-button config-link" type="button" onClick={onConfigButtonClick}>
                <i className="pi pi-cog"></i>
            </button>

            <Sidebar visible={layoutState.configSidebarVisible} onHide={onConfigSidebarHide} position="right" className="layout-config-sidebar w-18rem">
                <h5>Layout/Theme Scale</h5>
                <div className="flex align-items-center">
                    <Button icon="pi pi-minus" type="button" onClick={decrementScale} rounded text className="w-2rem h-2rem mr-2" disabled={layoutConfig.scale === scales[0]}></Button>
                    <div className="flex gap-2 align-items-center">
                        {scales.map((s, i) => {
                            return (
                                <i
                                    key={i}
                                    className={classNames('pi pi-circle-fill text-300', {
                                        'text-primary-500': s === layoutConfig.scale
                                    })}
                                ></i>
                            );
                        })}
                    </div>
                    <Button icon="pi pi-plus" type="button" onClick={incrementScale} rounded text className="w-2rem h-2rem ml-2" disabled={layoutConfig.scale === scales[scales.length - 1]}></Button>
                </div>
                <h5>Scenes</h5>
                <div className="flex flex-wrap p-2 surface-100 gap-2 border-round-lg">
                    {scenes.map((scene) => {
                        return (
                            <Button key={scene.id} onClick={() => changeScene(scene)} className="bg-transparent border-none relative p-0" style={{ flex: '0 0 48%' }} tooltip={scene.sceneName} tooltipOptions={{ position: 'top' }}>
                                {selectedScene?.sceneName === scene.sceneName && (
                                    <div className="absolute w-full h-full flex justify-content-center align-items-center" style={{ background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(3.56688px)' }}>
                                        <svg width="25" height="26" viewBox="0 0 25 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <rect x="0.520691" y="0.770691" width="24.4586" height="24.4586" rx="12.2293" fill={scene.componentThemeColor} />
                                            <g clipPath="url(#clip0_1_16289)">
                                                <path
                                                    d="M11.1158 16.5119C11.0587 16.51 11.0025 16.4964 10.9507 16.472C10.899 16.4476 10.8528 16.4129 10.8149 16.37L7.97597 13.531C7.92185 13.4959 7.8764 13.449 7.84306 13.3938C7.80973 13.3385 7.78938 13.2765 7.78354 13.2122C7.77771 13.148 7.78655 13.0832 7.8094 13.0229C7.83224 12.9626 7.8685 12.9082 7.91542 12.864C7.96234 12.8197 8.01871 12.7867 8.08027 12.7674C8.14183 12.7481 8.20696 12.743 8.27076 12.7526C8.33456 12.7621 8.39535 12.7861 8.44854 12.8226C8.50174 12.8591 8.54595 12.9072 8.57783 12.9632L11.1158 15.4842L17.0606 9.55651C17.1406 9.50462 17.2358 9.4811 17.3308 9.48972C17.4258 9.49834 17.5151 9.53861 17.5845 9.60406C17.6539 9.66952 17.6993 9.75637 17.7134 9.8507C17.7275 9.94503 17.7096 10.0414 17.6625 10.1243L11.4168 16.37C11.3789 16.4129 11.3327 16.4476 11.281 16.472C11.2292 16.4964 11.173 16.51 11.1158 16.5119Z"
                                                    fill="white"
                                                />
                                            </g>
                                            <defs>
                                                <clipPath id="clip0_1_16289">
                                                    <rect width="10.7006" height="10.7006" fill="white" transform="translate(7.39966 7.64966)" />
                                                </clipPath>
                                            </defs>
                                        </svg>
                                    </div>
                                )}
                                <svg width="110" height="44.5" viewBox="0 0 110 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <g clipPath="url(#clip0_1_23714)">
                                        <rect x="0.5" width="109.5" height="56" rx="6" fill={scene.colorSchemeColor} />
                                        <rect width="109.5" height="10.5" transform="translate(0.5)" fill={scene.topbarThemeColor} />
                                        <rect width="42" height="45.5" transform="translate(0.5 10.5)" fill={scene.menuThemeColor} />
                                        <rect x="11" y="24.5" width="21" height="3.5" rx="1.75" fill={scene.componentThemeColor} />
                                        <rect x="11" y="31.5" width="21" height="3.5" rx="1.75" fill={scene.componentThemeColor} />
                                        <rect x="11" y="38.5" width="21" height="3.5" rx="1.75" fill={scene.componentThemeColor} />
                                        <rect x="53" y="21" width="46.5" height="24.5" rx="3" fill={scene.cardColor} />
                                        <rect x="60" y="28" width="32.5" height="10.5" rx="3" fill={scene.componentThemeColor} />
                                    </g>
                                    <defs>
                                        <clipPath id="clip0_1_23714">
                                            <rect x="0.5" width="109.5" height="56" rx="6" fill="white" />
                                        </clipPath>
                                    </defs>
                                </svg>
                            </Button>
                        );
                    })}
                </div>
                <h6>Color Scheme</h6>
                <div className="flex">
                    <div className="flex align-items-center">
                        <RadioButton id="light" name="darkMenu" value="light" checked={layoutConfig.colorScheme === 'light'} onChange={(e) => changeColorScheme(e.value)} />
                        <label htmlFor="light" className="ml-2">
                            Light
                        </label>
                    </div>
                    <div className="flex align-items-center ml-4">
                        <RadioButton id="dark" name="darkMenu" value="dark" checked={layoutConfig.colorScheme === 'dark'} onChange={(e) => changeColorScheme(e.value)} />
                        <label htmlFor="dark" className="ml-2">
                            Dark
                        </label>
                    </div>
                </div>

                {!props.minimal && (
                    <>
                        <h5>Menu Mode</h5>
                        <div className="flex flex-wrap row-gap-3">
                            <div className="flex align-items-center gap-2 w-6">
                                <RadioButton name="menuMode" value={'static'} checked={layoutConfig.menuMode === 'static'} onChange={(e) => changeMenuMode(e)} inputId="mode1"></RadioButton>
                                <label htmlFor="mode1">Static</label>
                            </div>
                            <div className="flex align-items-center gap-2 w-6">
                                <RadioButton name="menuMode" value={'overlay'} checked={layoutConfig.menuMode === 'overlay'} onChange={(e) => changeMenuMode(e)} inputId="mode2"></RadioButton>
                                <label htmlFor="mode2">Overlay</label>
                            </div>
                            <div className="flex align-items-center gap-2 w-6">
                                <RadioButton name="menuMode" value={'slim'} checked={layoutConfig.menuMode === 'slim'} onChange={(e) => changeMenuMode(e)} inputId="mode3"></RadioButton>
                                <label htmlFor="mode3">Slim</label>
                            </div>
                            <div className="flex align-items-center gap-2 w-6">
                                <RadioButton name="menuMode" value={'slim-plus'} checked={layoutConfig.menuMode === 'slim-plus'} onChange={(e) => changeMenuMode(e)} inputId="mode4"></RadioButton>
                                <label htmlFor="mode4">Slim +</label>
                            </div>
                            <div className="flex align-items-center gap-2 w-6">
                                <RadioButton name="menuMode" value={'drawer'} checked={layoutConfig.menuMode === 'drawer'} onChange={(e) => changeMenuMode(e)} inputId="mode7"></RadioButton>
                                <label htmlFor="mode7">Drawer</label>
                            </div>
                            <div className="flex align-items-center gap-2 w-6">
                                <RadioButton name="menuMode" value={'reveal'} checked={layoutConfig.menuMode === 'reveal'} onChange={(e) => changeMenuMode(e)} inputId="mode5"></RadioButton>
                                <label htmlFor="mode6">Reveal</label>
                            </div>
                            <div className="flex align-items-center gap-2 w-6">
                                <RadioButton name="menuMode" value={'horizontal'} checked={layoutConfig.menuMode === 'horizontal'} onChange={(e) => changeMenuMode(e)} inputId="mode5"></RadioButton>
                                <label htmlFor="mode5">Horizontal</label>
                            </div>
                        </div>
                        <h5>Menu Profile Position</h5>
                        <div className="flex">
                            <div className="flex align-items-center">
                                <RadioButton id="start" name="position" value="start" checked={layoutConfig.menuProfilePosition === 'start'} onChange={onInlineMenuPositionChange} />
                                <label htmlFor="start" className="ml-2">
                                    Start
                                </label>
                            </div>
                            <div className="flex align-items-center ml-4">
                                <RadioButton id="end" name="position" value="end" checked={layoutConfig.menuProfilePosition === 'end'} onChange={onInlineMenuPositionChange} />
                                <label htmlFor="end" className="ml-2">
                                    End
                                </label>
                            </div>
                        </div>

                        <h5>Input Style</h5>
                        <div className="flex">
                            <div className="field-radiobutton flex-1">
                                <RadioButton name="inputStyle" value="outlined" checked={layoutConfig.inputStyle === 'outlined'} onChange={(e) => changeInputStyle(e)} inputId="outlined_input"></RadioButton>
                                <label htmlFor="outlined_input">Outlined</label>
                            </div>
                            <div className="field-radiobutton flex-1">
                                <RadioButton name="inputStyle" value="filled" checked={layoutConfig.inputStyle === 'filled'} onChange={(e) => changeInputStyle(e)} inputId="filled_input"></RadioButton>
                                <label htmlFor="filled_input">Filled</label>
                            </div>
                        </div>
                    </>
                )}
                <h5>Ripple Effect</h5>
                <InputSwitch checked={layoutConfig.ripple} onChange={changeRipple}></InputSwitch>

                {!props.minimal && (
                    <>
                        <h5>Menu Themes</h5>
                        {layoutConfig.colorScheme !== 'dark' ? (
                            <div className="flex flex-wrap row-gap-3">
                                {menuThemes.map((t, i) => {
                                    return (
                                        <div key={i} className="w-3">
                                            <div style={{ cursor: 'pointer' }} onClick={() => onChangeMenuTheme(t.name)} className="layout-config-color-option" title={t.name}>
                                                <button className="cursor-pointer p-link w-2rem h-2rem border-round shadow-2 flex-shrink-0 flex justify-content-center align-items-center border-circle" style={{ backgroundColor: t.color }}>
                                                    {layoutConfig.menuTheme === t.name && (
                                                        <span className="check flex align-items-center justify-content-center">
                                                            <i className={`pi pi-check ${t.name === layoutConfig.menuTheme && layoutConfig.menuTheme !== 'light' ? 'text-white' : 'text-dark'}`}></i>
                                                        </span>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p>Menu themes are only available in light mode by design as large surfaces can emit too much brightness in dark mode.</p>
                        )}

                        <h5>Topbar Themes</h5>
                        <div className="flex flex-wrap row-gap-3">
                            {topbarThemes.map((t, i) => {
                                return (
                                    <div key={i} className="w-3">
                                        <div style={{ cursor: 'pointer' }} onClick={() => onTopbarChangeTheme(t.name)} className="layout-config-color-option p-link" title={t.name}>
                                            <button className="cursor-pointer p-link w-2rem h-2rem border-round shadow-2 flex-shrink-0 flex justify-content-center align-items-center border-circle" style={{ backgroundColor: t.color }}>
                                                {layoutConfig.topbarTheme === t.name && (
                                                    <span className="check flex align-items-center justify-content-center">
                                                        <i className={`pi pi-check ${t.name === layoutConfig.topbarTheme && layoutConfig.topbarTheme !== 'light' ? 'text-white' : 'text-dark'}`}></i>
                                                    </span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
                <h5>Component Themes</h5>
                <div className="flex flex-wrap row-gap-3">
                    {componentThemes.map((t, i) => {
                        return (
                            <div key={i} className="w-3">
                                <div style={{ cursor: 'pointer' }} onClick={() => _changeTheme(t.name)} className="layout-config-color-option p-link" title={t.name}>
                                    <button className="cursor-pointer p-link w-2rem h-2rem border-round shadow-2 flex-shrink-0 flex justify-content-center align-items-center border-circle" style={{ backgroundColor: t.color }}>
                                        {layoutConfig.componentTheme === t.name && (
                                            <span className="check flex align-items-center justify-content-center">
                                                <i className="pi pi-check text-white"></i>
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Sidebar>
        </>
    );
};

export default AppConfig;
