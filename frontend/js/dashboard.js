document.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
});

let invoicesData = [];
let currentPage = 1;
const itemsPerPage = 10;
let monthlyChart = null;
let providersChart = null;

async function initializeDashboard() {
    await fetchData();
    setupEventListeners();
    initializeCharts();
}

async function fetchData() {
    try {
        const response = await fetch('http://localhost:3090/dashboard_data');
        const data = await response.json();
        invoicesData = data.invoices;
        updateDashboard();
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

function setupEventListeners() {
    document.getElementById('monthFilter').addEventListener('change', updateDashboard);
    document.getElementById('searchInvoices').addEventListener('input', updateDashboard);
    document.getElementById('prevPage').addEventListener('click', () => changePage(-1));
    document.getElementById('nextPage').addEventListener('click', () => changePage(1));
}

function initializeCharts() {
    // Gráfico mensual
    const monthlyCtx = document.getElementById('monthlyChart').getContext('2d');
    monthlyChart = new Chart(monthlyCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Total Facturas',
                data: [],
                backgroundColor: 'rgba(74, 144, 226, 0.6)',
                borderColor: 'rgba(74, 144, 226, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Gráfico de proveedores
    const providersCtx = document.getElementById('providersChart').getContext('2d');
    providersChart = new Chart(providersCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    'rgba(74, 144, 226, 0.6)',
                    'rgba(39, 174, 96, 0.6)',
                    'rgba(231, 76, 60, 0.6)',
                    'rgba(241, 196, 15, 0.6)',
                    'rgba(155, 89, 182, 0.6)'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

function updateDashboard() {
    const filteredData = filterData();
    updateStats(filteredData);
    updateCharts(filteredData);
    updateTable(filteredData);
}

function filterData() {
    const searchTerm = document.getElementById('searchInvoices').value.toLowerCase();
    const monthFilter = document.getElementById('monthFilter').value;

    return invoicesData.filter(invoice => {
        const matchesSearch = 
            invoice.nombre_proveedor.toLowerCase().includes(searchTerm) ||
            invoice.nro_factura.toLowerCase().includes(searchTerm) ||
            invoice.ruc_proveedor.includes(searchTerm);

        const matchesMonth = !monthFilter || 
            invoice.fecha_emision.startsWith(monthFilter);

        return matchesSearch && matchesMonth;
    });
}

function updateStats(data) {
    document.getElementById('totalInvoices').textContent = data.length;
    
    const totalAmount = data.reduce((sum, invoice) => sum + invoice.importe_total, 0);
    document.getElementById('totalAmount').textContent = formatCurrency(totalAmount);
    
    const averageAmount = data.length > 0 ? totalAmount / data.length : 0;
    document.getElementById('averageAmount').textContent = formatCurrency(averageAmount);
    const uniqueProviders = new Set(data.map(invoice => invoice.nombre_proveedor));
    document.getElementById('totalProviders').textContent = uniqueProviders.size;
}

function updateCharts(data) {
    // Actualizar gráfico mensual
    const monthlyData = {};
    data.forEach(invoice => {
        const month = invoice.fecha_emision.substring(0, 7); // YYYY-MM
        monthlyData[month] = (monthlyData[month] || 0) + invoice.importe_total;
    });

    monthlyChart.data.labels = Object.keys(monthlyData);
    monthlyChart.data.datasets[0].data = Object.values(monthlyData);
    monthlyChart.update();

    // Actualizar gráfico de proveedores
    const providersData = {};
    data.forEach(invoice => {
        providersData[invoice.nombre_proveedor] = (providersData[invoice.nombre_proveedor] || 0) + invoice.importe_total;
    });

    const sortedProviders = Object.entries(providersData)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

    providersChart.data.labels = sortedProviders.map(([name]) => name);
    providersChart.data.datasets[0].data = sortedProviders.map(([,value]) => value);
    providersChart.update();
}

function updateTable(data) {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedData = data.slice(start, end);

    const tbody = document.getElementById('invoicesTableBody');
    tbody.innerHTML = '';

    paginatedData.forEach(invoice => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(invoice.fecha_emision)}</td>
            <td>${invoice.nro_factura}</td>
            <td>${invoice.nombre_proveedor}</td>
            <td>${invoice.ruc_proveedor}</td>
            <td>${formatCurrency(invoice.importe_total)}</td>
            <td class="actions">
                <button class="btn-action btn-view" onclick="viewInvoice(${invoice.id})">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-action btn-download" onclick="downloadInvoice(${invoice.id})">
                    <i class="fas fa-download"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    updatePagination(data.length);
}

function updatePagination(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    document.getElementById('currentPage').textContent = `Página ${currentPage} de ${totalPages}`;
    
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}

function changePage(delta) {
    const newPage = currentPage + delta;
    const totalPages = Math.ceil(invoicesData.length / itemsPerPage);
    
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        updateDashboard();
    }
}

function viewInvoice(id) {
    // Implementar visualización de factura
    console.log(`Ver factura ${id}`);
}

function downloadInvoice(id) {
    // Implementar descarga de factura
    console.log(`Descargar factura ${id}`);
}

function formatCurrency(amount) {
    return `S/ ${amount.toFixed(2)}`;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-PE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}