// ==========================================================================
// STATE MANAGEMENT & VARIABLES
// ==========================================================================
let currentStep = 0;
const totalSteps = 7;
let formData = {
  name: '',
  company_name: '',
  mobile_number: '',
  email: '',
  profile_type: '',
  industry: '',
  preferred_followup: ''
};

// Admin state
let currentAdminTab = 'analytics';
let leadsList = [];
let sortColumn = 'created_at';
let sortOrder = 'DESC';
let activeCharts = {};
let sseSource = null;

// ==========================================================================
// SPA ROUTER
// ==========================================================================
function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function handleRoute() {
  const hash = window.location.hash;
  const profilerView = document.getElementById('profilerView'); // Wait, check HTML IDs
  const profilerSec = document.getElementById('profiler-view');
  const adminSec = document.getElementById('admin-view');

  if (hash.startsWith('#/admin')) {
    profilerSec.classList.add('hidden');
    adminSec.classList.add('active');
    adminSec.classList.remove('hidden');
    initAdminPanel();
  } else {
    adminSec.classList.add('hidden');
    profilerSec.classList.add('active');
    profilerSec.classList.remove('hidden');
    initProfiler();
    
    // Close SSE if we leave admin panel
    if (sseSource) {
      sseSource.close();
      sseSource = null;
      console.log('Admin SSE stream disconnected.');
    }
  }
}

// ==========================================================================
// PROFILER / QUESTIONNAIRE CONTROLLER
// ==========================================================================
function initProfiler() {
  // Load draft if any
  const savedDraft = localStorage.getItem('bb_profiler_draft');
  if (savedDraft) {
    try {
      const draft = JSON.parse(savedDraft);
      formData = { ...formData, ...draft };
      populateFormInputs();
      
      // Auto resume at the furthest step completed
      determineFurthestStep();
    } catch (e) {
      console.warn('Could not parse saved draft.', e);
    }
  } else {
    resetProfilerState();
  }
  
  updateStepVisibility();
}

function resetProfilerState() {
  currentStep = 0;
  formData = {
    name: '',
    company_name: '',
    mobile_number: '',
    email: '',
    profile_type: '',
    industry: '',
    preferred_followup: ''
  };
  populateFormInputs();
  localStorage.removeItem('bb_profiler_draft');
}

function populateFormInputs() {
  document.getElementById('input-name').value = formData.name || '';
  document.getElementById('input-company').value = formData.company_name || '';
  document.getElementById('input-mobile').value = formData.mobile_number || '';
  document.getElementById('input-email').value = formData.email || '';
  
  // Highlight selection cards
  highlightCards('step-5', formData.profile_type);
  highlightCards('step-6', formData.industry);
  highlightCards('step-7', formData.preferred_followup);
}

function determineFurthestStep() {
  if (!formData.name || formData.name.trim().length < 3) currentStep = 1;
  else if (!formData.company_name || formData.company_name.trim().length === 0) currentStep = 2;
  else if (!formData.mobile_number || !/^[6-9]\d{9}$/.test(formData.mobile_number.trim())) currentStep = 3;
  else if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) currentStep = 4;
  else if (!formData.profile_type) currentStep = 5;
  else if (!formData.industry) currentStep = 6;
  else if (!formData.preferred_followup) currentStep = 7;
  else currentStep = 0; // Standard welcomes
}

function saveDraft() {
  localStorage.setItem('bb_profiler_draft', JSON.stringify(formData));
}

function updateStepVisibility() {
  // Hide all steps
  for (let i = 0; i <= 8; i++) {
    const el = document.getElementById(`step-${i}`);
    if (el) el.classList.add('hidden');
  }

  // Show current step
  const activeEl = document.getElementById(`step-${currentStep}`);
  if (activeEl) {
    activeEl.classList.remove('hidden');
    activeEl.classList.add('active');
  }

  // Handle Progress Bar Visibility
  const progressWrapper = document.getElementById('progress-wrapper');
  if (currentStep > 0 && currentStep <= totalSteps) {
    progressWrapper.classList.remove('hidden');
    const pct = Math.round((currentStep / totalSteps) * 100);
    document.getElementById('progress-step-text').textContent = `Step ${currentStep} of ${totalSteps}`;
    document.getElementById('progress-pct-text').textContent = `${pct}%`;
    document.getElementById('progress-bar-fill').style.width = `${pct}%`;
  } else {
    progressWrapper.classList.add('hidden');
  }

  // Show/Hide Back buttons appropriately
  const backButtons = document.querySelectorAll('.btn-back');
  backButtons.forEach(btn => {
    if (currentStep === 1) {
      btn.classList.add('hidden');
    } else {
      btn.classList.remove('hidden');
    }
  });
}

function highlightCards(stepId, value) {
  const cards = document.querySelectorAll(`#${stepId} .select-card`);
  // For multi-select steps (5 and 7), value is comma-separated
  if (stepId === 'step-5' || stepId === 'step-7') {
    const selectedValues = value ? value.split(',').map(v => v.trim()) : [];
    cards.forEach(card => {
      if (selectedValues.includes(card.getAttribute('data-value'))) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  } else {
    cards.forEach(card => {
      if (card.getAttribute('data-value') === value) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }
}

// Validation function for each step
function validateStep(step) {
  hideAllErrors();
  
  if (step === 1) {
    const name = document.getElementById('input-name').value.trim();
    if (name.length < 3) {
      showError('error-name');
      return false;
    }
    formData.name = name;
  }
  
  if (step === 2) {
    const company = document.getElementById('input-company').value.trim();
    if (company.length === 0) {
      showError('error-company');
      return false;
    }
    formData.company_name = company;
  }

  if (step === 3) {
    const mobile = document.getElementById('input-mobile').value.trim();
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile)) {
      showError('error-mobile');
      return false;
    }
    formData.mobile_number = mobile;
  }

  if (step === 4) {
    const email = document.getElementById('input-email').value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showError('error-email');
      return false;
    }
    formData.email = email;
  }

  if (step === 5) {
    if (!formData.profile_type) {
      showError('error-profile');
      return false;
    }
  }

  if (step === 6) {
    if (!formData.industry) {
      showError('error-industry');
      return false;
    }
  }

  if (step === 7) {
    if (!formData.preferred_followup) {
      showError('error-followup');
      return false;
    }
  }

  saveDraft();
  return true;
}

function showError(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'block';
}

function hideAllErrors() {
  const errors = document.querySelectorAll('.error-message');
  errors.forEach(e => e.style.display = 'none');
}

// Handlers for profiler navigation
function nextStep() {
  if (validateStep(currentStep)) {
    currentStep++;
    updateStepVisibility();
  }
}

function prevStep() {
  if (currentStep > 0) {
    currentStep--;
    updateStepVisibility();
  }
}

async function submitProfile() {
  if (!validateStep(7)) return;

  const btnSubmit = document.getElementById('btn-submit-profile');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting...`;

  try {
    const response = await fetch('/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    const result = await response.json();

    if (response.status === 201) {
      // Success! Clear draft
      localStorage.removeItem('bb_profiler_draft');
      
      // Populate Thank you details
      document.getElementById('summary-name').textContent = formData.name;
      document.getElementById('summary-company').textContent = formData.company_name;
      document.getElementById('summary-role').textContent = formData.profile_type;
      document.getElementById('summary-interest').textContent = formData.industry;
      
      currentStep = 8;
      updateStepVisibility();
      
      // Canvas Confetti Celebration
      triggerCelebration();
    } else if (response.status === 409) {
      // Duplicate entry UX back-routing
      if (result.error === 'duplicate_mobile') {
        currentStep = 3;
        updateStepVisibility();
        showError('error-mobile');
        document.getElementById('error-mobile').textContent = 'This mobile number is already registered.';
      } else if (result.error === 'duplicate_email') {
        currentStep = 4;
        updateStepVisibility();
        showError('error-email');
        document.getElementById('error-email').textContent = 'This email address is already registered.';
      }
    } else {
      alert(result.error || 'Submission failed. Please check your network and inputs.');
    }
  } catch (err) {
    console.error('Submission error:', err);
    alert('Network error. Make sure the local server is running.');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `Submit Profile <i class="fa-solid fa-circle-check"></i>`;
  }
}

function triggerCelebration() {
  // Fire multiple confetti bursts
  const duration = 3 * 1000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#FF7A00', '#00D2FF', '#FFFFFF']
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#FF7A00', '#00D2FF', '#FFFFFF']
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
}

// Setup Event Listeners for Profiler UI
function setupProfilerListeners() {
  document.getElementById('btn-start').addEventListener('click', () => {
    currentStep = 1;
    updateStepVisibility();
  });

  // Global hooks for next/back buttons inside steps
  document.querySelectorAll('.btn-next').forEach(btn => {
    btn.addEventListener('click', nextStep);
  });

  document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', prevStep);
  });

  document.getElementById('btn-submit-profile').addEventListener('click', submitProfile);

  document.getElementById('btn-restart').addEventListener('click', () => {
    resetProfilerState();
    currentStep = 1;
    updateStepVisibility();
  });

  // Card click selections
  document.querySelectorAll('.select-card').forEach(card => {
    card.addEventListener('click', function() {
      const stepCard = this.closest('.step-card');
      const stepId = stepCard.id;
      const val = this.getAttribute('data-value');

      if (stepId === 'step-5') {
        // Multi-select toggle for profile_type
        let selected = formData.profile_type ? formData.profile_type.split(',').map(v => v.trim()).filter(Boolean) : [];
        if (selected.includes(val)) {
          selected = selected.filter(v => v !== val);
        } else {
          selected.push(val);
        }
        formData.profile_type = selected.join(', ');
        highlightCards('step-5', formData.profile_type);
      } else if (stepId === 'step-6') {
        formData.industry = val;
        highlightCards('step-6', val);
      } else if (stepId === 'step-7') {
        // Multi-select toggle for preferred_followup
        let selected = formData.preferred_followup ? formData.preferred_followup.split(',').map(v => v.trim()).filter(Boolean) : [];
        if (selected.includes(val)) {
          selected = selected.filter(v => v !== val);
        } else {
          selected.push(val);
        }
        formData.preferred_followup = selected.join(', ');
        highlightCards('step-7', formData.preferred_followup);
      }

      saveDraft();
      
      // Auto advance only for single-select step (industry)
      setTimeout(() => {
        if (stepId === 'step-6') {
          currentStep = 7;
          updateStepVisibility();
        }
      }, 250);
    });
  });

  // Input Enter triggers next
  const textInputs = ['input-name', 'input-company', 'input-mobile', 'input-email'];
  textInputs.forEach(id => {
    document.getElementById(id).addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        nextStep();
      }
    });
  });
}

// ==========================================================================
// ADMIN DASHBOARD & ANALYTICS CONTROLLER
// ==========================================================================
function initAdminPanel() {
  // Connect to SSE for real-time notifications
  if (!sseSource) {
    sseSource = new EventSource('/api/notifications/stream');
    
    sseSource.onmessage = function(event) {
      const data = JSON.parse(event.data);
      console.log('SSE message received:', data);
      if (data.type === 'NEW_LEAD') {
        showLiveToast(data.lead);
        // Refresh active dashboard view
        refreshCurrentTab();
      }
    };

    sseSource.onerror = function(err) {
      console.warn('SSE notification stream disconnected. Reconnecting...');
    };
  }

  // Render initial active tab
  refreshCurrentTab();
}

function refreshCurrentTab() {
  if (currentAdminTab === 'analytics') {
    fetchDashboardKPIs();
    fetchAnalyticsCharts();
  } else if (currentAdminTab === 'leads') {
    fetchLeadsDirectory();
  } else if (currentAdminTab === 'closure') {
    fetchEventClosureReport();
  }
}

// SSE Toast notification popup
function showLiveToast(lead) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  toast.innerHTML = `
    <div class="toast-icon"><i class="fa-solid fa-bell fa-shake"></i></div>
    <div class="toast-body">
      <div class="toast-title">New Lead Profiled!</div>
      <div class="toast-text"><strong>${lead.name}</strong> from <strong>${lead.company_name}</strong> registered as a <strong>${lead.profile_type}</strong> (${lead.industry}).</div>
    </div>
    <button class="toast-close">&times;</button>
  `;

  // Close button trigger
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  });

  container.appendChild(toast);

  // Auto remove after 6 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }
  }, 6000);
}

// Tab Switching Listener
function setupAdminTabs() {
  const tabs = [
    { btnId: 'nav-btn-analytics', tabId: 'tab-analytics', title: 'Analytics Dashboard', subtitle: 'Real-time visitor capture details', value: 'analytics' },
    { btnId: 'nav-btn-leads', tabId: 'tab-leads', title: 'Leads Directory', subtitle: 'Search, filter and export gathered profiles', value: 'leads' },
    { btnId: 'nav-btn-closure', tabId: 'tab-closure', title: 'Event Closure Report', subtitle: 'Expo final outcomes and performance metrics', value: 'closure' }
  ];

  tabs.forEach(tab => {
    document.getElementById(tab.btnId).addEventListener('click', () => {
      // Deactivate all
      tabs.forEach(t => {
        document.getElementById(t.btnId).classList.remove('active');
        document.getElementById(t.tabId).classList.add('hidden');
        document.getElementById(t.tabId).classList.remove('active');
      });

      // Activate clicked
      document.getElementById(tab.btnId).classList.add('active');
      document.getElementById(tab.tabId).classList.remove('hidden');
      document.getElementById(tab.tabId).classList.add('active');
      
      // Update header titles
      document.getElementById('admin-tab-title').textContent = tab.title;
      document.getElementById('admin-tab-subtitle').textContent = tab.subtitle;

      currentAdminTab = tab.value;
      refreshCurrentTab();
    });
  });

  document.getElementById('btn-refresh').addEventListener('click', refreshCurrentTab);
}

// Fetch dashboard KPIs
async function fetchDashboardKPIs() {
  try {
    const res = await fetch('/api/dashboard');
    const data = await res.json();

    document.getElementById('kpi-total').textContent = data.total_leads;
    document.getElementById('kpi-today').textContent = data.today_leads;
    document.getElementById('kpi-week').textContent = data.week_leads;
    document.getElementById('kpi-month').textContent = data.month_leads;
    document.getElementById('kpi-companies').textContent = data.unique_companies;
    document.getElementById('kpi-velocity').textContent = data.conversion_velocity;
    
    // Follow-up splits
    document.getElementById('kpi-split-whatsapp').textContent = `${data.followup_split.whatsapp}%`;
    document.getElementById('kpi-split-call').textContent = `${data.followup_split.call}%`;
    document.getElementById('kpi-split-email').textContent = `${data.followup_split.email}%`;

  } catch (err) {
    console.error('Error fetching KPIs:', err);
  }
}

// Fetch and Render Chart.js Analytics
async function fetchAnalyticsCharts() {
  try {
    const res = await fetch('/api/analytics');
    const data = await res.json();

    // 1. Profile Distribution (Donut Chart)
    renderDonutChart('chart-profile', data.profile_dist);

    // 2. Industry Interest (Pie Chart)
    renderPieChart('chart-industry', data.industry_dist);

    // 3. Follow-up Preference (Bar Chart)
    renderBarChart('chart-followup', data.followup_dist);

    // 4. Lead Capture Velocity Trend (Line Chart)
    renderLineChart('chart-trend', data.hourly_trend, data.daily_trend);

    // 5. Top Companies Table
    renderTopCompaniesTable(data.top_companies);

  } catch (err) {
    console.error('Error loading analytics charts:', err);
  }
}

function renderDonutChart(canvasId, dataset) {
  if (activeCharts[canvasId]) activeCharts[canvasId].destroy();

  const labels = dataset.map(d => d.profile_type);
  const counts = dataset.map(d => d.count);

  const ctx = document.getElementById(canvasId).getContext('2d');
  activeCharts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: counts,
        backgroundColor: [
          '#FF7A00', '#00D2FF', '#10B981', '#3B82F6', '#A855F7', '#F59E0B', '#EF4444'
        ],
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#94A3B8', font: { family: 'Inter', size: 11 } }
        }
      }
    }
  });
}

function renderPieChart(canvasId, dataset) {
  if (activeCharts[canvasId]) activeCharts[canvasId].destroy();

  const labels = dataset.map(d => d.industry);
  const counts = dataset.map(d => d.count);

  const ctx = document.getElementById(canvasId).getContext('2d');
  activeCharts[canvasId] = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: counts,
        backgroundColor: ['#10B981', '#FF7A00', '#3B82F6', '#F59E0B'],
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#94A3B8', font: { family: 'Inter', size: 11 } }
        }
      }
    }
  });
}

function renderBarChart(canvasId, dataset) {
  if (activeCharts[canvasId]) activeCharts[canvasId].destroy();

  const labels = dataset.map(d => d.preferred_followup);
  const counts = dataset.map(d => d.count);

  const ctx = document.getElementById(canvasId).getContext('2d');
  activeCharts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Submissions',
        data: counts,
        backgroundColor: ['#00D2FF', '#10B981', '#3B82F6'],
        borderRadius: 6,
        barThickness: 32
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#94A3B8' } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94A3B8', stepSize: 1 } }
      }
    }
  });
}

function renderLineChart(canvasId, hourlyDataset, dailyDataset) {
  if (activeCharts[canvasId]) activeCharts[canvasId].destroy();

  // Draw hourly trend of leads across the show hours (9:00 - 19:00)
  // Fallback to daily trend if hourly is empty
  const hourlyObj = {};
  for(let h=9; h<=19; h++) {
    const padHour = String(h).padStart(2, '0') + ':00';
    hourlyObj[padHour] = 0;
  }
  hourlyDataset.forEach(d => {
    if(hourlyObj[d.hour_str] !== undefined) {
      hourlyObj[d.hour_str] = d.count;
    }
  });

  const labels = Object.keys(hourlyObj);
  const counts = Object.values(hourlyObj);

  const ctx = document.getElementById(canvasId).getContext('2d');
  activeCharts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Leads Captured (Today/Overall Hourly)',
        data: counts,
        borderColor: '#FF7A00',
        backgroundColor: 'rgba(255, 122, 0, 0.1)',
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointBackgroundColor: '#FF7A00'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#94A3B8' } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94A3B8', stepSize: 2 } }
      }
    }
  });
}

function renderTopCompaniesTable(companiesList) {
  const tbody = document.querySelector('#table-top-companies tbody');
  tbody.innerHTML = '';

  if (companiesList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="2" class="text-center">No company data captured yet.</td></tr>`;
    return;
  }

  companiesList.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item.company_name}</strong></td>
      <td><span class="event-tag">${item.count} registered</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================================================
// LEADS DIRECTORY CONTROLLER (Tab 2)
// ==========================================================================
async function fetchLeadsDirectory() {
  const searchVal = document.getElementById('search-input').value;
  const profileVal = document.getElementById('filter-profile').value;
  const industryVal = document.getElementById('filter-industry').value;
  const followupVal = document.getElementById('filter-followup').value;
  const dateStart = document.getElementById('filter-date-start').value;
  const dateEnd = document.getElementById('filter-date-end').value;

  let queryUrl = `/api/leads?sort_by=${sortColumn}&order=${sortOrder}`;
  if (searchVal) queryUrl += `&search=${encodeURIComponent(searchVal)}`;
  if (profileVal) queryUrl += `&profile_type=${encodeURIComponent(profileVal)}`;
  if (industryVal) queryUrl += `&industry=${encodeURIComponent(industryVal)}`;
  if (followupVal) queryUrl += `&preferred_followup=${encodeURIComponent(followupVal)}`;
  if (dateStart) queryUrl += `&date_start=${dateStart}`;
  if (dateEnd) queryUrl += `&date_end=${dateEnd}`;

  try {
    const res = await fetch(queryUrl);
    leadsList = await res.json();
    
    renderLeadsTable(leadsList);
    document.getElementById('leads-count-text').textContent = `${leadsList.length} profiles found`;
  } catch (err) {
    console.error('Error fetching leads list:', err);
  }
}

function renderLeadsTable(leads) {
  const tbody = document.querySelector('#table-leads-directory tbody');
  tbody.innerHTML = '';

  if (leads.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center">No registered leads found matching filters.</td></tr>`;
    return;
  }

  leads.forEach(lead => {
    // Format timestamp
    const date = new Date(lead.created_at.replace(' ', 'T'));
    const formattedDate = date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${lead.name}</strong></td>
      <td>${lead.company_name}</td>
      <td>+91 ${lead.mobile_number}</td>
      <td><a href="mailto:${lead.email}" class="admin-link">${lead.email}</a></td>
      <td><span class="profile-badge">${lead.profile_type}</span></td>
      <td>${lead.industry}</td>
      <td><span class="followup-badge ${lead.preferred_followup.toLowerCase()}">${lead.preferred_followup}</span></td>
      <td>${formattedDate}</td>
    `;
    tbody.appendChild(tr);
  });
}

function setupDirectoryFilters() {
  const inputs = ['search-input', 'filter-profile', 'filter-industry', 'filter-followup', 'filter-date-start', 'filter-date-end'];
  
  inputs.forEach(id => {
    document.getElementById(id).addEventListener('input', fetchLeadsDirectory);
  });

  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    document.getElementById('search-input').value = '';
    document.getElementById('filter-profile').value = '';
    document.getElementById('filter-industry').value = '';
    document.getElementById('filter-followup').value = '';
    document.getElementById('filter-date-start').value = '';
    document.getElementById('filter-date-end').value = '';
    fetchLeadsDirectory();
  });

  // Table Sort Headers Click
  document.querySelectorAll('#table-leads-directory th.sortable').forEach(th => {
    th.addEventListener('click', function() {
      const col = this.getAttribute('data-column');
      
      // Toggle order
      if (sortColumn === col) {
        sortOrder = sortOrder === 'ASC' ? 'DESC' : 'ASC';
      } else {
        sortColumn = col;
        sortOrder = 'DESC'; // Default to newest/highest
      }

      // Update Visual arrows
      document.querySelectorAll('#table-leads-directory th.sortable').forEach(header => {
        header.classList.remove('active');
        const icon = header.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-sort';
      });

      this.classList.add('active');
      const arrow = this.querySelector('i');
      if (arrow) {
        arrow.className = sortOrder === 'ASC' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
      }

      fetchLeadsDirectory();
    });
  });

  // CSV & Excel Exporters
  document.getElementById('btn-export-csv').addEventListener('click', exportToCSV);
  document.getElementById('btn-export-excel').addEventListener('click', exportToExcel);
}

// CSV Export logic
function exportToCSV() {
  if (leadsList.length === 0) {
    alert('No lead data to export.');
    return;
  }

  const headers = ['Name', 'Company', 'Mobile', 'Email', 'Profile Type', 'Industry', 'Preferred Follow-up', 'Submission Date'];
  const csvRows = [headers.join(',')];

  leadsList.forEach(lead => {
    const values = [
      `"${lead.name.replace(/"/g, '""')}"`,
      `"${lead.company_name.replace(/"/g, '""')}"`,
      `"+91 ${lead.mobile_number}"`,
      `"${lead.email}"`,
      `"${lead.profile_type}"`,
      `"${lead.industry}"`,
      `"${lead.preferred_followup}"`,
      `"${lead.created_at}"`
    ];
    csvRows.push(values.join(','));
  });

  const csvBlob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(csvBlob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `HUMBEE_Leads_Report_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Excel Export logic (using SheetJS)
function exportToExcel() {
  if (leadsList.length === 0) {
    alert('No lead data to export.');
    return;
  }

  // Format array for spreadsheet view
  const worksheetData = leadsList.map(lead => ({
    'Name': lead.name,
    'Company': lead.company_name,
    'Mobile Number': `+91 ${lead.mobile_number}`,
    'Email Address': lead.email,
    'Profile Type': lead.profile_type,
    'Industry Category': lead.industry,
    'Preferred Follow-up': lead.preferred_followup,
    'Capture Timestamp': lead.created_at
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Registered Leads');

  // Set column widths dynamically for beauty
  const wscols = [
    { wch: 22 }, // Name
    { wch: 25 }, // Company
    { wch: 16 }, // Mobile
    { wch: 28 }, // Email
    { wch: 20 }, // Profile Type
    { wch: 16 }, // Industry
    { wch: 20 }, // Preferred Follow-up
    { wch: 22 }  // Timestamp
  ];
  worksheet['!cols'] = wscols;

  XLSX.writeFile(workbook, `HUMBEE_Leads_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ==========================================================================
// EVENT CLOSURE REPORT CONTROLLER (Tab 3)
// ==========================================================================
async function fetchEventClosureReport() {
  try {
    const res = await fetch('/api/event-closure');
    const data = await res.json();

    document.getElementById('closure-leads').textContent = data.total_leads;
    document.getElementById('closure-companies').textContent = data.unique_companies;
    
    document.getElementById('closure-top-industry').textContent = data.top_industry;
    document.getElementById('closure-top-industry-sub').textContent = `${data.top_industry_count} submissions`;
    
    document.getElementById('closure-top-profile').textContent = data.top_profile;
    document.getElementById('closure-top-profile-sub').textContent = `${data.top_profile_count} submissions`;
    
    document.getElementById('closure-top-followup').textContent = data.top_followup;
    document.getElementById('closure-top-followup-sub').textContent = `${data.top_followup_count} submissions`;

    document.getElementById('closure-report-date').textContent = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

  } catch (err) {
    console.error('Error loading closure report:', err);
  }
}

function setupClosureListeners() {
  document.getElementById('btn-download-full-report').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/leads');
      const leads = await res.json();
      
      if (leads.length === 0) {
        alert('No lead data available for closure report.');
        return;
      }
      
      const worksheetData = leads.map(lead => ({
        'Lead ID': lead.id,
        'Visitor Name': lead.name,
        'Company/Firm': lead.company_name,
        'Mobile Number': `+91 ${lead.mobile_number}`,
        'Email Address': lead.email,
        'Visitor Profile': lead.profile_type,
        'Industry Interest': lead.industry,
        'Preferred Communication': lead.preferred_followup,
        'Timestamp': lead.created_at
      }));

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Expo Leads');
      
      worksheet['!cols'] = [
        { wch: 10 }, { wch: 22 }, { wch: 25 }, { wch: 16 }, { wch: 28 }, 
        { wch: 20 }, { wch: 16 }, { wch: 20 }, { wch: 22 }
      ];

      XLSX.writeFile(workbook, `HUMBEE_Event_Closure_Report.xlsx`);
    } catch (err) {
      alert('Error downloading report data.');
    }
  });
}

// ==========================================================================
// BOOTSTRAP INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  setupProfilerListeners();
  setupAdminTabs();
  setupDirectoryFilters();
  setupClosureListeners();
  initRouter();
});
