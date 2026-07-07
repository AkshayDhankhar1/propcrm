// ============================================================
// PropCRM — Agent Dashboard JavaScript
// ============================================================

(function () {
  'use strict';

  // ── State ───────────────────────────────────────────────────
  var sessionPin = null;
  var agentName = '';
  var leadsData = [];
  var priceChart = null;
  var areaChart = null;

  // ── DOM References ──────────────────────────────────────────
  var pinOverlay = document.getElementById('pin-overlay');
  var pinForm = document.getElementById('pin-form');
  var pinInput = document.getElementById('pin-input');
  var pinError = document.getElementById('pin-error');
  var btnPinSubmit = document.getElementById('btn-pin-submit');
  var dashboardPage = document.getElementById('dashboard-page');
  var navAgentName = document.getElementById('nav-agent-name');
  var btnRefresh = document.getElementById('btn-refresh');
  var btnLogout = document.getElementById('btn-logout');
  var toastContainer = document.getElementById('toast-container');

  // Stats
  var statTotalValue = document.getElementById('stat-total-value');
  var statContactedValue = document.getElementById('stat-contacted-value');
  var statPendingValue = document.getElementById('stat-pending-value');
  var statPriceValue = document.getElementById('stat-price-value');

  // Table
  var leadsTbody = document.getElementById('leads-tbody');
  var tableCount = document.getElementById('table-count');
  var tableEmpty = document.getElementById('table-empty');
  var leadsTable = document.getElementById('leads-table');

  // ── Toast System ────────────────────────────────────────────
  function showToast(message, type) {
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'info');
    var icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML =
      '<span class="toast-icon">' + icon + '</span>' +
      '<span class="toast-message">' + message + '</span>' +
      '<button class="toast-close" aria-label="Close">×</button>';
    toastContainer.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add('show');
    });

    toast.querySelector('.toast-close').addEventListener('click', function () {
      removeToast(toast);
    });

    setTimeout(function () { removeToast(toast); }, 5000);
  }

  function removeToast(toast) {
    toast.classList.remove('show');
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 400);
  }

  // ── Format Helpers ──────────────────────────────────────────
  function formatPrice(price) {
    var num = Number(price);
    if (num >= 10000000) return '₹' + (num / 10000000).toFixed(2) + ' Cr';
    if (num >= 100000) return '₹' + (num / 100000).toFixed(2) + ' L';
    return '₹' + num.toLocaleString('en-IN');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var hours = d.getHours();
    var mins = d.getMinutes();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return d.getDate() + ' ' + months[d.getMonth()] + ', ' +
      hours + ':' + (mins < 10 ? '0' : '') + mins + ' ' + ampm;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Green Gradient Colors ───────────────────────────────────
  function getGreenGradientColors(values) {
    // Sort values to determine concentration ranking
    var indexed = values.map(function (v, i) { return { value: v, index: i }; });
    indexed.sort(function (a, b) { return a.value - b.value; });

    // Assign colors based on rank
    var greens = [
      'rgba(232, 245, 233, 0.9)',  // Lightest - #E8F5E9
      'rgba(200, 230, 201, 0.9)',  // #C8E6C9
      'rgba(165, 214, 167, 0.9)',  // #A5D6A7
      'rgba(129, 199, 132, 0.9)',  // #81C784
      'rgba(76, 175, 80, 0.9)',    // #4CAF50
      'rgba(46, 125, 50, 0.9)',    // #2E7D32
    ];

    var borderGreens = [
      'rgba(200, 230, 201, 1)',
      'rgba(165, 214, 167, 1)',
      'rgba(129, 199, 132, 1)',
      'rgba(76, 175, 80, 1)',
      'rgba(56, 142, 60, 1)',
      'rgba(27, 94, 32, 1)',
    ];

    var colors = new Array(values.length);
    var borders = new Array(values.length);
    var totalLevels = greens.length;

    indexed.forEach(function (item, rank) {
      var level = Math.min(Math.floor((rank / values.length) * totalLevels), totalLevels - 1);
      colors[item.index] = greens[level];
      borders[item.index] = borderGreens[level];
    });

    return { backgrounds: colors, borders: borders };
  }

  // ── PIN Login ───────────────────────────────────────────────
  pinForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var pin = pinInput.value.trim();
    if (!pin) {
      pinError.textContent = 'Please enter your PIN';
      return;
    }

    pinError.textContent = '';
    btnPinSubmit.disabled = true;
    btnPinSubmit.innerHTML = '<span class="spinner"></span> Verifying...';

    fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'verifyPin', pin: pin }),
    })
      .then(function (r) { return r.json(); })
      .then(function (result) {
        btnPinSubmit.disabled = false;
        btnPinSubmit.innerHTML = '<span class="btn-text">Login</span>';

        if (result.success) {
          sessionPin = pin;
          agentName = result.agentName || 'Agent';
          pinOverlay.classList.add('hidden');
          dashboardPage.style.display = 'block';
          navAgentName.textContent = 'Welcome, ' + agentName;
          loadDashboardData();
        } else {
          pinError.textContent = 'Invalid PIN. Please try again.';
          pinInput.value = '';
          pinInput.focus();
        }
      })
      .catch(function (err) {
        btnPinSubmit.disabled = false;
        btnPinSubmit.innerHTML = '<span class="btn-text">Login</span>';
        pinError.textContent = 'Connection error. Please try again.';
        console.error('PIN verification error:', err);
      });
  });

  // ── Logout ──────────────────────────────────────────────────
  btnLogout.addEventListener('click', function () {
    sessionPin = null;
    agentName = '';
    dashboardPage.style.display = 'none';
    pinOverlay.classList.remove('hidden');
    pinInput.value = '';
    pinError.textContent = '';
    pinInput.focus();

    // Destroy charts
    if (priceChart) { priceChart.destroy(); priceChart = null; }
    if (areaChart) { areaChart.destroy(); areaChart = null; }
  });

  // ── Refresh ─────────────────────────────────────────────────
  btnRefresh.addEventListener('click', function () {
    loadDashboardData();
  });

  // ── Load Dashboard Data ─────────────────────────────────────
  function loadDashboardData() {
    btnRefresh.disabled = true;
    btnRefresh.innerHTML = '<span class="spinner spinner-dark" style="width:14px;height:14px;border-width:2px;"></span> Loading...';

    var url = CONFIG.APPS_SCRIPT_URL + '?action=getLeads&pin=' + encodeURIComponent(sessionPin);

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (result) {
        btnRefresh.disabled = false;
        btnRefresh.innerHTML = '↻ Refresh';

        if (result.success) {
          leadsData = result.leads || [];
          updateStats(result.stats);
          updatePriceChart(result.priceBrackets);
          updateAreaChart(result.areaCounts);
          updateLeadsTable(result.leads);
        } else {
          showToast(result.error || 'Failed to load data', 'error');
          if (result.error === 'Unauthorized') {
            btnLogout.click();
          }
        }
      })
      .catch(function (err) {
        btnRefresh.disabled = false;
        btnRefresh.innerHTML = '↻ Refresh';
        showToast('Network error. Could not load dashboard data.', 'error');
        console.error('Dashboard load error:', err);
      });
  }

  // ── Update Stats Cards ──────────────────────────────────────
  function updateStats(stats) {
    if (!stats) return;
    animateValue(statTotalValue, stats.totalLeads);
    statContactedValue.textContent = stats.contactedPercent + '%';
    animateValue(statPendingValue, stats.uncontactedCount);
    statPriceValue.textContent = formatPrice(stats.averagePrice);
  }

  function animateValue(element, targetValue) {
    var current = parseInt(element.textContent) || 0;
    var diff = targetValue - current;
    if (diff === 0) { element.textContent = targetValue; return; }

    var steps = 20;
    var stepValue = diff / steps;
    var step = 0;

    function tick() {
      step++;
      if (step >= steps) {
        element.textContent = targetValue;
      } else {
        element.textContent = Math.round(current + stepValue * step);
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
  }

  // ── Update Price Chart ──────────────────────────────────────
  function updatePriceChart(priceBrackets) {
    var container = document.getElementById('price-chart-container');

    if (!priceBrackets || Object.keys(priceBrackets).length === 0) {
      container.innerHTML = '<div class="chart-empty"><div class="chart-empty-icon">📊</div>No data yet</div>';
      return;
    }

    // Ensure canvas exists
    if (!container.querySelector('canvas')) {
      container.innerHTML = '<canvas id="price-chart"></canvas>';
    }

    var labels = Object.keys(priceBrackets);
    var values = labels.map(function (k) { return priceBrackets[k]; });
    var total = values.reduce(function (a, b) { return a + b; }, 0);
    var colors = getGreenGradientColors(values);

    var ctx = document.getElementById('price-chart').getContext('2d');

    if (priceChart) priceChart.destroy();

    priceChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors.backgrounds,
          borderColor: colors.borders,
          borderWidth: 2,
          hoverBorderWidth: 3,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              usePointStyle: true,
              pointStyle: 'circle',
              font: { family: "'Inter', sans-serif", size: 11, weight: '500' },
              color: '#555',
              generateLabels: function (chart) {
                var data = chart.data;
                return data.labels.map(function (label, i) {
                  var value = data.datasets[0].data[i];
                  var pct = total > 0 ? Math.round((value / total) * 100) : 0;
                  return {
                    text: label + ' (' + pct + '%)',
                    fillStyle: data.datasets[0].backgroundColor[i],
                    strokeStyle: data.datasets[0].borderColor[i],
                    lineWidth: 2,
                    hidden: false,
                    index: i,
                    pointStyle: 'circle',
                  };
                });
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(45, 52, 54, 0.95)',
            titleFont: { family: "'Inter', sans-serif", size: 12, weight: '600' },
            bodyFont: { family: "'Inter', sans-serif", size: 11 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function (context) {
                var pct = total > 0 ? Math.round((context.parsed / total) * 100) : 0;
                return context.label + ': ' + context.parsed + ' leads (' + pct + '%)';
              }
            }
          }
        },
        animation: {
          animateRotate: true,
          duration: 800,
        }
      }
    });
  }

  // ── Update Area Chart ───────────────────────────────────────
  function updateAreaChart(areaCounts) {
    var container = document.getElementById('area-chart-container');

    if (!areaCounts || Object.keys(areaCounts).length === 0) {
      container.innerHTML = '<div class="chart-empty"><div class="chart-empty-icon">📍</div>No data yet</div>';
      return;
    }

    // Ensure canvas
    if (!container.querySelector('canvas')) {
      container.innerHTML = '<canvas id="area-chart"></canvas>';
    }

    // Take top 8 areas
    var entries = Object.entries(areaCounts).slice(0, 8);
    var labels = entries.map(function (e) { return e[0]; });
    var values = entries.map(function (e) { return e[1]; });
    var colors = getGreenGradientColors(values);

    var ctx = document.getElementById('area-chart').getContext('2d');

    if (areaChart) areaChart.destroy();

    areaChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Number of Leads',
          data: values,
          backgroundColor: colors.backgrounds,
          borderColor: colors.borders,
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(45, 52, 54, 0.95)',
            titleFont: { family: "'Inter', sans-serif", size: 12, weight: '600' },
            bodyFont: { family: "'Inter', sans-serif", size: 11 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function (context) {
                return context.parsed.x + ' lead' + (context.parsed.x !== 1 ? 's' : '');
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              font: { family: "'Inter', sans-serif", size: 11 },
              color: '#8D9396',
            },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
          y: {
            ticks: {
              font: { family: "'Inter', sans-serif", size: 11, weight: '500' },
              color: '#555',
            },
            grid: { display: false },
          }
        },
        animation: {
          duration: 800,
        }
      }
    });
  }

  // ── Update Leads Table ──────────────────────────────────────
  function updateLeadsTable(leads) {
    leadsTbody.innerHTML = '';

    if (!leads || leads.length === 0) {
      leadsTable.style.display = 'none';
      tableEmpty.style.display = 'block';
      tableCount.textContent = '0 leads';
      return;
    }

    leadsTable.style.display = 'table';
    tableEmpty.style.display = 'none';
    tableCount.textContent = leads.length + ' lead' + (leads.length !== 1 ? 's' : '');

    // Sort by date (newest first)
    leads.sort(function (a, b) {
      return new Date(b.submittedAt) - new Date(a.submittedAt);
    });

    leads.forEach(function (lead) {
      var tr = document.createElement('tr');
      if (lead.contacted) tr.classList.add('contacted-row');
      tr.setAttribute('data-id', lead.id);

      tr.innerHTML =
        '<td><span class="lead-name">' + escapeHtml(lead.name) + '</span></td>' +
        '<td class="lead-email-cell">' + escapeHtml(lead.email) + '</td>' +
        '<td><span class="area-badge">' + escapeHtml(lead.area) + '</span></td>' +
        '<td><span class="lead-price">' + formatPrice(lead.price) + '</span></td>' +
        '<td><span class="lead-date">' + formatDateTime(lead.submittedAt) + '</span></td>' +
        '<td><input type="checkbox" class="contacted-checkbox" ' +
          (lead.contacted ? 'checked' : '') +
          ' data-id="' + lead.id + '" title="Mark as contacted"></td>' +
        '<td><button class="btn-send-email" data-id="' + lead.id + '" title="Send follow-up email">' +
          '✉ Send Email</button></td>';

      leadsTbody.appendChild(tr);
    });

    // Attach event listeners
    attachTableListeners();
  }

  // ── Table Event Listeners ───────────────────────────────────
  function attachTableListeners() {
    // Contacted checkboxes
    var checkboxes = document.querySelectorAll('.contacted-checkbox');
    checkboxes.forEach(function (cb) {
      cb.addEventListener('change', function () {
        handleContactedToggle(this);
      });
    });

    // Send email buttons
    var emailBtns = document.querySelectorAll('.btn-send-email');
    emailBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        handleSendEmail(this);
      });
    });
  }

  // ── Handle Contacted Toggle ─────────────────────────────────
  function handleContactedToggle(checkbox) {
    var leadId = checkbox.getAttribute('data-id');
    var contacted = checkbox.checked;
    var row = checkbox.closest('tr');

    // Optimistic UI update
    if (contacted) {
      row.classList.add('contacted-row');
    } else {
      row.classList.remove('contacted-row');
    }

    fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'updateContacted',
        pin: sessionPin,
        id: leadId,
        contacted: contacted,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (result) {
        if (result.success) {
          showToast(contacted ? 'Lead marked as contacted' : 'Lead marked as uncontacted', 'success');
          // Update local data
          leadsData.forEach(function (lead) {
            if (lead.id === leadId) lead.contacted = contacted;
          });
          // Update stats locally
          updateStatsFromLocal();
        } else {
          // Revert
          checkbox.checked = !contacted;
          row.classList.toggle('contacted-row');
          showToast('Failed to update status', 'error');
        }
      })
      .catch(function (err) {
        checkbox.checked = !contacted;
        row.classList.toggle('contacted-row');
        showToast('Network error. Could not update.', 'error');
        console.error('Contacted toggle error:', err);
      });
  }

  // ── Update Stats from Local Data ────────────────────────────
  function updateStatsFromLocal() {
    var total = leadsData.length;
    var contacted = leadsData.filter(function (l) { return l.contacted; }).length;
    var pct = total > 0 ? Math.round((contacted / total) * 100 * 10) / 10 : 0;
    var totalPrice = leadsData.reduce(function (sum, l) { return sum + (Number(l.price) || 0); }, 0);
    var avgPrice = total > 0 ? Math.round(totalPrice / total) : 0;

    statTotalValue.textContent = total;
    statContactedValue.textContent = pct + '%';
    statPendingValue.textContent = total - contacted;
    statPriceValue.textContent = formatPrice(avgPrice);
  }

  // ── Handle Send Email ───────────────────────────────────────
  function handleSendEmail(btn) {
    var leadId = btn.getAttribute('data-id');
    var originalHTML = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-dark" style="width:12px;height:12px;border-width:2px;"></span> Sending...';

    fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'sendEmailToLead',
        pin: sessionPin,
        id: leadId,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (result) {
        if (result.success) {
          btn.classList.add('sent');
          btn.innerHTML = '✓ Sent';
          showToast('Follow-up email sent successfully!', 'success');

          setTimeout(function () {
            btn.classList.remove('sent');
            btn.innerHTML = originalHTML;
            btn.disabled = false;
          }, 3000);
        } else {
          btn.classList.add('failed');
          btn.innerHTML = '✕ Failed';
          showToast(result.error || 'Failed to send email', 'error');

          setTimeout(function () {
            btn.classList.remove('failed');
            btn.innerHTML = originalHTML;
            btn.disabled = false;
          }, 3000);
        }
      })
      .catch(function (err) {
        btn.classList.add('failed');
        btn.innerHTML = '✕ Error';
        showToast('Network error. Could not send email.', 'error');

        setTimeout(function () {
          btn.classList.remove('failed');
          btn.innerHTML = originalHTML;
          btn.disabled = false;
        }, 3000);

        console.error('Send email error:', err);
      });
  }

})();
