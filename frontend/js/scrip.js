(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const STORAGE_KEY = 'donativoSeguro.datos.v1';
  const SESSION_KEY = 'donativoSeguro.sesion';
  const TAB_SESSION_KEY = 'donativoSeguro.sesion.pestana';
  const pageTitles = { dashboard: 'Dashboard', donantes: 'Donantes', registro: 'Registrar donativo', donativos: 'Consultar donativos', usuarios: 'Usuarios' };
  const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });
  const dateFormat = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  let currentUser = null;
  let currentPage = 'dashboard';
  let modalTrigger = null;
  let storageWarning = false;

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function icon(name) {
    return `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  }

  function localDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function daysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return localDate(date);
  }

  function formatDate(value) {
    return value ? dateFormat.format(new Date(`${value}T12:00:00`)) : 'Sin acceso';
  }

  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  function normalized(value) {
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function demoData() {
    const donors = [
      { id: 'd1', name: 'Mariana López', email: 'mariana.lopez@example.com', phone: '5512345678', person: 'Persona física', date: daysAgo(45) },
      { id: 'd2', name: 'Carlos Hernández', email: 'carlos.h@example.com', phone: '5523456789', person: 'Persona física', date: daysAgo(38) },
      { id: 'd3', name: 'Fundación Esperanza', email: 'contacto@esperanza.example', phone: '5534567890', person: 'Persona moral', date: daysAgo(34) },
      { id: 'd4', name: 'Ana Martínez', email: 'ana.martinez@example.com', phone: '5545678901', person: 'Persona física', date: daysAgo(21) },
      { id: 'd5', name: 'José Ramírez', email: 'jose.ramirez@example.com', phone: '5556789012', person: 'Persona física', date: daysAgo(18) },
      { id: 'd6', name: 'Alimentos del Valle', email: 'ayuda@valle.example', phone: '5567890123', person: 'Persona moral', date: daysAgo(15) },
      { id: 'd7', name: 'Sofía García', email: 'sofia.garcia@example.com', phone: '5578901234', person: 'Persona física', date: daysAgo(10) },
      { id: 'd8', name: 'Miguel Torres', email: 'miguel.torres@example.com', phone: '5589012345', person: 'Persona física', date: daysAgo(8) }
    ];
    const users = [
      { id: 'u1', name: 'Gabriel Mendoza', email: 'admin@donativoseguro.com', password: '123456', role: 'Administrador', active: true, lastAccess: daysAgo(0) },
      { id: 'u2', name: 'Valeria Sánchez', email: 'usuario@donativoseguro.com', password: '123456', role: 'Usuario', active: true, lastAccess: daysAgo(1) },
      { id: 'u3', name: 'Daniel Rodríguez', email: 'daniel@donativoseguro.com', password: '123456', role: 'Administrador', active: true, lastAccess: daysAgo(3) },
      { id: 'u4', name: 'Lucía Fernández', email: 'lucia@donativoseguro.com', password: '123456', role: 'Usuario', active: false, lastAccess: daysAgo(12) },
      { id: 'u5', name: 'Mateo Ruiz', email: 'mateo@donativoseguro.com', password: '123456', role: 'Usuario', active: true, lastAccess: daysAgo(2) }
    ];
    const donations = [
      { id: 'DON-0008', donorId: 'd1', type: 'Efectivo', amount: 2500, description: '', date: daysAgo(0), notes: 'Aportación para el programa de apoyo comunitario.', registeredBy: 'Gabriel Mendoza', status: 'Verificado' },
      { id: 'DON-0007', donorId: 'd2', type: 'Especie', amount: 0, description: '10 cajas de alimentos', date: daysAgo(1), notes: 'Alimentos no perecederos para familias de la comunidad.', registeredBy: 'Valeria Sánchez', status: 'Registrado' },
      { id: 'DON-0006', donorId: 'd3', type: 'Efectivo', amount: 15000, description: '', date: daysAgo(2), notes: 'Apoyo a la campaña de educación.', registeredBy: 'Gabriel Mendoza', status: 'Verificado' },
      { id: 'DON-0005', donorId: 'd4', type: 'Especie', amount: 0, description: '25 kits escolares', date: daysAgo(3), notes: 'Cada kit contiene cuadernos, lápices y colores.', registeredBy: 'Valeria Sánchez', status: 'Verificado' },
      { id: 'DON-0004', donorId: 'd5', type: 'Efectivo', amount: 1800, description: '', date: daysAgo(4), notes: 'Donativo destinado a necesidades prioritarias.', registeredBy: 'Gabriel Mendoza', status: 'Registrado' },
      { id: 'DON-0003', donorId: 'd6', type: 'Especie', amount: 0, description: '50 despensas básicas', date: daysAgo(7), notes: 'Entrega realizada en el centro de acopio.', registeredBy: 'Daniel Rodríguez', status: 'Verificado' },
      { id: 'DON-0002', donorId: 'd7', type: 'Efectivo', amount: 3500, description: '', date: daysAgo(8), notes: '', registeredBy: 'Mateo Ruiz', status: 'Verificado' },
      { id: 'DON-0001', donorId: 'd8', type: 'Efectivo', amount: 1200, description: '', date: daysAgo(35), notes: 'Aportación para el fondo comunitario.', registeredBy: 'Valeria Sánchez', status: 'Verificado' }
    ];
    donations.forEach((donation) => { donation.donorName = donors.find((donor) => donor.id === donation.donorId).name; });
    return { donors, users, donations, nextDonation: 9 };
  }

  function readStorage(key) {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch { storageWarning = true; return null; }
  }

  function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch {
      if (!storageWarning) toast('No se pudo guardar en el navegador. Los cambios durarán solo esta sesión.', true);
      storageWarning = true;
    }
  }

  const storedData = readStorage(STORAGE_KEY);
  let data = storedData && Array.isArray(storedData.donors) && Array.isArray(storedData.users) && Array.isArray(storedData.donations) && Number.isInteger(storedData.nextDonation) ? storedData : demoData();
  migrateOwnership();

  function migrateOwnership() {
    if (data.schemaVersion >= 2) return;
    if (!data.users.some((user) => user.email === 'mateo@donativoseguro.com')) {
      data.users.push({ id: makeId('u'), name: 'Mateo Ruiz', email: 'mateo@donativoseguro.com', password: '123456', role: 'Usuario', active: true, lastAccess: '' });
    }
    // La versión anterior guardaba nombres, no IDs. Solo migramos coincidencias inequívocas.
    data.donations.forEach((donation) => {
      const matches = data.users.filter((user) => user.name === donation.registeredBy);
      donation.createdById ??= matches.length === 1 ? matches[0].id : null;
      donation.ownerId ??= donation.createdById;
    });
    data.donors.forEach((donor) => {
      const related = data.donations.filter((donation) => donation.donorId === donor.id);
      const owners = [...new Set(related.map((donation) => donation.ownerId))];
      donor.ownerId ??= owners.length === 1 ? owners[0] : null;
    });
    data.schemaVersion = 2;
    persist();
  }

  function persist() { writeStorage(STORAGE_KEY, data); }
  function isAdmin() { return currentUser?.active && currentUser.role === 'Administrador'; }
  function canAccess(record) { return !!currentUser?.active && !!record && (isAdmin() || record.ownerId === currentUser.id); }
  function visibleDonors() { return data.donors.filter(canAccess); }
  function visibleDonations() { return data.donations.filter(canAccess); }
  function ownerName(id) { return data.users.find((user) => user.id === id)?.name || 'Sin asignar'; }
  function denyAccess() { toast('Este registro no está disponible en tu espacio.', true); }
  function authorizedDonor(id) {
    const donor = data.donors.find((item) => item.id === id);
    if (!canAccess(donor)) { denyAccess(); return null; }
    return donor;
  }
  function authorizedDonation(id) {
    const donation = data.donations.find((item) => item.id === id);
    if (!canAccess(donation)) { denyAccess(); return null; }
    return donation;
  }
  function donorName(donation) { return data.donors.find((donor) => donor.id === donation.donorId)?.name || donation.donorName; }
  function donationValue(donation) { return donation.type === 'Efectivo' ? money.format(donation.amount) : donation.description; }
  function sortedDonations() { return visibleDonations().sort((a, b) => b.date.localeCompare(a.date) || Number(b.id.slice(4)) - Number(a.id.slice(4))); }

  function badge(value) {
    const classes = { Activo: 'success', Inactivo: 'inactive', Verificado: 'success', Registrado: 'pending', Efectivo: 'type-cash', Especie: 'type-kind', Administrador: 'blue', Usuario: 'purple' };
    return `<span class="badge ${classes[value] || 'inactive'}"><span class="badge-dot"></span>${escapeHTML(value)}</span>`;
  }

  function person(name, subtitle = '') {
    return `<div class="person-cell"><span class="avatar">${escapeHTML(initials(name))}</span><span>${escapeHTML(name)}${subtitle ? `<small>${escapeHTML(subtitle)}</small>` : ''}</span></div>`;
  }

  function actionButton(action, id, label, iconName, extra = '') {
    return `<button type="button" class="icon-button ${extra}" data-action="${action}" data-id="${escapeHTML(id)}" aria-label="${escapeHTML(label)}" title="${escapeHTML(label)}">${icon(iconName)}</button>`;
  }

  function emptyRow(columns, title, description) {
    return `<tr><td colspan="${columns}" class="empty-state">${icon('search')}<strong>${title}</strong><p>${description}</p></td></tr>`;
  }

  function stat(title, value, note, iconName, color = 'teal') {
    return `<article class="stat-card"><div class="stat-top"><span>${title}</span><span class="quick-icon ${color}">${icon(iconName)}</span></div><div class="stat-number">${value}</div>${note ? `<div class="stat-note">${icon('check')}${note}</div>` : ''}</article>`;
  }

  function renderDashboard() {
    const donations = visibleDonations();
    const total = donations.reduce((sum, donation) => sum + (donation.type === 'Efectivo' ? Math.round(donation.amount * 100) : 0), 0) / 100;
    const monthCount = donations.filter((donation) => donation.date.slice(0, 7) === localDate().slice(0, 7)).length;
    $('#dashboard-stats').innerHTML = [
      stat(isAdmin() ? 'Donantes del equipo' : 'Mis donantes', visibleDonors().length, isAdmin() ? 'Directorio general' : 'Personas que tienes a tu cargo', 'people', 'blue'),
      stat(isAdmin() ? 'Todos los donativos' : 'Mis donativos', donations.length, isAdmin() ? 'Aportes de todas las cuentas' : 'Solo los registros de tu espacio', 'heart'),
      stat(isAdmin() ? 'Total recaudado' : 'Mi recaudación', `${money.format(total)}<small>MXN</small>`, 'Donativos en efectivo', 'money', 'purple'),
      stat('Donativos este mes', monthCount, 'Generosidad que sigue creciendo', 'calendar', 'amber')
    ].join('');
    $('#recent-body').innerHTML = sortedDonations().slice(0, 5).map((donation) => `<tr><td>${person(donorName(donation))}</td><td>${badge(donation.type)}</td><td class="amount-cell">${escapeHTML(donationValue(donation))}</td><td>${formatDate(donation.date)}</td><td>${badge(donation.status)}</td></tr>`).join('') || emptyRow(5, 'El primer aporte comienza contigo', 'Registra un donativo para verlo aquí.');
    const pending = donations.filter((donation) => donation.status === 'Registrado').length;
    $('#notification-text').textContent = `${pending} donativos pendientes de verificación. ${donations.length} aportes en ${isAdmin() ? 'el historial del equipo' : 'tu historial'}.`;
    $('#review-summary').innerHTML = `<div>${icon(isAdmin() ? 'shield' : 'heart')}<div><strong>${isAdmin() ? 'Centro de revisión' : 'El seguimiento de tus aportes'}</strong><p>${pending ? `${pending} donativo${pending === 1 ? '' : 's'} ${isAdmin() ? 'por verificar en el equipo.' : 'en espera de revisión por administración.'}` : 'Todos los registros de este espacio están al día.'}</p></div></div><button class="text-button" data-action="pending-donations">${isAdmin() ? 'Revisar pendientes' : 'Consultar estado'} ${icon('arrow')}</button>`;
    if (isAdmin()) {
      const unassigned = data.donors.filter((donor) => !donor.ownerId).length;
      if (unassigned) $('#review-summary').insertAdjacentHTML('beforeend', `<p class="legacy-notice">${unassigned} donante(s) anterior(es) sin responsable identificado. Asígnalos desde Donantes; mientras tanto, solo administración puede verlos.</p>`);
    }
  }

  function renderDonors() {
    const query = normalized($('#donor-search').value);
    const available = visibleDonors();
    const donors = available.filter((donor) => normalized(`${donor.name} ${donor.email} ${donor.phone}`).includes(query));
    $('#donor-count').textContent = `${donors.length} de ${available.length} donantes ${isAdmin() ? 'del equipo' : 'en tu espacio'}`;
    $('#donors-body').innerHTML = donors.map((donor) => `<tr><td>${person(donor.name)}</td><td>${escapeHTML(donor.email)}</td><td>${escapeHTML(donor.phone)}</td><td>${escapeHTML(donor.person)}</td><td>${formatDate(donor.date)}</td>${isAdmin() ? `<td>${escapeHTML(ownerName(donor.ownerId))}</td>` : ''}<td>${badge('Activo')}</td><td><div class="row-actions">${actionButton('view-donor', donor.id, `Ver a ${donor.name}`, 'eye')}${actionButton('edit-donor', donor.id, `Editar a ${donor.name}`, 'edit')}${actionButton('delete-donor', donor.id, `Eliminar a ${donor.name}`, 'trash', 'delete')}</div></td></tr>`).join('') || emptyRow(isAdmin() ? 8 : 7, query ? 'No encontramos donantes' : 'Tu primer donante empieza aquí', query ? 'Prueba otra búsqueda dentro de tu espacio.' : 'Selecciona Nuevo donante para empezar a registrar tus aportes.');
    const selected = $('#donation-donor').value;
    $('#donation-donor').innerHTML = '<option value="">Selecciona un donante</option>' + available.map((donor) => `<option value="${escapeHTML(donor.id)}">${escapeHTML(donor.name)}${isAdmin() ? ` · ${escapeHTML(ownerName(donor.ownerId))}` : ''}</option>`).join('');
    if (available.some((donor) => donor.id === selected)) $('#donation-donor').value = selected;
    updateOwnerHint();
  }

  function renderDonations() {
    const query = normalized($('#donation-search').value);
    const type = $('#type-filter').value;
    const date = $('#date-filter').value;
    const owner = isAdmin() ? $('#owner-filter').value : '';
    const status = $('#status-filter').value;
    const donations = sortedDonations().filter((donation) => normalized(donorName(donation)).includes(query) && (!type || donation.type === type) && (!date || donation.date === date) && (!owner || (donation.ownerId || 'unassigned') === owner) && (!status || donation.status === status));
    $('#donation-count').textContent = `${donations.length} de ${visibleDonations().length} registros`;
    $('#donations-body').innerHTML = donations.map((donation) => `<tr><td class="record-id">${escapeHTML(donation.id)}</td><td>${person(donorName(donation))}</td><td>${badge(donation.type)}</td><td class="amount-cell">${escapeHTML(donationValue(donation))}</td><td>${formatDate(donation.date)}</td><td>${escapeHTML(donation.registeredBy)}</td>${isAdmin() ? `<td>${escapeHTML(ownerName(donation.ownerId))}</td>` : ''}<td>${badge(donation.status)}</td><td>${actionButton('view-donation', donation.id, `Ver detalles de ${donation.id}`, 'eye')}</td></tr>`).join('') || emptyRow(isAdmin() ? 9 : 8, 'No hay donativos que coincidan', 'Ajusta los filtros o registra un nuevo aporte en tu espacio.');
  }

  function renderUsers() {
    if (!isAdmin()) { $('#users-body').innerHTML = ''; $('#user-stats').innerHTML = ''; return; }
    $('#user-stats').innerHTML = [
      stat('Usuarios activos', data.users.filter((user) => user.active).length, '', 'people'),
      stat('Administradores', data.users.filter((user) => user.role === 'Administrador').length, '', 'shield', 'blue'),
      stat('Usuarios estándar', data.users.filter((user) => user.role === 'Usuario').length, '', 'people', 'purple')
    ].join('');
    $('#users-body').innerHTML = data.users.map((user) => `<tr><td>${person(user.name, user.id === currentUser.id ? 'Tu cuenta' : '')}</td><td>${escapeHTML(user.email)}</td><td>${badge(user.role)}</td><td><button type="button" class="badge ${user.active ? 'success' : 'inactive'}" data-action="toggle-user" data-id="${escapeHTML(user.id)}" aria-label="${user.active ? 'Desactivar' : 'Activar'} a ${escapeHTML(user.name)}"><span class="badge-dot"></span>${user.active ? 'Activo' : 'Inactivo'}</button></td><td>${formatDate(user.lastAccess)}</td><td>${actionButton('edit-user', user.id, `Editar a ${user.name}`, 'edit')}</td></tr>`).join('');
  }

  function renderAccount() {
    $('#account-name').textContent = currentUser.name;
    $('#account-role').textContent = currentUser.role;
    $('#account-avatar').textContent = initials(currentUser.name);
    $$('[data-admin]').forEach((element) => { element.hidden = !isAdmin(); });
    renderExperience();
    const selected = $('#owner-filter').value;
    $('#owner-filter').innerHTML = isAdmin() ? '<option value="">Todo el equipo</option><option value="unassigned">Sin asignar</option>' + data.users.map((user) => `<option value="${escapeHTML(user.id)}">${escapeHTML(user.name)}</option>`).join('') : '<option value="">Mi cuenta</option>';
    if (isAdmin() && [...$('#owner-filter').options].some((option) => option.value === selected)) $('#owner-filter').value = selected;
  }

  function renderExperience() {
    const admin = isAdmin();
    $('#app').dataset.workspace = admin ? 'admin' : 'personal';
    $('#workspace-name').textContent = admin ? 'Administración' : 'Mi espacio';
    $('#workspace-description').textContent = admin ? 'Vista general del equipo' : currentUser.name;
    $('.header-home').innerHTML = `${admin ? 'Administración' : 'Mi espacio'} <span>/</span>`;
    $('#scope-notice-text').textContent = admin ? 'Supervisa los registros del equipo, sus responsables y el estado de cada aporte.' : 'Aquí ves únicamente los donantes y donativos de tu cuenta. Administración puede darles seguimiento.';
    $('#scope-badge').textContent = admin ? 'Vista general' : 'Vista personal';
    Object.assign(pageTitles, admin
      ? { dashboard: 'Resumen general', donantes: 'Todos los donantes', donativos: 'Todos los donativos' }
      : { dashboard: 'Mi resumen', donantes: 'Mis donantes', donativos: 'Mis donativos' });
    $$('.nav-item[data-page]').forEach((button) => {
      const icons = { dashboard: 'grid', donantes: 'people', registro: 'plus', donativos: 'list', usuarios: 'shield' };
      button.innerHTML = `${icon(icons[button.dataset.page])} ${pageTitles[button.dataset.page]}`;
    });
    $('#dashboard-title').textContent = admin ? 'El impacto de todo tu equipo.' : `Hola, ${currentUser.name.split(' ')[0]}. Este es tu espacio.`;
    $('#page-dashboard .page-heading p').textContent = admin ? 'Una visión completa para acompañar, organizar y verificar cada aporte.' : 'Lleva el seguimiento de tus donantes y de la ayuda que registras.';
    $('.welcome-banner .banner-kicker').textContent = admin ? 'ADMINISTRACIÓN · VISIÓN GENERAL' : 'TU CUENTA · TU CONTRIBUCIÓN';
    $('.welcome-banner h2').textContent = admin ? 'La confianza también se construye con seguimiento.' : 'Cada aporte que registras tiene una historia.';
    $('.welcome-banner p').textContent = admin ? 'Revisa los aportes del equipo y confirma la información recibida.' : 'Organiza tus donantes y consulta el estado de tus donativos.';
    const bannerButton = $('.banner-button');
    bannerButton.removeAttribute('data-page');
    bannerButton.removeAttribute('data-action');
    if (admin) bannerButton.dataset.action = 'pending-donations'; else bannerButton.dataset.page = 'registro';
    bannerButton.innerHTML = `${icon(admin ? 'shield' : 'plus')} ${admin ? 'Revisar donativos' : 'Registrar donativo'} ${icon('arrow')}`;
    $('.recent-card h2').textContent = admin ? 'Actividad reciente del equipo' : 'Mis donativos recientes';
    $('.recent-card .card-heading p').textContent = admin ? 'Últimos aportes registrados en todas las cuentas.' : 'Los últimos aportes registrados en tu espacio.';
    $('#donantes-title').textContent = admin ? 'Gestión de donantes' : 'Mis donantes';
    $('#page-donantes .page-heading p').textContent = admin ? 'Consulta el directorio general y asigna cada donante a un responsable.' : 'Registra y administra a las personas y organizaciones que tienes a tu cargo.';
    $('#page-donantes .table-toolbar h2').textContent = admin ? 'Directorio del equipo' : 'Mi directorio';
    $('#donativos-title').textContent = admin ? 'Todos los donativos' : 'Mis donativos';
    $('#page-donativos .page-heading p').textContent = admin ? 'Consulta, filtra y verifica las contribuciones de todo el equipo.' : 'Consulta tus aportes y sigue su verificación por administración.';
    $('#page-registro .page-heading p').textContent = admin ? 'El aporte quedará en el espacio del responsable del donante.' : 'Registra un aporte asociado a uno de tus donantes.';
    $('.purpose-card strong').textContent = admin ? 'Un equipo, un propósito' : 'Tu aporte deja huella';
    $('.purpose-card p').textContent = admin ? 'Acompaña a cada colaborador y mantén los registros al día.' : 'Tu actividad tiene un espacio propio para crecer.';
    $('#header-section').textContent = pageTitles[currentPage];
  }

  function renderAll() {
    if (!currentUser) return;
    renderAccount(); renderDashboard(); renderDonors(); renderDonations(); renderUsers();
  }

  function navigate(page, updateHash = true) {
    if (!currentUser) return;
    if (page.startsWith('/')) {
      const [, workspace, section] = page.split('/');
      if (workspace !== (isAdmin() ? 'administracion' : 'mi-espacio')) {
        toast('Ese enlace corresponde a otro espacio. Te llevamos a tu resumen.', true);
        page = 'dashboard';
      } else page = section === 'resumen' ? 'dashboard' : section;
    }
    if (!pageTitles[page]) page = 'dashboard';
    if (page === 'usuarios' && !isAdmin()) { toast('Esta sección solo está disponible para administradores.', true); page = 'dashboard'; }
    currentPage = page;
    $$('.page').forEach((section) => { section.hidden = section.id !== `page-${page}`; });
    $$('.nav-item[data-page]').forEach((button) => {
      button.classList.toggle('active', button.dataset.page === page);
      if (button.dataset.page === page) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    $('#header-section').textContent = pageTitles[page];
    document.title = `${pageTitles[page]} | DonativoSeguro`;
    const hash = `#/${isAdmin() ? 'administracion' : 'mi-espacio'}/${page === 'dashboard' ? 'resumen' : page}`;
    if (updateHash && location.hash !== hash) history.replaceState(null, '', hash);
    setSidebar(false);
    setNotifications(false);
    $('#main-content').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function setSidebar(open) {
    $('#sidebar').classList.toggle('open', open);
    $('#sidebar-backdrop').hidden = !open;
    $('#menu-toggle').setAttribute('aria-expanded', String(open));
    $('#menu-toggle').setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    $('#sidebar').inert = window.innerWidth <= 960 && !open;
  }

  function setNotifications(open) {
    $('#notifications').hidden = !open;
    $('#notification-toggle').setAttribute('aria-expanded', String(open));
  }

  function saveSession() {
    try { sessionStorage.setItem(TAB_SESSION_KEY, JSON.stringify({ usuario: currentUser.id, sesionActiva: true })); }
    catch { storageWarning = true; }
  }

  function startSession(user) {
    currentUser = user;
    resetDonation();
    $('#filter-form').reset();
    $('#donor-search').value = '';
    $('#modal-content').innerHTML = '';
    $('#toast-container').innerHTML = '';
    user.lastAccess = localDate();
    persist(); saveSession();
    $('#login-screen').hidden = true;
    $('#app').hidden = false;
    $('#login-form').reset();
    $('#login-password').type = 'password';
    $('#toggle-password').setAttribute('aria-label', 'Mostrar contraseña');
    $('#toggle-password').setAttribute('aria-pressed', 'false');
    $('#login-error').hidden = true;
    $('#caps-lock-hint').hidden = true;
    $('#demo-selection').hidden = true;
    $('#demo-access').open = false;
    renderAll();
    navigate(location.hash.slice(1) || 'dashboard');
  }

  function logout() {
    closeModal();
    currentUser = null;
    try { sessionStorage.removeItem(TAB_SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch { /* La sesión en memoria también se elimina. */ }
    $('#app').hidden = true;
    $('#login-screen').hidden = false;
    $('#donation-form').reset();
    resetDonation();
    $('#filter-form').reset();
    $('#donor-search').value = '';
    for (const selector of ['#users-body', '#user-stats', '#donors-body', '#donations-body', '#recent-body', '#dashboard-stats', '#modal-content', '#review-summary', '#donation-donor', '#notification-text', '#account-name', '#account-role', '#account-avatar']) $(selector).innerHTML = '';
    $('#owner-filter').innerHTML = '<option value="">Todo el equipo</option>';
    setSidebar(false);
    setNotifications(false);
    history.replaceState(null, '', location.pathname + location.search);
    document.title = 'DonativoSeguro | Gestión de donativos';
    $('#login-email').focus();
    toast('Sesión cerrada correctamente');
  }

  function toast(message, error = false) {
    const element = document.createElement('div');
    element.className = `toast${error ? ' error' : ''}`;
    element.innerHTML = `${icon(error ? 'close' : 'check')}<span>${escapeHTML(message)}</span><button class="icon-button" aria-label="Cerrar notificación">${icon('close')}</button>`;
    element.querySelector('button').addEventListener('click', () => element.remove());
    $('#toast-container').append(element);
    setTimeout(() => element.remove(), 5500);
  }

  function openModal(title, content) {
    modalTrigger = document.activeElement;
    $('#modal-title').textContent = title;
    $('#modal-content').innerHTML = content;
    if (!$('#modal').open) $('#modal').showModal();
    const focusTarget = $('#modal-content input:not([disabled]), #modal-content select, #modal-content button');
    if (focusTarget) focusTarget.focus();
  }

  function closeModal() {
    if (!$('#modal').open) return;
    $('#modal').close();
  }

  function modalActions(submitText, danger = false) {
    return `<p class="form-error" id="modal-error" role="alert" hidden></p><div class="form-actions"><button type="button" class="button secondary" data-close-modal>Cancelar</button><button type="submit" class="button ${danger ? 'danger' : 'primary'}">${submitText}</button></div>`;
  }

  function showError(selector, message) {
    const element = $(selector);
    element.textContent = message;
    element.hidden = false;
  }

  function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

  function donorForm(id = null) {
    if (!currentUser) return;
    const donor = id ? authorizedDonor(id) : null;
    if (id && !donor) return;
    openModal(donor ? 'Editar donante' : 'Nuevo donante', `<p class="modal-intro">Cada persona es parte del cambio. Completa los campos obligatorios.</p><form id="donor-form"><div class="form-grid"><div class="field full"><label for="donor-name">Nombre completo *</label><input id="donor-name" name="name" value="${escapeHTML(donor?.name || '')}" maxlength="100" autocomplete="name" required></div><div class="field full"><label for="donor-email">Correo electrónico *</label><input id="donor-email" name="email" type="email" value="${escapeHTML(donor?.email || '')}" maxlength="150" autocomplete="email" required></div><div class="field"><label for="donor-phone">Teléfono *</label><input id="donor-phone" name="phone" type="tel" inputmode="numeric" pattern="[0-9]{1,10}" maxlength="10" title="Ingresa de 1 a 10 dígitos, sin espacios ni símbolos." value="${escapeHTML(donor?.phone || '')}" autocomplete="tel" required></div><div class="field"><label for="donor-person">Tipo de persona *</label><select id="donor-person" name="person" required><option${donor?.person === 'Persona física' ? ' selected' : ''}>Persona física</option><option${donor?.person === 'Persona moral' ? ' selected' : ''}>Persona moral</option></select></div></div>${modalActions(donor ? 'Guardar cambios' : 'Guardar donante')}</form>`);
    if (isAdmin()) {
      const ownerId = donor ? donor.ownerId : currentUser.id;
      $('#donor-form .form-grid').insertAdjacentHTML('beforeend', `<div class="field full"><label for="donor-owner">Responsable del donante</label><select id="donor-owner" name="ownerId"><option value="">Sin asignar · solo administración</option>${data.users.map((user) => `<option value="${escapeHTML(user.id)}"${user.id === ownerId ? ' selected' : ''}>${escapeHTML(user.name)}${user.active ? '' : ' (inactivo)'}</option>`).join('')}</select><p class="field-hint">El responsable verá este donante en su cuenta. Si lo cambias, todos sus donativos asociados se trasladarán al nuevo espacio.</p></div>`);
    }
    $('#donor-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const existing = id ? data.donors.find((item) => item.id === id) : null;
      if (!currentUser || (id && !canAccess(existing))) return denyAccess();
      const values = Object.fromEntries(new FormData(event.target));
      values.name = values.name.trim(); values.email = values.email.trim().toLowerCase();
      values.ownerId = isAdmin() ? values.ownerId || null : currentUser.id;
      if (values.ownerId && !data.users.some((user) => user.id === values.ownerId)) return showError('#modal-error', 'Selecciona un responsable válido.');
      if (!values.name || !validEmail(values.email) || !/^\d{1,10}$/.test(values.phone)) return showError('#modal-error', 'Completa el nombre, un correo válido y un teléfono de máximo 10 dígitos.');
      if (data.donors.some((item) => item.id !== id && item.ownerId === values.ownerId && item.email.toLowerCase() === values.email)) return showError('#modal-error', 'Ya existe un donante con este correo en el espacio seleccionado.');
      if (existing) {
        if (isAdmin() && existing.ownerId !== values.ownerId) data.donations.filter((donation) => donation.donorId === id).forEach((donation) => { donation.ownerId = values.ownerId; });
        Object.assign(existing, values);
      } else data.donors.unshift({ ...values, id: makeId('d'), createdById: currentUser.id, date: localDate() });
      persist(); renderAll(); closeModal();
      if (currentPage === 'registro' && !donor) $('#donation-donor').value = data.donors[0].id;
      updateOwnerHint();
      toast(donor ? 'Donante actualizado correctamente' : 'Donante registrado correctamente');
    });
  }

  function donorDetails(id) {
    const donor = authorizedDonor(id);
    if (!donor) return;
    const count = visibleDonations().filter((item) => item.donorId === id).length;
    openModal('Información del donante', `<div class="detail-hero"><span class="avatar">${escapeHTML(initials(donor.name))}</span><div><strong>${escapeHTML(donor.name)}</strong><p>${escapeHTML(donor.person)}</p></div></div><dl class="detail-list"><div><dt>Correo electrónico</dt><dd>${escapeHTML(donor.email)}</dd></div><div><dt>Teléfono</dt><dd>${escapeHTML(donor.phone)}</dd></div><div><dt>Fecha de registro</dt><dd>${formatDate(donor.date)}</dd></div><div><dt>Estado</dt><dd>${badge('Activo')}</dd></div><div class="full"><dt>Donativos asociados</dt><dd>${count} aportes registrados</dd></div></dl><div class="form-actions"><button class="button secondary" data-close-modal>Cerrar</button></div>`);
  }

  function deleteDonor(id) {
    const donor = authorizedDonor(id);
    if (!donor) return;
    openModal('Eliminar donante', `<form id="delete-donor-form"><p class="confirm-copy">¿Deseas eliminar a <strong>${escapeHTML(donor.name)}</strong> del directorio? Sus donativos anteriores se conservarán en el historial con el nombre del donante.</p>${modalActions('Eliminar donante', true)}</form>`);
    $('#delete-donor-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const existing = data.donors.find((item) => item.id === id);
      if (!canAccess(existing)) return denyAccess();
      data.donations.filter((donation) => donation.donorId === id).forEach((donation) => { donation.donorName = existing.name; });
      data.donors = data.donors.filter((item) => item.id !== id);
      persist(); renderAll(); closeModal(); toast('Donante eliminado del directorio');
    });
  }

  function updateDonationType() {
    const cash = $('#donation-form input[name="type"]:checked').value === 'Efectivo';
    $('#amount-field').hidden = !cash;
    $('#description-field').hidden = cash;
    $('#donation-amount').disabled = !cash; $('#donation-amount').required = cash;
    $('#donation-description').disabled = cash; $('#donation-description').required = !cash;
    $('#donation-error').hidden = true;
  }

  function resetDonation() {
    $('#donation-form').reset();
    $('#donation-date').value = localDate();
    $('#donation-date').max = localDate();
    $('#donation-date').min = '2000-01-01';
    updateDonationType();
    updateOwnerHint();
  }

  function updateOwnerHint() {
    const donor = visibleDonors().find((item) => item.id === $('#donation-donor').value);
    $('#donation-owner-hint').textContent = isAdmin()
      ? (donor ? `Espacio de destino: ${ownerName(donor.ownerId)}. Quedará constancia de que tú lo registraste.` : 'Selecciona un donante para conocer el responsable de este aporte.')
      : 'El aporte quedará en tu espacio, pendiente de verificación por administración.';
  }

  function donationDetails(id) {
    const donation = authorizedDonation(id);
    if (!donation) return;
    openModal('Detalle del donativo', `<div class="detail-hero"><span class="quick-icon teal">${icon(donation.type === 'Efectivo' ? 'money' : 'box')}</span><div><strong>${escapeHTML(donation.id)}</strong><p>Un aporte que hace la diferencia</p></div></div><dl class="detail-list"><div><dt>Donante</dt><dd>${escapeHTML(donorName(donation))}</dd></div><div><dt>Tipo</dt><dd>${badge(donation.type)}</dd></div><div><dt>${donation.type === 'Efectivo' ? 'Cantidad (MXN)' : 'Descripción del donativo'}</dt><dd>${escapeHTML(donationValue(donation))}</dd></div><div><dt>Fecha</dt><dd>${formatDate(donation.date)}</dd></div><div><dt>Registrado por</dt><dd>${escapeHTML(donation.registeredBy)}</dd></div><div><dt>Estado</dt><dd>${badge(donation.status)}</dd></div><div class="full"><dt>Observaciones</dt><dd>${escapeHTML(donation.notes || 'Sin observaciones adicionales.')}</dd></div></dl><div class="form-actions"><button class="button secondary" data-close-modal>Cerrar</button></div>`);
    if (isAdmin()) {
      $('#modal-content .detail-list').insertAdjacentHTML('beforeend', `<div><dt>Responsable del espacio</dt><dd>${escapeHTML(ownerName(donation.ownerId))}</dd></div>`);
      if (donation.status === 'Registrado') $('#modal-content .form-actions').insertAdjacentHTML('beforeend', `<button type="button" class="button primary" data-action="verify-donation" data-id="${escapeHTML(id)}">${icon('check')} Verificar donativo</button>`);
    }
    if (donation.verifiedBy) $('#modal-content .detail-list').insertAdjacentHTML('beforeend', `<div><dt>Verificado por</dt><dd>${escapeHTML(donation.verifiedBy)} · ${formatDate(donation.verifiedAt)}</dd></div>`);
  }

  function verifyDonation(id) {
    if (!isAdmin()) return denyAccess();
    const donation = authorizedDonation(id);
    if (!donation || donation.status !== 'Registrado') return;
    donation.status = 'Verificado';
    donation.verifiedBy = currentUser.name;
    donation.verifiedById = currentUser.id;
    donation.verifiedAt = localDate();
    persist(); renderAll(); closeModal();
    toast('Donativo verificado. Su responsable verá el estado actualizado.');
  }

  function userForm(id = null) {
    if (!isAdmin()) return;
    const user = data.users.find((item) => item.id === id);
    const self = user?.id === currentUser.id;
    openModal(user ? 'Editar usuario' : 'Nuevo usuario', `<p class="modal-intro">${user ? 'Actualiza los datos y permisos de esta cuenta.' : 'Invita a una nueva persona a formar parte del equipo.'}</p><form id="user-form"><div class="form-grid"><div class="field full"><label for="user-name">Nombre *</label><input id="user-name" name="name" value="${escapeHTML(user?.name || '')}" maxlength="100" required></div><div class="field full"><label for="user-email">Correo electrónico *</label><input id="user-email" name="email" type="email" value="${escapeHTML(user?.email || '')}" maxlength="150" required></div><div class="field full"><label for="user-password">Contraseña ${user ? '<span class="optional">(dejar vacía para conservarla)</span>' : '*'}</label><input id="user-password" name="password" type="password" minlength="6" maxlength="100" autocomplete="new-password" placeholder="Mínimo 6 caracteres" ${user ? '' : 'required'}></div><div class="field full"><label for="user-role">Rol *</label><select id="user-role" name="role" ${self ? 'disabled' : ''}><option value="Usuario"${user?.role === 'Usuario' ? ' selected' : ''}>Usuario</option><option value="Administrador"${user?.role === 'Administrador' ? ' selected' : ''}>Administrador</option></select>${self ? '<p class="field-help modal-intro">Tu propio rol se conserva para mantener el acceso de administración.</p>' : ''}</div></div>${modalActions(user ? 'Guardar cambios' : 'Crear usuario')}</form>`);
    $('#user-form').addEventListener('submit', (event) => {
      event.preventDefault();
      if (!isAdmin()) return;
      const values = Object.fromEntries(new FormData(event.target));
      values.name = values.name.trim(); values.email = values.email.trim().toLowerCase();
      values.role = self ? user.role : values.role;
      if (!values.name || !validEmail(values.email)) return showError('#modal-error', 'Ingresa un nombre y un correo electrónico válido.');
      if ((!user || values.password) && values.password.trim().length < 6) return showError('#modal-error', 'La contraseña debe contener al menos 6 caracteres.');
      if (!['Administrador', 'Usuario'].includes(values.role)) return showError('#modal-error', 'Selecciona un rol válido.');
      if (data.users.some((item) => item.id !== id && item.email.toLowerCase() === values.email)) return showError('#modal-error', 'Ya existe una cuenta con este correo electrónico.');
      if (user) { if (!values.password) delete values.password; Object.assign(user, values); }
      else data.users.push({ ...values, id: makeId('u'), active: true, lastAccess: '' });
      persist(); saveSession(); renderAll(); closeModal(); toast(user ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente');
    });
  }

  function toggleUser(id) {
    if (!isAdmin()) return;
    const user = data.users.find((item) => item.id === id);
    if (!user) return;
    if (user.id === currentUser.id) return toast('No puedes desactivar tu propia cuenta mientras estás conectado.', true);
    user.active = !user.active;
    persist(); renderUsers(); toast(`Usuario ${user.active ? 'activado' : 'desactivado'} correctamente`);
  }

  $('#login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    refreshData();
    const email = $('#login-email').value.trim().toLowerCase();
    const password = $('#login-password').value;
    const user = data.users.find((item) => item.email.toLowerCase() === email && item.password === password);
    if (!user) return showError('#login-error', 'El correo o la contraseña son incorrectos. Revisa los accesos de demostración.');
    if (!user.active) return showError('#login-error', 'Esta cuenta está inactiva. Solicita su activación al administrador.');
    startSession(user);
  });

  $('#toggle-password').addEventListener('click', () => {
    const visible = $('#login-password').type === 'password';
    $('#login-password').type = visible ? 'text' : 'password';
    $('#toggle-password').setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
    $('#toggle-password').setAttribute('aria-pressed', String(visible));
  });

  $$('[data-demo]').forEach((button) => button.addEventListener('click', () => {
    $('#login-email').value = `${button.dataset.demo}@donativoseguro.com`;
    $('#login-password').value = '123456';
    $('#login-error').hidden = true;
    $('#demo-selection').textContent = 'Cuenta de ejemplo preparada. Presiona Iniciar sesión para entrar.';
    $('#demo-selection').hidden = false;
    $('#demo-access').open = false;
    $('.login-submit').focus();
  }));

  $('#access-help').addEventListener('click', () => {
    openModal('Tu acceso a DonativoSeguro', `<div class="access-explanation">${icon('shield')}<h3>Una cuenta, un espacio propio.</h3><p>El administrador de tu organización crea tu cuenta y te proporciona las credenciales. Él puede activar tu acceso o restablecer tu contraseña.</p><p>Si estás presentando este prototipo, despliega las cuentas de ejemplo en el inicio de sesión. No necesitas registrarte.</p></div><div class="form-actions"><button class="button primary" data-close-modal>Entendido</button></div>`);
  });
  $('#login-password').addEventListener('keyup', (event) => { $('#caps-lock-hint').hidden = !event.getModifierState('CapsLock'); });
  $('#login-form').addEventListener('input', () => { $('#login-error').hidden = true; });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-modal]')) closeModal();
    if (!event.target.closest('.notification-wrap')) setNotifications(false);
    const pageLink = event.target.closest('[data-page]');
    if (pageLink) { event.preventDefault(); navigate(pageLink.dataset.page); }
    const action = event.target.closest('[data-action]');
    if (!action || !currentUser) return;
    const id = action.dataset.id;
    switch (action.dataset.action) {
      case 'new-donor': if (currentPage !== 'registro') navigate('donantes'); donorForm(); break;
      case 'edit-donor': donorForm(id); break;
      case 'view-donor': donorDetails(id); break;
      case 'delete-donor': deleteDonor(id); break;
      case 'view-donation': donationDetails(id); break;
      case 'verify-donation': verifyDonation(id); break;
      case 'pending-donations': $('#filter-form').reset(); $('#status-filter').value = 'Registrado'; renderDonations(); navigate('donativos'); break;
      case 'new-user': userForm(); break;
      case 'edit-user': userForm(id); break;
      case 'toggle-user': toggleUser(id); break;
    }
  });

  $('#donation-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!currentUser) return;
    const values = Object.fromEntries(new FormData(event.target));
    const donor = visibleDonors().find((item) => item.id === values.donor);
    const cash = values.type === 'Efectivo';
    const amount = cash ? Number(values.amount) : 0;
    const parsedDate = new Date(`${values.date}T12:00:00`);
    if (!donor) return showError('#donation-error', 'Selecciona un donante del directorio.');
    if (!['Efectivo', 'Especie'].includes(values.type)) return showError('#donation-error', 'Selecciona un tipo de donativo válido.');
    if (!values.date || !Number.isFinite(parsedDate.getTime()) || localDate(parsedDate) !== values.date || values.date > localDate() || values.date < '2000-01-01') return showError('#donation-error', 'Selecciona una fecha válida entre el año 2000 y hoy.');
    if (cash && (!Number.isFinite(amount) || amount <= 0 || amount > 999999999.99 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.001)) return showError('#donation-error', 'Ingresa un monto positivo con un máximo de dos decimales.');
    if (!cash && !values.description?.trim()) return showError('#donation-error', 'Describe el donativo en especie.');
    data.donations.unshift({ id: `DON-${String(data.nextDonation++).padStart(4, '0')}`, donorId: donor.id, donorName: donor.name, ownerId: donor.ownerId, createdById: currentUser.id, type: values.type, amount, description: cash ? '' : values.description.trim(), date: values.date, notes: values.notes.trim(), registeredBy: currentUser.name, status: 'Registrado' });
    persist(); resetDonation(); $('#filter-form').reset(); renderAll(); navigate('donativos'); toast('Donativo registrado correctamente');
  });

  $$('#donation-form input[name="type"]').forEach((radio) => radio.addEventListener('change', updateDonationType));
  $('#donation-donor').addEventListener('change', updateOwnerHint);
  $('#cancel-donation').addEventListener('click', () => { resetDonation(); navigate('dashboard'); });
  $('#donor-search').addEventListener('input', renderDonors);
  $('#filter-form').addEventListener('submit', (event) => event.preventDefault());
  $('#filter-form').addEventListener('input', renderDonations);
  $('#filter-form').addEventListener('change', renderDonations);
  $('#filter-form').addEventListener('reset', () => setTimeout(renderDonations, 0));
  $('#logout').addEventListener('click', logout);
  $('#menu-toggle').addEventListener('click', () => setSidebar(!$('#sidebar').classList.contains('open')));
  $('#sidebar-backdrop').addEventListener('click', () => { setSidebar(false); $('#menu-toggle').focus(); });
  $('#notification-toggle').addEventListener('click', () => setNotifications($('#notifications').hidden));
  $('#modal').addEventListener('click', (event) => { if (event.target === $('#modal')) { const bounds = $('#modal').getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeModal(); } });
  $('#modal').addEventListener('close', () => { if (modalTrigger?.isConnected && modalTrigger.getClientRects().length) modalTrigger.focus(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { setNotifications(false); if ($('#sidebar').classList.contains('open')) { setSidebar(false); $('#menu-toggle').focus(); } } });
  window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));
  window.addEventListener('resize', () => { if (window.innerWidth > 960) setSidebar(false); else $('#sidebar').inert = !$('#sidebar').classList.contains('open'); });

  function refreshData() {
    const latest = readStorage(STORAGE_KEY);
    if (latest?.schemaVersion === 2 && Array.isArray(latest.users) && Array.isArray(latest.donors) && Array.isArray(latest.donations)) data = latest;
  }

  // Los datos se comparten; la cuenta conectada pertenece solo a esta pestaña.
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    refreshData();
    if (!currentUser) return;
    const user = data.users.find((item) => item.id === currentUser.id);
    if (!user?.active) { logout(); toast('Administración desactivó esta cuenta.', true); return; }
    const roleChanged = user.role !== currentUser.role;
    currentUser = user;
    closeModal();
    renderAll();
    if (roleChanged) navigate('dashboard');
    toast('Los registros de tu espacio se actualizaron.');
  });

  $$('[data-year]').forEach((element) => { element.textContent = new Date().getFullYear(); });
  $('#today-label').textContent = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  resetDonation();
  setSidebar(false);
  let session = null;
  try {
    session = JSON.parse(sessionStorage.getItem(TAB_SESSION_KEY)) || readStorage(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch { storageWarning = true; }
  const savedUser = session?.sesionActiva && data.users.find((user) => user.id === session.usuario && user.active);
  if (savedUser) startSession(savedUser);
  if (storageWarning) toast('El almacenamiento local no está disponible o sus datos no se pudieron leer. Esta sesión usa datos temporales.', true);
})();
