// ============================================================
// PropCRM — Lead Form JavaScript
// ============================================================

(function () {
  'use strict';

  // ── DOM References ──────────────────────────────────────────
  const form = document.getElementById('lead-form');
  const btnSubmit = document.getElementById('btn-submit');
  const successOverlay = document.getElementById('success-overlay');
  const toastContainer = document.getElementById('toast-container');

  const fields = {
    name: {
      input: document.getElementById('input-name'),
      error: document.getElementById('error-name'),
      group: document.getElementById('group-name'),
    },
    email: {
      input: document.getElementById('input-email'),
      error: document.getElementById('error-email'),
      group: document.getElementById('group-email'),
    },
    area: {
      input: document.getElementById('input-area'),
      error: document.getElementById('error-area'),
      group: document.getElementById('group-area'),
    },
    price: {
      input: document.getElementById('input-price'),
      error: document.getElementById('error-price'),
      group: document.getElementById('group-price'),
    },
  };

  // ── Validation Rules ────────────────────────────────────────
  const validators = {
    name: function (value) {
      const trimmed = value.trim();
      if (!trimmed) return 'Please enter your full name';
      if (trimmed.length < 2) return 'Name must be at least 2 characters';
      if (!/^[a-zA-Z\s.\-']+$/.test(trimmed)) return 'Name can only contain letters, spaces, dots, and hyphens';
      return null;
    },

    email: function (value) {
      const trimmed = value.trim();
      if (!trimmed) return 'Please enter your email address';
      const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(trimmed)) return 'Please enter a valid email address';
      return null;
    },

    area: function (value) {
      const trimmed = value.trim();
      if (!trimmed) return 'Please enter the property area or locality';
      if (trimmed.length > 100) return 'Area must be under 100 characters';
      return null;
    },

    price: function (value) {
      if (!value && value !== 0) return 'Please enter the property budget';
      const num = Number(value);
      if (isNaN(num) || num <= 0) return 'Please enter a valid positive amount';
      if (num > 99999999999) return 'Please enter a realistic amount';
      return null;
    },
  };

  // ── Validate Single Field ──────────────────────────────────
  function validateField(name) {
    const field = fields[name];
    const value = field.input.value;
    const error = validators[name](value);

    if (error) {
      field.error.textContent = error;
      field.error.classList.add('visible');
      field.group.classList.add('has-error');
      return false;
    } else {
      field.error.textContent = '';
      field.error.classList.remove('visible');
      field.group.classList.remove('has-error');
      return true;
    }
  }

  // ── Validate All Fields ────────────────────────────────────
  function validateAll() {
    let valid = true;
    Object.keys(fields).forEach(function (name) {
      if (!validateField(name)) valid = false;
    });
    return valid;
  }

  // ── Real-time Validation (on blur) ─────────────────────────
  Object.keys(fields).forEach(function (name) {
    const field = fields[name];

    field.input.addEventListener('blur', function () {
      if (field.input.value) {
        validateField(name);
      }
    });

    // Clear error on input
    field.input.addEventListener('input', function () {
      if (field.group.classList.contains('has-error')) {
        validateField(name);
      }
    });
  });

  // ── Toast System ────────────────────────────────────────────
  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'info');

    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';

    toast.innerHTML =
      '<span class="toast-icon">' + icon + '</span>' +
      '<span class="toast-message">' + message + '</span>' +
      '<button class="toast-close" aria-label="Close notification">×</button>';

    toastContainer.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(function () {
      toast.classList.add('show');
    });

    // Close handler
    var closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', function () {
      removeToast(toast);
    });

    // Auto remove
    setTimeout(function () {
      removeToast(toast);
    }, 5000);
  }

  function removeToast(toast) {
    toast.classList.remove('show');
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 400);
  }

  // ── Set Loading State ───────────────────────────────────────
  function setLoading(loading) {
    if (loading) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span class="spinner"></span> <span class="btn-text">Submitting...</span>';
    } else {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<span class="btn-text">Submit Inquiry</span>';
    }
  }

  // ── Show Success ────────────────────────────────────────────
  function showSuccess() {
    successOverlay.classList.add('visible');

    // Auto-hide and reset after 4 seconds
    setTimeout(function () {
      successOverlay.classList.remove('visible');
      form.reset();
    }, 4000);
  }

  // ── Submit Form ─────────────────────────────────────────────
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Validate
    if (!validateAll()) {
      showToast('Please fix the errors below', 'error');
      // Focus first error field
      var firstError = form.querySelector('.has-error input');
      if (firstError) firstError.focus();
      return;
    }

    // Prepare data
    var data = {
      action: 'submitLead',
      name: fields.name.input.value.trim(),
      email: fields.email.input.value.trim(),
      area: fields.area.input.value.trim(),
      price: Number(fields.price.input.value),
    };

    setLoading(true);

    // POST to Apps Script
    fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data),
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        setLoading(false);

        if (result.success) {
          showSuccess();
          showToast('Your inquiry has been submitted successfully!', 'success');
        } else {
          var errorMsg = result.errors
            ? result.errors.join('. ')
            : result.error || 'Something went wrong';
          showToast(errorMsg, 'error');
        }
      })
      .catch(function (err) {
        setLoading(false);
        console.error('Submission error:', err);
        showToast('Network error. Please check your connection and try again.', 'error');
      });
  });

  // ── Price Input Formatting Helper ───────────────────────────
  var priceInput = fields.price.input;
  priceInput.addEventListener('keydown', function (e) {
    // Prevent e, E, +, - in number input
    if (['e', 'E', '+', '-'].includes(e.key)) {
      e.preventDefault();
    }
  });

})();
