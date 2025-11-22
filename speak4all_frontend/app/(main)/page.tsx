'use client';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Chart } from 'primereact/chart';
import { ChartData, ChartOptions } from 'chart.js';
import { InputText } from 'primereact/inputtext';
import { Menu } from 'primereact/menu';
import { ProductService } from '../../demo/service/ProductService';
import { LayoutContext } from '../../layout/context/layoutcontext';
import { Demo } from '../../types/demo';
import { FilterMatchMode, FilterOperator } from 'primereact/api';

let overviewChartData1: ChartData;
let overviewChartOptions: ChartOptions<'line'>;

function Dashboard() {
    const [products, setProducts] = useState<Demo.Product[]>([]);

    const [filters, setFilters] = useState<DataTableFilterMeta>({});

    const dt = useRef<DataTable<any>>(null);
    const [globalFilterValue, setGlobalFilterValue] = useState('');
    const menu = useRef<Menu | null>(null);

    const { layoutConfig } = useContext(LayoutContext);

    const getOverviewChartData1 = (): ChartData<'line'> => {
        return {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [
                {
                    label: 'New',
                    data: [11, 17, 30, 60, 88, 92],
                    backgroundColor: 'rgba(13, 202, 240, .2)',
                    borderColor: '#0dcaf0',
                    pointBackgroundColor: '#0dcaf0',
                    pointBorderColor: '#0dcaf0',
                    pointBorderWidth: 0,
                    pointStyle: 'line',
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Completed',
                    data: [11, 19, 39, 59, 69, 71],
                    backgroundColor: 'rgba(253, 126, 20, .2)',
                    borderColor: '#fd7e14',
                    pointBackgroundColor: '#fd7e14',
                    pointBorderColor: '#fd7e14',
                    pointBorderWidth: 0,
                    pointStyle: 'line',
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Canceled',
                    data: [11, 17, 21, 30, 47, 83],
                    backgroundColor: 'rgba(111, 66, 193, .2)',
                    borderColor: '#6f42c1',
                    pointBackgroundColor: '#6f42c1',
                    pointBorderColor: '#6f42c1',
                    pointBorderWidth: 0,
                    pointStyle: 'line',
                    fill: true,
                    tension: 0.4
                }
            ]
        };
    };
    const getChartOptions = (): ChartOptions<'line'> => {
        const textColor = getComputedStyle(document.body).getPropertyValue('--text-color') || '#212529';
        const surface300 = getComputedStyle(document.body).getPropertyValue('--surface-300') || '#dee2e6';
        return {
            plugins: {
                legend: {
                    labels: {
                        color: textColor
                    }
                }
            },
            scales: {
                y: {
                    max: 100,
                    min: 0,
                    ticks: {
                        stepSize: 20
                    },
                    grid: {
                        color: surface300
                    }
                },
                x: {
                    grid: {
                        color: surface300
                    }
                }
            }
        };
    };

    const exportCSV = () => {
        dt.current?.exportCSV();
    };
    const onGlobalFilterChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
        const value = e.target.value;
        let _filters = { ...filters };
        (_filters['global'] as any).value = value;

        setFilters(_filters);
        setGlobalFilterValue(value);
    };

    const initFilters = () => {
        setFilters({
            global: { value: null, matchMode: FilterMatchMode.CONTAINS },
            name: {
                operator: FilterOperator.AND,
                constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }]
            },
            'country.name': {
                operator: FilterOperator.AND,
                constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }]
            },
            representative: { value: null, matchMode: FilterMatchMode.IN },
            date: {
                operator: FilterOperator.AND,
                constraints: [{ value: null, matchMode: FilterMatchMode.DATE_IS }]
            },
            balance: {
                operator: FilterOperator.AND,
                constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }]
            },
            status: {
                operator: FilterOperator.OR,
                constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }]
            },
            activity: { value: null, matchMode: FilterMatchMode.BETWEEN },
            verified: { value: null, matchMode: FilterMatchMode.EQUALS }
        });
        setGlobalFilterValue('');
    };

    useEffect(() => {
        ProductService.getProductsSmall().then((data) => setProducts(data));

        overviewChartData1 = getOverviewChartData1();
        overviewChartOptions = getChartOptions();
        initFilters();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layoutConfig]);

    const items = [
        {
            label: 'Options',
            items: [
                { label: 'Add New', icon: 'pi pi-fw pi-plus' },
                { label: 'Search', icon: 'pi pi-fw pi-search' }
            ]
        }
    ];

    const nameBodyTemplate = (rowData: Demo.Product) => {
        return (
            <>
                <span className="p-column-title">Name</span>
                {rowData.name}
            </>
        );
    };

    const priceBodyTemplate = (rowData: Demo.Product) => {
        return (
            <>
                <span className="p-column-title">Price</span>
                {formatCurrency(rowData.price as number)}
            </>
        );
    };

    const categoryBodyTemplate = (rowData: Demo.Product) => {
        return (
            <>
                <span className="p-column-title">Category</span>
                {rowData.category}
            </>
        );
    };

    const statusBodyTemplate = (rowData: Demo.Product) => {
        const badgeClass = rowData.inventoryStatus?.toLowerCase();
        return (
            <>
                <span className="p-column-title">Status</span>
                <span className={'product-badge status-' + badgeClass}>{rowData.inventoryStatus}</span>
            </>
        );
    };

    const searchBodyTemplate = () => {
        return (
            <>
                <Button type="button" icon="pi pi-search" outlined rounded></Button>
            </>
        );
    };

    const formatCurrency = (value: number) => {
        return value?.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD'
        });
    };

    return (
        <>
            <div className="grid">
                <div className="col-12 md:col-6 lg:col-3">
                    <div className="p-3 text-white h-6rem border-round m-0 bg-center bg-cover bg-no-repeat bg-cyan-400" style={{ backgroundImage: 'url(/demo/images/dashboard/effect-1.svg)' }}>
                        <div className="font-bold w-full mb-3">
                            <span>Sales</span>
                        </div>
                        <div className="text-white text-2xl font-bold w-full flex align-items-center py-1">
                            150 <i className="pi pi-arrow-up ml-2 font-bold"></i>
                        </div>
                    </div>
                </div>
                <div className="col-12 md:col-6 lg:col-3">
                    <div className="p-3 text-white h-6rem border-round m-0 bg-center bg-cover bg-no-repeat bg-orange-400" style={{ backgroundImage: 'url(/demo/images/dashboard/effect-2.svg)' }}>
                        <div className="font-bold w-full mb-3">
                            <span>Revenue</span>
                        </div>
                        <div className="text-white text-2xl font-bold w-full flex align-items-center py-1">
                            532 <i className="pi pi-arrow-up ml-2 font-bold"></i>
                        </div>
                    </div>
                </div>
                <div className="col-12 md:col-6 lg:col-3">
                    <div className="p-3 text-white h-6rem border-round m-0 bg-center bg-cover bg-no-repeat bg-purple-400" style={{ backgroundImage: 'url(/demo/images/dashboard/effect-3.svg)' }}>
                        <div className="font-bold w-full mb-3">
                            <span>New Customers</span>
                        </div>
                        <div className="text-white text-2xl font-bold w-full flex align-items-center py-1">
                            450 <i className="pi pi-arrow-down ml-2 font-bold"></i>
                        </div>
                    </div>
                </div>
                <div className="col-12 md:col-6 lg:col-3">
                    <div className="p-3 text-white h-6rem border-round m-0 bg-center bg-cover bg-no-repeat bg-bluegray-200" style={{ backgroundImage: 'url(/demo/images/dashboard/effect-4.svg)' }}>
                        <div className="font-bold w-full mb-3">
                            <span>Stock</span>
                        </div>
                        <div className="text-white text-2xl font-bold w-full flex align-items-center py-1">
                            143 <i className="pi pi-arrow-down ml-2 font-bold"></i>
                        </div>
                    </div>
                </div>

                <div className="col-12 lg:col-6">
                    <div className="card h-full">
                        <h5>Weekly Overview</h5>
                        <Chart type="line" data={overviewChartData1} options={overviewChartOptions} id="nasdaq-chart"></Chart>
                    </div>
                </div>

                <div className="col-12 lg:col-6">
                    <div className="card">
                        <div className="flex align-items-center justify-content-between mb-4">
                            <h5>Quarter Goals</h5>
                            <div className="ml-auto">
                                <Button icon="pi pi-ellipsis-v" rounded text className="p-button-plain" onClick={(event) => menu.current?.toggle(event)}></Button>
                                <Menu ref={menu} popup={true} model={items}></Menu>
                            </div>
                        </div>
                        <div className="border-1 surface-border p-3 mb-4">
                            <span className="font-medium text-3xl text-color">
                                85% <span className="text-color-secondary">(2125/2500)</span>
                            </span>
                            <ul className="m-0 p-0 list-none mt-3 flex">
                                <li className="bg-cyan-500 h-1rem flex-1 border-round-left"></li>
                                <li className="bg-orange-500 h-1rem flex-1"></li>
                                <li className="bg-pink-500 h-1rem flex-1"></li>
                                <li className="bg-purple-500 h-1rem flex-1"></li>
                                <li className="bg-blue-500 h-1rem flex-1"></li>
                                <li className="bg-gray-500 h-1rem flex-1 border-round-right"></li>
                            </ul>
                        </div>

                        <ul className="mt-4 p-0 mx-0">
                            <li className="flex align-items-center py-3">
                                <span className="border-round bg-cyan-500 mr-3 w-1rem h-1rem"></span>
                                <span className="text-xl font-medium text-color">T-Shirt</span>
                                <span className="text-xl font-medium text-color-secondary ml-auto">89</span>
                            </li>
                            <li className="flex align-items-center py-3">
                                <span className="border-round-md bg-orange-500 mr-3 w-1rem h-1rem"></span>
                                <span className="text-xl font-medium text-color">Controller</span>
                                <span className="text-xl font-medium text-color-secondary ml-auto">23</span>
                            </li>
                            <li className="flex align-items-center py-3">
                                <span className="border-round-md bg-pink-500 mr-3 w-1rem h-1rem"></span>
                                <span className="text-xl font-medium text-color">Phone Case</span>
                                <span className="text-xl font-medium text-color-secondary ml-auto">134</span>
                            </li>
                            <li className="flex align-items-center py-3">
                                <span className="border-round-md bg-purple-500 mr-3 w-1rem h-1rem"></span>
                                <span className="text-xl font-medium text-color">Purple Band</span>
                                <span className="text-xl font-medium text-color-secondary ml-auto">42</span>
                            </li>
                            <li className="flex align-items-center py-3">
                                <span className="border-round-md bg-blue-500 mr-3 w-1rem h-1rem"></span>
                                <span className="text-xl font-medium text-color">Blue Band</span>
                                <span className="text-xl font-medium text-color-secondary ml-auto">63</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="col-12 lg:col-4 p-3">
                    <div className="card">
                        <div className="flex align-items-center justify-content-between">
                            <div>
                                <span className="font-bold text-3xl text-color">450</span>
                                <p className="mt-2 mb-0 text-2xl text-color-secondary">Reviews Received</p>
                            </div>
                            <div>
                                <img src="/demo/images/dashboard/stats-illustration-1.svg" alt="dashboard-stats" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 lg:col-4 p-3">
                    <div className="card">
                        <div className="flex align-items-center justify-content-between">
                            <div>
                                <span className="font-bold text-3xl text-color">71K</span>
                                <p className="mt-2 mb-0 text-2xl text-color-secondary">Unique Visitors</p>
                            </div>
                            <div>
                                <img src="/demo/images/dashboard/stats-illustration-2.svg" alt="stats-illustration-2" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 lg:col-4 p-3">
                    <div className="card">
                        <div className="flex align-items-center justify-content-between">
                            <div>
                                <span className="font-bold text-3xl text-color">757</span>
                                <p className="mt-2 mb-0 text-2xl text-color-secondary">Payments Processed</p>
                            </div>
                            <div>
                                <img src="/demo/images/dashboard/stats-illustration-3.svg" alt="stats-illustration-3" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 xl:col-6">
                    <div className="card p-4">
                        <div className="flex align-items-center justify-content-between mb-4">
                            <h5>Product Sales</h5>
                            <Button icon="pi pi-refresh" rounded outlined></Button>
                        </div>

                        <div className="grid mr-0">
                            <div className="col-6 md:col-4 lg:col-3 p-3">
                                <div className="text-center">
                                    <div className="flex align-items-center justify-content-center mb-3 mx-auto surface-section border-1 surface-border border-round" style={{ width: '90px', height: '90px' }}>
                                        <img src="/demo/images/dashboard/headphone.png" alt="dashboard-headphone" style={{ width: '48px', height: '48px' }} />
                                    </div>
                                    <span className="font-medium text-color">Headphone</span>
                                    <div className="text-sm text-color-secondary mt-2">220 Sales</div>
                                </div>
                            </div>
                            <div className="col-6 md:col-4 lg:col-3 p-3">
                                <div className="text-center">
                                    <div className="flex align-items-center justify-content-center mb-3 mx-auto surface-section border-1 surface-border border-round" style={{ width: '90px', height: '90px' }}>
                                        <img src="/demo/images/dashboard/laptop.png" alt="dashboard-laptop" style={{ width: '48px', height: '48px' }} />
                                    </div>
                                    <span className="font-medium text-color">Laptop</span>
                                    <div className="text-sm text-color-secondary mt-2">110 Sales</div>
                                </div>
                            </div>
                            <div className="col-6 md:col-4 lg:col-3 p-3">
                                <div className="text-center">
                                    <div className="flex align-items-center justify-content-center mb-3 mx-auto surface-section border-1 surface-border border-round" style={{ width: '90px', height: '90px' }}>
                                        <img src="/demo/images/dashboard/phone.png" alt="dashboard-phone" style={{ width: '48px', height: '48px' }} />
                                    </div>
                                    <span className="font-medium text-color">Phone</span>
                                    <div className="text-sm text-color-secondary mt-2">90 Sales</div>
                                </div>
                            </div>
                            <div className="col-6 md:col-4 lg:col-3 p-3">
                                <div className="text-center">
                                    <div className="flex align-items-center justify-content-center mb-3 mx-auto surface-section border-1 surface-border border-round" style={{ width: '90px', height: '90px' }}>
                                        <img src="/demo/images/dashboard/shoes.png" alt="dashboard-shoes" style={{ width: '48px', height: '48px' }} />
                                    </div>
                                    <span className="font-medium text-color">Shoes</span>
                                    <div className="text-sm text-color-secondary mt-2">77 Sales</div>
                                </div>
                            </div>
                            <div className="col-6 md:col-4 lg:col-3 p-3">
                                <div className="text-center">
                                    <div className="flex align-items-center justify-content-center mb-3 mx-auto surface-section border-1 surface-border border-round" style={{ width: '90px', height: '90px' }}>
                                        <img src="/demo/images/dashboard/tshirt.png" alt="dashboard-tshirt" style={{ width: '48px', height: '48px' }} />
                                    </div>
                                    <span className="font-medium text-color">Tshirt</span>
                                    <div className="text-sm text-color-secondary mt-2">454 Sales</div>
                                </div>
                            </div>
                            <div className="col-6 md:col-4 lg:col-3 p-3">
                                <div className="text-center">
                                    <div className="flex align-items-center justify-content-center mb-3 mx-auto surface-section border-1 surface-border border-round" style={{ width: '90px', height: '90px' }}>
                                        <img src="/demo/images/dashboard/vacuum.png" alt="dashboard-vacuum" style={{ width: '48px', height: '48px' }} />
                                    </div>
                                    <span className="font-medium text-color">Vacuum</span>
                                    <div className="text-sm text-color-secondary mt-2">330 Sales</div>
                                </div>
                            </div>
                            <div className="col-6 md:col-4 lg:col-3 p-3">
                                <div className="text-center">
                                    <div className="flex align-items-center justify-content-center mb-3 mx-auto surface-section border-1 surface-border border-round" style={{ width: '90px', height: '90px' }}>
                                        <img src="/demo/images/dashboard/wallet.png" alt="dashboard-wallet" style={{ width: '48px', height: '48px' }} />
                                    </div>
                                    <span className="font-medium text-color">Wallet</span>
                                    <div className="text-sm text-color-secondary mt-2">42 Sales</div>
                                </div>
                            </div>
                            <div className="col-6 md:col-4 lg:col-3 p-3">
                                <div className="text-center">
                                    <div className="flex align-items-center justify-content-center mb-3 mx-auto surface-section border-1 surface-border border-round" style={{ width: '90px', height: '90px' }}>
                                        <img src="/demo/images/dashboard/watch.png" alt="dashboard-watch" style={{ width: '48px', height: '48px' }} />
                                    </div>
                                    <span className="font-medium text-color">Watch</span>
                                    <div className="text-sm text-color-secondary mt-2">112 Sales</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 xl:col-6">
                    <div className="card">
                        <div className="flex flex-column md:flex-row md:align-items-start md:justify-content-between mb-3">
                            <div className="text-900 text-xl font-semibold mb-3 md:mb-0">Recent Sales</div>
                            <div className="inline-flex align-items-center">
                                <span className="p-input-icon-left flex-auto">
                                    <i className="pi pi-search"></i>
                                    <InputText type={'text'} value={globalFilterValue} onChange={onGlobalFilterChange} placeholder="Search" style={{ borderRadius: '2rem' }} className="w-full" />
                                </span>
                                <Button icon="pi pi-upload" rounded className="mx-3 export-target-button" onClick={exportCSV} tooltip="'Export'"></Button>
                            </div>
                        </div>
                        <DataTable ref={dt} value={products} dataKey="id" paginator rows={5} className="datatable-responsive" globalFilter={globalFilterValue} emptyMessage="No products found." responsiveLayout="scroll">
                            <Column field="name" header="Name" sortable body={nameBodyTemplate} headerStyle={{ minWidth: '12rem' }}></Column>
                            <Column field="category" header="Category" sortable body={categoryBodyTemplate} headerStyle={{ minWidth: '10rem' }}></Column>
                            <Column field="price" header="Price" body={priceBodyTemplate} sortable headerStyle={{ minWidth: '10rem' }}></Column>
                            <Column field="inventoryStatus" header="Status" body={statusBodyTemplate} sortable headerStyle={{ minWidth: '10rem' }}></Column>
                            <Column body={searchBodyTemplate} style={{ textAlign: 'center' }}></Column>
                        </DataTable>
                    </div>
                </div>
            </div>
        </>
    );
}

export default Dashboard;
