/**
 * Password Strength Checker
 * -----------------------------------------------------------------------
 * Vanilla JS (ES6). No frameworks, no dependencies.
 *
 * Architecture:
 *   1. RULES        — declarative list of the checks a password is scored against.
 *   2. evaluate()    — pure function: password in, analysis result out.
 *   3. render()      — takes an analysis result and updates the DOM.
 *   4. Event wiring  — connects the input field to evaluate() + render().
 *
 * Keeping evaluate() pure (no DOM access) makes the scoring logic easy to
 * unit test or reuse elsewhere (e.g. a signup form on a different page)
 * without dragging the UI code along with it.
 * -----------------------------------------------------------------------
 */

/** @type {{id: string, label: string, bonus: boolean, test: (pw: string) => boolean}[]} */
const RULES = [
  {
    id: 'length',
    label: 'At least 8 characters',
    bonus: false,
    test: (pw) => pw.length >= 8,
  },
  {
    id: 'uppercase',
    label: 'One uppercase letter',
    bonus: false,
    test: (pw) => /[A-Z]/.test(pw),
  },
  {
    id: 'lowercase',
    label: 'One lowercase letter',
    bonus: false,
    test: (pw) => /[a-z]/.test(pw),
  },
  {
    id: 'number',
    label: 'One number',
    bonus: false,
    test: (pw) => /[0-9]/.test(pw),
  },
  {
    id: 'special',
    label: 'One special character',
    bonus: false,
    test: (pw) => /[^A-Za-z0-9]/.test(pw),
  },
  {
    id: 'longLength',
    label: '12 or more characters',
    bonus: true,
    test: (pw) => pw.length >= 12,
  },
];

const SCORE_THRESHOLDS = {
  medium: 3, // score >= 3  -> at least "medium"
  strong: 5, // score >= 5  -> "strong"
};

/**
 * Runs every rule against a password and derives an overall strength level.
 * The 8-character minimum is treated as a hard floor: fall short of it and
 * the password is capped at "weak" no matter how many other boxes it ticks,
 * since a short password is inherently easier to brute-force.
 *
 * @param {string} password
 * @returns {{
 *   results: Record<string, boolean>,
 *   score: number,
 *   maxScore: number,
 *   level: 'idle' | 'weak' | 'medium' | 'strong'
 * }}
 */
function evaluate(password) {
  const results = {};
  let score = 0;

  for (const rule of RULES) {
    const met = rule.test(password);
    results[rule.id] = met;
    if (met) score += 1;
  }

  const maxScore = RULES.length;

  let level = 'idle';
  if (password.length > 0) {
    if (!results.length) {
      level = 'weak';
    } else if (score >= SCORE_THRESHOLDS.strong) {
      level = 'strong';
    } else if (score >= SCORE_THRESHOLDS.medium) {
      level = 'medium';
    } else {
      level = 'weak';
    }
  }

  return { results, score, maxScore, level };
}

/**
 * Builds human-readable suggestions from an evaluation result.
 * Only surfaces what's still missing — a password that already meets
 * every rule gets a single confirmation message instead of clutter.
 *
 * @param {{results: Record<string, boolean>, level: string}} analysis
 * @param {string} password
 * @returns {{text: string, type: 'placeholder' | 'tip' | 'success'}[]}
 */
function buildSuggestions(analysis, password) {
  if (password.length === 0) {
    return [{ text: 'Start typing to see personalized suggestions.', type: 'placeholder' }];
  }

  const tips = [];
  const { results } = analysis;

  if (!results.length) tips.push('Use at least 8 characters — shorter passwords are much easier to crack.');
  if (!results.uppercase) tips.push('Add an uppercase letter (A–Z).');
  if (!results.lowercase) tips.push('Add a lowercase letter (a–z).');
  if (!results.number) tips.push('Add a number (0–9).');
  if (!results.special) tips.push('Add a special character, like ! @ # $ % or &.');
  if (!results.longLength && results.length) tips.push('Consider 12+ characters for extra strength.');

  if (tips.length === 0) {
    return [{ text: 'Excellent — this password meets every requirement.', type: 'success' }];
  }

  return tips.map((text) => ({ text, type: 'tip' }));
}

// ---------------------------------------------------------------------------
// DOM wiring
// ---------------------------------------------------------------------------

const passwordInput = document.getElementById('passwordInput');
const toggleVisibilityBtn = document.getElementById('toggleVisibility');
const eyeIcon = toggleVisibilityBtn.querySelector('.icon--eye');
const eyeOffIcon = toggleVisibilityBtn.querySelector('.icon--eye-off');

const meterSegments = document.querySelectorAll('.meter__segment');
const strengthLabel = document.getElementById('strengthLabel');
const scoreReadout = document.getElementById('scoreReadout');
const statusLight = document.getElementById('statusLight');
const statusLabel = document.getElementById('statusLabel');
const checklistItems = document.querySelectorAll('.checklist__item');
const suggestionsList = document.getElementById('suggestionsList');

const LEVEL_TEXT = {
  idle: 'AWAITING INPUT',
  weak: 'WEAK',
  medium: 'MEDIUM',
  strong: 'STRONG',
};

const STATUS_TEXT = {
  idle: 'STANDBY',
  weak: 'AT RISK',
  medium: 'ACCEPTABLE',
  strong: 'SECURE',
};

/**
 * Applies an evaluation result to every piece of the UI.
 * @param {ReturnType<typeof evaluate>} analysis
 * @param {string} password
 */
function render(analysis, password) {
  const { results, score, maxScore, level } = analysis;

  // Segmented meter
  meterSegments.forEach((segment, index) => {
    const isFilled = index < score;
    segment.classList.toggle('is-filled', isFilled);
    if (isFilled) {
      segment.setAttribute('data-strength', level === 'idle' ? 'weak' : level);
    } else {
      segment.removeAttribute('data-strength');
    }
  });

  // Strength label + score readout
  strengthLabel.textContent = LEVEL_TEXT[level];
  strengthLabel.setAttribute('data-level', level);
  scoreReadout.innerHTML = `SCORE ${score}/${maxScore}<span class="cursor">&#9608;</span>`;

  // Status light in the header
  statusLight.setAttribute('data-level', level);
  statusLabel.textContent = STATUS_TEXT[level];

  // Checklist
  checklistItems.forEach((item) => {
    const rule = item.getAttribute('data-rule');
    item.classList.toggle('is-met', Boolean(results[rule]));
  });

  // Suggestions
  const suggestions = buildSuggestions(analysis, password);
  suggestionsList.innerHTML = '';
  suggestions.forEach(({ text, type }) => {
    const li = document.createElement('li');
    li.className = `suggestions__item suggestions__item--${type}`;
    li.textContent = text;
    suggestionsList.appendChild(li);
  });
}

/** Runs the full evaluate -> render pipeline for the input's current value. */
function handleInput() {
  const password = passwordInput.value;
  const analysis = evaluate(password);
  render(analysis, password);
}

function handleToggleVisibility() {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';

  toggleVisibilityBtn.setAttribute('aria-pressed', String(isPassword));
  toggleVisibilityBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  eyeIcon.hidden = isPassword;
  eyeOffIcon.hidden = !isPassword;

  passwordInput.focus();
}

passwordInput.addEventListener('input', handleInput);
toggleVisibilityBtn.addEventListener('click', handleToggleVisibility);

// Initialize UI state on load (handles browser autofill on refresh, etc.)
handleInput();
