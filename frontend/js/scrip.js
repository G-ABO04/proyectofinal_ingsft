  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const TOKEN_KEY = 'donativoSeguro.accessToken';
  const pageTitles = { dashboard:'Resumen general', donantes:'Todos los donantes', registro:'Registrar donativo', donativos:'Todos los donativos', usuarios:'Usuarios' };
  const donorPages = { inicio:'Inicio', aportar:'Hacer un donativo', donativos:'Mis donativos', impacto:'Mi impacto', perfil:'Mi perfil' };
  const money = new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN', maximumFractionDigits:2 });
  const dateFormat = new Intl.DateTimeFormat('es-MX', { day:'2-digit', month:'short', year:'numeric' });
  let data = { donors:[], donations:[], users:[] };
  let currentUser = null;
  let currentPage = 'dashboard';
  let donorPage = 'inicio';
  let modalTrigger = null;
  let accessToken = '';
  let refreshing = false;
  try { accessToken = sessionStorage.getItem(TOKEN_KEY) || ''; } catch {}
  const isAdmin = () => currentUser?.role === 'Administrador';
  const visibleDonors = () => isAdmin() ? data.donors : [];
  const visibleDonations = () => currentUser ? data.donations : [];
  const ownerName = (id) => data.users.find(user => user.id === id)?.name || 'Sin asignar';
  const donorName = (donation) => donation.donorName || '';
  const donationValue = (donation) => donation.type === 'Efectivo' ? money.format(donation.amount) : donation.description;
  const sortedDonations = () => [...visibleDonations()].sort((a,b) => b.date.localeCompare(a.date) || Number(b.id.slice(4))-Number(a.id.slice(4)));
  const denyAccess = () => toast('Esta acción no está disponible en tu cuenta.', true);
  const authorizedDonor = (id) => isAdmin() ? data.donors.find(item => item.id === id) : null;

  async function api(path, options = {}) {
    const requestToken = accessToken;
    const headers = { ...(options.body ? { 'Content-Type':'application/json' } : {}), ...(accessToken ? { Authorization:`Bearer ${accessToken}` } : {}) };
    let response;
    try { response = await fetch('/api' + path, { ...options, headers, body:options.body ? JSON.stringify(options.body) : undefined }); }
    catch { throw new Error('No hay conexión con el servidor. Tus cambios no se guardaron.'); }
    let body = {};
    if (response.status !== 204) {
      try { body = await response.json(); }
      catch { throw new Error('Abre la aplicación desde http://127.0.0.1:3000 después de iniciar el backend.'); }
    }
    if (!response.ok) {
      if (response.status === 401 && currentUser && requestToken === accessToken) endSession();
      const details = body.fields?.map(item => item.message).join(' ');
      throw new Error(details || body.error || 'No fue posible completar la operación.');
    }
    return body;
  }

  async function loadData() {
    const requestToken = accessToken;
    const { user } = await api('/auth/me');
    if (requestToken !== accessToken) return;
    const admin = user.role === 'Administrador';
    const [donations, donors, users] = await Promise.all([
      api('/donativos'), admin ? api('/donantes') : {donors:[]}, admin ? api('/usuarios') : {users:[]}
    ]);
    if (requestToken !== accessToken) return;
    currentUser = user;
    data = {donors:donors.donors, users:users.users, donations:donations.donations};
    renderAll();
  }

  function renderAll() {
    $('#app').hidden = !isAdmin();
    $('#donor-portal').hidden = !currentUser || isAdmin();
    if (!currentUser) return;
    if (isAdmin()) {
      renderAccount(); renderDashboard(); renderDonors(); renderDonations(); renderUsers();
    } else {
      for (const selector of ['#users-body','#donors-body','#donations-body','#recent-body','#dashboard-stats','#user-stats','#review-summary','#donation-donor']) $(selector).innerHTML = '';
      renderPortal();
    }
  }

  async function startSession(result) {
    accessToken = result.accessToken;
    try { sessionStorage.setItem(TOKEN_KEY, accessToken); } catch {}
    currentUser = result.user;
    $('#login-screen').hidden = true;
    $('#login-form').reset();
    $('#login-password').type = 'password';
    $('#toggle-password').setAttribute('aria-label','Mostrar contraseña');
    $('#toggle-password').setAttribute('aria-pressed','false');
    $('#login-error').hidden = true;
    $('#caps-lock-hint').hidden = true;
    $('#donor-search').value = '';
    $('#filter-form').reset();
    $('#personal-filter-form').reset();
    resetDonation(); resetPersonalDonation();
    await loadData();
    navigate(location.hash.slice(1) || (isAdmin() ? 'dashboard' : 'inicio'));
  }

  function endSession() {
    closeModal(); $('#toast-container').replaceChildren();
    currentUser = null; accessToken = '';
    try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
    data = { donors:[], donations:[], users:[] };
    $('#app').hidden = true; $('#donor-portal').hidden = true; $('#login-screen').hidden = false;
    for (const selector of ['#users-body','#donors-body','#donations-body','#recent-body','#dashboard-stats','#user-stats','#review-summary','#donation-donor','#modal-content','#donor-history-list','#donor-recent-list','#donor-latest-content','#donor-home-impact','#donor-impact-numbers']) $(selector).innerHTML = '';
    $('#personal-profile-form').reset(); $('#personal-filter-form').reset();
    resetPersonalDonation(); resetDonation();
    setDonorMenu(false); setDonorAccount(false); setSidebar(false); setNotifications(false);
    history.replaceState(null,'',location.pathname + location.search);
    document.title = 'DonativoSeguro | Iniciar sesión';
  }

  async function logout() {
    try { await api('/auth/logout',{method:'POST'}); endSession(); toast('Sesión cerrada correctamente'); }
    catch (error) { toast(error.message,true); }
  }

  async function submitWork(form, errorSelector, work) {
    const button = form.querySelector('button[type="submit"]');
    if (button?.disabled) return;
    if (button) button.disabled = true;
    if (errorSelector) $(errorSelector).hidden = true;
    try { await work(); }
    catch (error) { if (errorSelector && $(errorSelector)) showError(errorSelector,error.message); else toast(error.message,true); }
    finally { if (button?.isConnected) button.disabled = false; }
  }
  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function icon(name) {
    return `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  }

  function localDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

  function navigate(page, updateHash = true) {
    if (!currentUser) return;
    if (!isAdmin()) return navigateDonor(page);
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

  function toast(message, error = false) {
    const element = document.createElement('div');
    element.className = `toast${error ? ' error' : ''}`;
    element.innerHTML = `${icon(error ? 'close' : 'check')}<span>${escapeHTML(message)}</span><button class="icon-button" aria-label="Cerrar notificación">${icon('close')}</button>`;
    element.querySelector('button').addEventListener('click', () => element.remove());
    $('#toast-container').append(element);
    while ($('#toast-container').children.length > 3) $('#toast-container').firstElementChild.remove();
    setTimeout(() => element.remove(), 5500);
  }

  function openModal(title, content) {
    modalTrigger = document.activeElement;
    $('#modal').classList.toggle('donor-modal', !!currentUser && !isAdmin());
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


  function donorForm(id = null) {
    if (!isAdmin()) return denyAccess();
    const donor = id ? authorizedDonor(id) : null;
    if (id && !donor) return;
    openModal(donor ? 'Editar donante' : 'Nuevo donante', `<p class="modal-intro">Cada persona es parte del cambio. Completa los campos obligatorios.</p><form method="post" id="donor-form"><div class="form-grid"><div class="field full"><label for="donor-name">Nombre completo *</label><input id="donor-name" name="name" value="${escapeHTML(donor?.name || '')}" maxlength="100" autocomplete="name" required></div><div class="field full"><label for="donor-email">Correo electrónico *</label><input id="donor-email" name="email" type="email" value="${escapeHTML(donor?.email || '')}" maxlength="150" autocomplete="email" required></div><div class="field"><label for="donor-phone">Teléfono *</label><input id="donor-phone" name="phone" type="tel" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" title="Ingresa de 1 a 10 dígitos, sin espacios ni símbolos." value="${escapeHTML(donor?.phone || '')}" autocomplete="tel" required></div><div class="field"><label for="donor-person">Tipo de persona *</label><select id="donor-person" name="person" required><option${donor?.person === 'Persona física' ? ' selected' : ''}>Persona física</option><option${donor?.person === 'Persona moral' ? ' selected' : ''}>Persona moral</option></select></div></div>${modalActions(donor ? 'Guardar cambios' : 'Guardar donante')}</form>`);
    if (isAdmin()) {
      const ownerId = donor ? donor.ownerId : currentUser.id;
      $('#donor-form .form-grid').insertAdjacentHTML('beforeend', `<div class="field full"><label for="donor-owner">Responsable del donante</label><select id="donor-owner" name="ownerId"><option value="">Sin asignar · solo administración</option>${data.users.map((user) => `<option value="${escapeHTML(user.id)}"${user.id === ownerId ? ' selected' : ''}>${escapeHTML(user.name)}${user.active ? '' : ' (inactivo)'}</option>`).join('')}</select><p class="field-hint">El responsable verá este donante en su cuenta. Si lo cambias, todos sus donativos asociados se trasladarán al nuevo espacio.</p></div>`);
    }
    $('#donor-form').addEventListener('submit', (event) => {
      event.preventDefault();
      submitWork(event.target, '#modal-error', async () => {
        const values = Object.fromEntries(new FormData(event.target));
        values.ownerId ||= null;
        await api('/donantes' + (id ? '/' + encodeURIComponent(id) : ''), { method:id ? 'PUT':'POST', body:values });
        await loadData(); closeModal(); toast(id ? 'Donante actualizado correctamente':'Donante registrado correctamente');
      });
    });
  }

  function donorDetails(id) {
    const donor = authorizedDonor(id);
    if (!donor) return;
    const count = visibleDonations().filter((item) => item.donorId === id).length;
    openModal('Información del donante', `<div class="detail-hero"><span class="avatar">${escapeHTML(initials(donor.name))}</span><div><strong>${escapeHTML(donor.name)}</strong><p>${escapeHTML(donor.person)}</p></div></div><dl class="detail-list"><div><dt>Correo electrónico</dt><dd>${escapeHTML(donor.email)}</dd></div><div><dt>Teléfono</dt><dd>${escapeHTML(donor.phone)}</dd></div><div><dt>Fecha de registro</dt><dd>${formatDate(donor.date)}</dd></div><div><dt>Estado</dt><dd>${badge('Activo')}</dd></div><div class="full"><dt>Donativos asociados</dt><dd>${count} aportes registrados</dd></div></dl><div class="form-actions"><button class="button secondary" data-close-modal>Cerrar</button></div>`);
  }

  function userForm(id = null) {
    if (!isAdmin()) return;
    const user = data.users.find((item) => item.id === id);
    const self = user?.id === currentUser.id;
    openModal(user ? 'Editar usuario' : 'Nuevo usuario', `<p class="modal-intro">${user ? 'Actualiza los datos y permisos de esta cuenta.' : 'Invita a una nueva persona a formar parte del equipo.'}</p><form method="post" id="user-form"><div class="form-grid"><div class="field full"><label for="user-name">Nombre *</label><input id="user-name" name="name" value="${escapeHTML(user?.name || '')}" maxlength="100" required></div><div class="field full"><label for="user-email">Correo electrónico *</label><input id="user-email" name="email" type="email" value="${escapeHTML(user?.email || '')}" maxlength="150" required></div><div class="field full"><label for="user-password">Contraseña ${user ? '<span class="optional">(dejar vacía para conservarla)</span>' : '*'}</label><input id="user-password" name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" placeholder="Mínimo 12 caracteres" ${user ? '' : 'required'}></div><div class="field full"><label for="user-role">Rol *</label><select id="user-role" name="role" ${self ? 'disabled' : ''}><option value="Usuario"${user?.role === 'Usuario' ? ' selected' : ''}>Usuario</option><option value="Administrador"${user?.role === 'Administrador' ? ' selected' : ''}>Administrador</option></select>${self ? '<p class="field-help modal-intro">Tu propio rol se conserva para mantener el acceso de administración.</p>' : ''}</div></div>${modalActions(user ? 'Guardar cambios' : 'Crear usuario')}</form>`);
    $('#user-form').addEventListener('submit', (event) => {
      event.preventDefault();
      submitWork(event.target, '#modal-error', async () => {
        const values = Object.fromEntries(new FormData(event.target));
        if (self) values.role = user.role;
        if (id && !values.password) delete values.password;
        await api('/usuarios' + (id ? '/' + encodeURIComponent(id) : ''), { method:id ? 'PUT':'POST', body:values });
        await loadData(); closeModal(); toast(id ? 'Usuario actualizado correctamente':'Cuenta creada. Ya puede iniciar sesión.');
      });
    });
  }

  async function donationDetails(id) {
    const { donation } = await api('/donativos/' + encodeURIComponent(id));
    if (!isAdmin()) return personalDonationDetails(donation);
    if (!donation) return;
    openModal('Detalle del donativo', `<div class="detail-hero"><span class="quick-icon teal">${icon(donation.type === 'Efectivo' ? 'money' : 'box')}</span><div><strong>${escapeHTML(donation.id)}</strong><p>Un aporte que hace la diferencia</p></div></div><dl class="detail-list"><div><dt>Donante</dt><dd>${escapeHTML(donorName(donation))}</dd></div><div><dt>Tipo</dt><dd>${badge(donation.type)}</dd></div><div><dt>${donation.type === 'Efectivo' ? 'Cantidad (MXN)' : 'Descripción del donativo'}</dt><dd>${escapeHTML(donationValue(donation))}</dd></div><div><dt>Fecha</dt><dd>${formatDate(donation.date)}</dd></div><div><dt>Registrado por</dt><dd>${escapeHTML(donation.registeredBy)}</dd></div><div><dt>Estado</dt><dd>${badge(donation.status)}</dd></div><div class="full"><dt>Observaciones</dt><dd>${escapeHTML(donation.notes || 'Sin observaciones adicionales.')}</dd></div></dl><div class="form-actions"><button class="button secondary" data-close-modal>Cerrar</button></div>`);
    if (isAdmin()) {
      $('#modal-content .detail-list').insertAdjacentHTML('beforeend', `<div><dt>Responsable del espacio</dt><dd>${escapeHTML(ownerName(donation.ownerId))}</dd></div>`);
      if (donation.status === 'Registrado') $('#modal-content .form-actions').insertAdjacentHTML('beforeend', `<button type="button" class="button primary" data-action="verify-donation" data-id="${escapeHTML(id)}">${icon('check')} Verificar donativo</button>`);
    }
    if (donation.verifiedBy) $('#modal-content .detail-list').insertAdjacentHTML('beforeend', `<div><dt>Verificado por</dt><dd>${escapeHTML(donation.verifiedBy)} · ${formatDate(donation.verifiedAt)}</dd></div>`);
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


  // Portal personal y operaciones de la API.

  function setDonorMenu(open) {
    $('#donor-nav').classList.toggle('open', open);
    $('#donor-menu-toggle').setAttribute('aria-expanded', String(open));
  }
  function setDonorAccount(open) {
    $('#donor-account-menu').hidden = !open;
    $('#donor-account-toggle').setAttribute('aria-expanded', String(open));
  }
  function navigateDonor(page) {
    if (!currentUser) return;
    const requested = page.replace(/^\/?mi-espacio\//, '');
    donorPage = Object.hasOwn(donorPages, requested) ? requested : 'inicio';
    $$('.donor-page').forEach(section => { section.hidden = section.id !== 'donor-page-' + donorPage; });
    $$('#donor-nav [data-donor-page]').forEach(link => {
      link.classList.toggle('active', link.dataset.donorPage === donorPage);
      if (link.dataset.donorPage === donorPage) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
    history.replaceState(null,'','#/mi-espacio/' + donorPage);
    document.title = donorPages[donorPage] + ' | DonativoSeguro';
    setDonorMenu(false); setDonorAccount(false);
    $('#donor-main').focus({preventScroll:true}); window.scrollTo(0,0);
  }
  function personalEmpty(filtered = false) {
    return `<div class="donor-empty">${icon('heart')}<h3>${filtered ? 'No hay aportaciones con estos filtros' : 'Tu primera aportación comienza aquí'}</h3><p>${filtered ? 'Prueba otra fecha o tipo de donativo.' : 'Cuando registres un donativo, podrás seguir su avance en este espacio.'}</p>${filtered ? '' : '<button class="donor-button" data-donor-page="aportar">Hacer mi primer donativo</button>'}</div>`;
  }
  function personalHistory(items) {
    return items.map(d => `<article class="donor-history-item ${d.type === 'Especie' ? 'kind' : ''}"><span class="donor-soft-icon">${icon(d.type === 'Efectivo' ? 'money' : 'box')}</span><div class="donor-history-info"><h3>${d.type === 'Efectivo' ? 'Aportación en efectivo' : 'Aportación en especie'}</h3><p>${escapeHTML(d.id)} <span class="donor-mobile-date">· ${formatDate(d.date)}</span></p></div><strong class="donor-history-amount">${escapeHTML(donationValue(d))}</strong><span class="donor-history-date">${formatDate(d.date)}</span>${badge(d.status)}<button class="donor-link" data-action="view-donation" data-id="${escapeHTML(d.id)}" aria-label="Ver detalle de ${escapeHTML(d.id)}">Ver detalle ${icon('arrow')}</button></article>`).join('');
  }
  function renderPersonalHistory() {
    if (!currentUser || isAdmin()) return;
    const filters = Object.fromEntries(new FormData($('#personal-filter-form')));
    const items = sortedDonations().filter(d => (!filters.type || d.type === filters.type) && (!filters.date || d.date === filters.date));
    $('#donor-history-count').textContent = `${items.length} de ${data.donations.length} aportaciones`;
    $('#donor-history-list').innerHTML = items.length ? personalHistory(items) : personalEmpty(!!filters.type || !!filters.date);
  }
  function impactItem(label, value, symbol, note = '') {
    return `<div class="donor-impact-item"><span class="donor-soft-icon">${icon(symbol)}</span><div><span>${label}</span><strong>${escapeHTML(value)}</strong>${note ? `<p>${note}</p>` : ''}</div></div>`;
  }
  function personalProgress(count) {
    const goal = Math.max(5, Math.ceil((count + 1) / 5) * 5);
    return `<div class="donor-progress-label"><strong>Cada aporte suma</strong><span>${count} de ${goal}</span></div><progress class="donor-progress" value="${count}" max="${goal}" aria-label="Avance hacia ${goal} aportaciones">${count} de ${goal}</progress><p class="donor-progress-goal">Tu siguiente meta: ${goal} aportaciones.</p>`;
  }
  function renderPortal() {
    const donations = sortedDonations();
    const cash = donations.filter(d => d.type === 'Efectivo').reduce((sum,d) => sum + d.amount,0);
    const kinds = donations.filter(d => d.type === 'Especie').length;
    const verified = donations.filter(d => d.status === 'Verificado').length;
    $('#donor-greeting').textContent = `Hola, ${currentUser.name.split(' ')[0]}. Este es tu espacio.`;
    $('#donor-nav-name').textContent = currentUser.name.split(' ')[0];
    $('#donor-nav-avatar').textContent = initials(currentUser.name);
    const stats = impactItem('Total aportado en efectivo',money.format(cash),'money','MXN registrados') + impactItem('Aportaciones realizadas',String(donations.length),'heart') + impactItem('Donativos en especie',String(kinds),'box');
    $('#donor-home-impact').innerHTML = stats;
    $('#donor-impact-numbers').innerHTML = stats + impactItem('Aportaciones verificadas',String(verified),'check');
    $('#donor-history-summary').textContent = `${donations.length} aportaciones · ${money.format(cash)} MXN en efectivo · ${kinds} en especie`;
    $('#donor-home-progress').innerHTML = personalProgress(donations.length);
    $('#donor-journey-progress').innerHTML = personalProgress(donations.length);
    const latest = donations[0];
    $('#donor-latest-content').innerHTML = latest ? `<p class="donor-latest-type">${escapeHTML(latest.type)}</p><strong class="donor-latest-value ${latest.type === 'Especie' ? 'kind-value' : ''}">${escapeHTML(donationValue(latest))}</strong><dl class="donor-latest-facts"><div><dt>Fecha de aportación</dt><dd>${formatDate(latest.date)}</dd></div><div><dt>Estado</dt><dd>${badge(latest.status)}</dd></div></dl><div class="donor-latest-footer"><span>${escapeHTML(latest.id)}</span><button class="donor-link" data-action="view-donation" data-id="${escapeHTML(latest.id)}">Ver detalle ${icon('arrow')}</button></div>` : personalEmpty();
    $('#donor-recent-list').innerHTML = donations.length ? personalHistory(donations.slice(0,3)) : personalEmpty();
    $('#donor-journey-timeline').innerHTML = [[1,'Tu primer paso','Una primera oportunidad para ayudar.'],[3,'Una ayuda constante','Tres aportaciones que suman.'],[5,'Una huella que crece','Cinco gestos de generosidad.']].map(([n,title,description]) => `<li class="${donations.length >= n ? 'reached' : ''}"><span>${donations.length >= n ? icon('check') : n}</span><strong>${title}</strong><p>${description}</p></li>`).join('');
    $('#donor-profile-avatar').textContent = initials(currentUser.name);
    $('#donor-profile-name').textContent = currentUser.name;
    $('#donor-member-since').textContent = formatDate(currentUser.joinedAt);
    $('#personal-name').value = currentUser.name;
    $('#personal-email').value = currentUser.email;
    $('#personal-phone').value = currentUser.phone || '';
    renderPersonalHistory();
  }
  function updatePersonalType() {
    const cash = $('#personal-donation-form input[name="type"]:checked').value === 'Efectivo';
    $('#personal-amount-field').hidden = !cash; $('#personal-description-field').hidden = cash;
    $('#personal-amount').disabled = !cash; $('#personal-amount').required = cash;
    $('#personal-description').disabled = cash; $('#personal-description').required = !cash;
    $('#personal-donation-error').hidden = true;
  }
  function resetPersonalDonation() {
    $('#personal-donation-form').reset();
    $('#personal-date').value = localDate(); $('#personal-date').max = localDate(); $('#personal-date').min = '2000-01-01';
    $$('[data-amount]').forEach(button => button.setAttribute('aria-pressed','false'));
    updatePersonalType();
  }
  function personalDonationDetails(d) {
    const verified = d.status === 'Verificado';
    openModal('El recorrido de tu aportación', `<p class="donor-receipt-label">${escapeHTML(d.id)} · ${escapeHTML(d.type)}</p><strong class="donor-receipt-value">${escapeHTML(donationValue(d))}</strong><dl class="donor-receipt-facts"><div><dt>Fecha de aportación</dt><dd>${formatDate(d.date)}</dd></div><div><dt>Estado actual</dt><dd>${badge(d.status)}</dd></div><div class="full"><dt>Tus observaciones</dt><dd>${escapeHTML(d.notes || 'Sin observaciones.')}</dd></div></dl><div class="donor-status-path"><h3>Así va tu ayuda</h3><ol><li class="done"><span>${icon('check')}</span><div><strong>Registrado</strong><p>Guardamos tu aportación.</p></div></li><li class="${verified ? 'done' : ''}"><span>${verified ? icon('check') : '2'}</span><div><strong>Revisión de recepción</strong><p>${verified ? 'Administración confirmó la aportación.' : 'Pendiente de confirmación por administración.'}</p></div></li><li class="${verified ? 'done' : ''}"><span>${verified ? icon('check') : '3'}</span><div><strong>Verificado</strong><p>${verified ? formatDate(d.verifiedAt) : 'Te mostraremos aquí cuando esté verificado.'}</p></div></li></ol></div><button type="button" class="donor-button" data-close-modal>Entendido</button>`);
  }
  function donationSuccess(d) {
    openModal('Gracias por tu aportación', `<div class="donor-success"><span class="donor-success-mark">${icon('heart')}</span><h3>Tu ayuda ya tiene un lugar.</h3><p>Guardamos tu donativo. Administración revisará la información y podrás seguir su avance desde tu espacio.</p><span class="donor-success-folio">${escapeHTML(d.id)}</span><button class="donor-button" data-donor-page="donativos" data-close-modal>Ver mis donativos ${icon('arrow')}</button><button class="donor-link" data-donor-page="inicio" data-close-modal>Volver al inicio</button></div>`);
  }
  function deleteDonor(id) {
    const donor = authorizedDonor(id);
    if (!donor) return;
    openModal('Eliminar del directorio', `<form method="post" id="delete-donor-form"><p class="modal-intro">¿Quieres retirar a <strong>${escapeHTML(donor.name)}</strong> del directorio? Su historial de donativos se conservará.</p>${modalActions('Eliminar donante',true)}</form>`);
    $('#delete-donor-form').addEventListener('submit', event => {
      event.preventDefault(); submitWork(event.target,'#modal-error',async () => {
        await api('/donantes/' + encodeURIComponent(id),{method:'DELETE'});
        await loadData(); closeModal(); toast('Donante retirado del directorio');
      });
    });
  }
  async function verifyDonation(id) {
    if (!isAdmin()) return denyAccess();
    await api('/donativos/' + encodeURIComponent(id) + '/verificar',{method:'PATCH'});
    await loadData(); closeModal(); toast('Donativo verificado correctamente.');
  }
  async function toggleUser(id) {
    if (!isAdmin()) return;
    const user = data.users.find(item => item.id === id);
    if (!user) return;
    await api('/usuarios/' + encodeURIComponent(id) + '/estado',{method:'PATCH',body:{active:!user.active}});
    await loadData(); toast(`Cuenta ${user.active ? 'desactivada' : 'activada'} correctamente.`);
  }

  $('#login-form').addEventListener('submit', event => {
    event.preventDefault(); submitWork(event.target,'#login-error',async () => {
      const result = await api('/auth/login',{method:'POST',body:Object.fromEntries(new FormData(event.target))});
      try { await startSession(result); } catch (error) { endSession(); throw error; }
    });
  });
  $('#setup-form').addEventListener('submit', event => {
    event.preventDefault(); submitWork(event.target,'#setup-error',async () => {
      const values = Object.fromEntries(new FormData(event.target));
      await api('/auth/setup',{method:'POST',body:values});
      event.target.reset(); event.target.hidden = true; $('#login-form').hidden = false;
      $('.login-scope').hidden = false; $('.login-panel h2').textContent = 'Tu ayuda empieza aqu?.'; $('.login-subtitle').textContent = 'Inicia sesi?n y contin?a construyendo un impacto positivo.';
      $('#login-email').value = values.email; $('#login-password').focus();
      toast('Administrador creado. Inicia sesión con tu nueva cuenta.');
    });
  });
  $('#toggle-password').addEventListener('click', () => {
    const visible = $('#login-password').type === 'password';
    $('#login-password').type = visible ? 'text' : 'password';
    $('#toggle-password').setAttribute('aria-label',visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
    $('#toggle-password').setAttribute('aria-pressed',String(visible));
  });
  $('#login-password').addEventListener('keyup', event => { $('#caps-lock-hint').hidden = !event.getModifierState('CapsLock'); });
  $('#login-form').addEventListener('input', () => { $('#login-error').hidden = true; });
  $('#access-help').addEventListener('click', () => openModal('Tu acceso a DonativoSeguro', `<div class="access-explanation">${icon('shield')}<h3>Una cuenta, un espacio propio.</h3><p>El administrador de tu organización crea tu cuenta y te proporciona tus credenciales de forma privada.</p><p>Para activar tu acceso o restablecer tu contraseña, contacta a administración.</p></div><div class="form-actions"><button class="button primary" data-close-modal>Entendido</button></div>`));

  const actions = {
    'new-donor': () => { if (currentPage !== 'registro') { navigate('donantes'); } donorForm(); },
    'edit-donor': donorForm, 'view-donor': donorDetails, 'delete-donor': deleteDonor,
    'view-donation': donationDetails, 'verify-donation': verifyDonation,
    'pending-donations': () => { $('#filter-form').reset(); $('#status-filter').value = 'Registrado'; renderDonations(); navigate('donativos'); },
    'new-user': () => userForm(), 'edit-user': userForm, 'toggle-user': toggleUser
  };
  document.addEventListener('click', async event => {
    if (event.target.closest('[data-close-modal]')) closeModal();
    if (!event.target.closest('.notification-wrap')) setNotifications(false);
    if (!event.target.closest('.donor-account')) setDonorAccount(false);
    const pageLink = event.target.closest('[data-page]');
    if (pageLink && currentUser) { event.preventDefault(); navigate(pageLink.dataset.page); }
    const donorLink = event.target.closest('[data-donor-page]');
    if (donorLink && currentUser && !isAdmin()) { event.preventDefault(); navigateDonor(donorLink.dataset.donorPage); }
    const amountButton = event.target.closest('[data-amount]');
    if (amountButton) {
      $('#personal-amount').value = amountButton.dataset.amount;
      $$('[data-amount]').forEach(button => button.setAttribute('aria-pressed',String(button === amountButton)));
    }
    const action = event.target.closest('[data-action]');
    if (!action || !currentUser || action.disabled) return;
    if (!isAdmin() && action.dataset.action !== 'view-donation') return denyAccess();
    action.disabled = true;
    try { await actions[action.dataset.action]?.(action.dataset.id); }
    catch (error) { toast(error.message,true); }
    finally { if (action.isConnected) action.disabled = false; }
  });
  function donationInput(form, personal) {
    const values = Object.fromEntries(new FormData(form));
    delete values.confirm;
    if (!personal) { values.donorId = values.donor; delete values.donor; }
    if (values.type === 'Efectivo') values.amount = Number(values.amount);
    return values;
  }
  $('#donation-form').addEventListener('submit', event => {
    event.preventDefault(); if (!isAdmin()) return;
    submitWork(event.target,'#donation-error',async () => {
      await api('/donativos',{method:'POST',body:donationInput(event.target,false)});
      resetDonation(); $('#filter-form').reset(); await loadData(); navigate('donativos'); toast('Donativo registrado correctamente.');
    });
  });
  $('#personal-donation-form').addEventListener('submit', event => {
    event.preventDefault(); if (!currentUser || isAdmin()) return;
    submitWork(event.target,'#personal-donation-error',async () => {
      const { donation } = await api('/donativos',{method:'POST',body:donationInput(event.target,true)});
      resetPersonalDonation(); $('#personal-filter-form').reset(); await loadData(); navigateDonor('donativos'); donationSuccess(donation);
    });
  });
  $('#personal-profile-form').addEventListener('submit', event => {
    event.preventDefault(); if (!currentUser || isAdmin()) return;
    submitWork(event.target,'#personal-profile-error',async () => {
      await api('/auth/profile',{method:'PUT',body:Object.fromEntries(new FormData(event.target))});
      await loadData(); toast('Tu perfil se actualizó correctamente.');
    });
  });
  $$('#donation-form input[name="type"]').forEach(radio => radio.addEventListener('change',updateDonationType));
  $$('#personal-donation-form input[name="type"]').forEach(radio => radio.addEventListener('change',updatePersonalType));
  $('#personal-amount').addEventListener('input', () => $$('[data-amount]').forEach(button => button.setAttribute('aria-pressed',String(Number(button.dataset.amount) === Number($('#personal-amount').value)))));
  $('#donation-donor').addEventListener('change',updateOwnerHint);
  $('#cancel-donation').addEventListener('click', () => { resetDonation(); navigate('dashboard'); });
  $('#donor-search').addEventListener('input',renderDonors);
  for (const [selector,render] of [['#filter-form',renderDonations],['#personal-filter-form',renderPersonalHistory]]) {
    $(selector).addEventListener('submit', event => event.preventDefault());
    $(selector).addEventListener('input',render); $(selector).addEventListener('change',render);
    $(selector).addEventListener('reset', () => setTimeout(render,0));
  }
  $('#logout').addEventListener('click',logout); $('#donor-logout').addEventListener('click',logout);
  $('#menu-toggle').addEventListener('click', () => setSidebar(!$('#sidebar').classList.contains('open')));
  $('#sidebar-backdrop').addEventListener('click', () => { setSidebar(false); $('#menu-toggle').focus(); });
  $('#notification-toggle').addEventListener('click', () => setNotifications($('#notifications').hidden));
  $('#donor-menu-toggle').addEventListener('click', () => setDonorMenu(!$('#donor-nav').classList.contains('open')));
  $('#donor-account-toggle').addEventListener('click', () => setDonorAccount($('#donor-account-menu').hidden));
  $('#modal').addEventListener('click', event => {
    if (event.target !== $('#modal')) return;
    const bounds = $('#modal').getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeModal();
  });
  $('#modal').addEventListener('close', () => { if (modalTrigger?.isConnected && modalTrigger.getClientRects().length) modalTrigger.focus(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { setNotifications(false); setSidebar(false); setDonorMenu(false); setDonorAccount(false); }
  });
  window.addEventListener('hashchange', () => { if (currentUser) navigate(location.hash.slice(1)); });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 960) { setSidebar(false); setDonorMenu(false); }
    else $('#sidebar').inert = !$('#sidebar').classList.contains('open');
  });
  // Al volver a la pestaña se comprueban la sesión, el rol y las verificaciones.
  window.addEventListener('focus', async () => {
    if (!currentUser || refreshing || $('#modal').open || ['registro','aportar','perfil'].includes(isAdmin() ? currentPage : donorPage)) return;
    refreshing = true;
    try { await loadData(); } catch (error) { toast(error.message,true); }
    finally { refreshing = false; }
  });
  async function initialize() {
    $$('[data-year]').forEach(element => { element.textContent = new Date().getFullYear(); });
    $('#today-label').textContent = new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'long',year:'numeric'}).format(new Date());
    resetDonation(); resetPersonalDonation(); setSidebar(false);
    try {
      const { setupRequired } = await api('/auth/status');
      $('#setup-form').hidden = !setupRequired; $('#login-form').hidden = setupRequired;
      $('.login-scope').hidden = setupRequired;
      if (setupRequired) { $('.login-panel h2').textContent = 'Bienvenido a DonativoSeguro'; $('.login-subtitle').textContent = 'Prepara el acceso de tu organizaci?n para comenzar.'; }
      if (accessToken && !setupRequired) {
        try { await startSession({accessToken,user:null}); }
        catch (error) { endSession(); toast(error.message,true); }
      }
    } catch (error) {
      $('#connection-notice').textContent = error.message; $('#connection-notice').hidden = false;
      $('#login-form button[type="submit"]').disabled = true;
    }
  }
  initialize();
