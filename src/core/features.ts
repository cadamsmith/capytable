import { _fnDraw } from './draw';
import { _fnFilterComplete } from './filter';
import { _formatNumber, _range } from './internal';
import { _fnLengthChange } from './length';
import { _fnPageChange } from './page';
import { _fnBindActionWithData, _fnCallbackFire, _fnMacros } from './support';

export function _renderFeature(settings, feature) {
  let element;

  if (feature === 'info') {
    element = _renderInfo(settings);
  } else if (feature === 'pageLength') {
    element = _renderPageLength(settings);
  } else if (feature === 'paging') {
    element = _renderPaging(settings);
  } else if (feature === 'search') {
    element = _renderSearch(settings);
  } else {
    console.error(`Feature ${feature} not found`);
    return null;
  }

  const divElement = document.createElement('div');
  divElement.appendChild(element);

  return divElement;
}

function _renderInfo(settings) {
  const tid = settings.tableId;

  const n = document.createElement('div');
  n.className = 'dt-info';

  // Update display on each draw
  settings.drawCallbacks.push(function (s) {
    _fnUpdateInfo(s, n);
  });

  // For the first info display in the table, we add a callback and aria information.
  if (!settings._infoEl) {
    n.setAttribute('aria-live', 'polite');
    n.setAttribute('id', `${tid}_info`);
    n.setAttribute('role', 'status');

    // Table is described by our info div
    settings.tableElement.setAttribute('aria-describedby', `${tid}_info`);

    settings._infoEl = n;
  }

  return n;
}

/**
 * Update the information elements in the display
 *  @param {object} settings Capytable settings object
 *  @memberof Capytable#oApi
 */
function _fnUpdateInfo(settings, node) {
  var max = settings.total(),
    total = settings.totalDisplayed(),
    out = total
      ? 'Showing _START_ to _END_ of _TOTAL_ _ENTRIES-TOTAL_'
      : 'Showing 0 to 0 of 0 _ENTRIES-TOTAL_';

  if (total !== max) {
    // Record set after filtering
    out += ' (filtered from _MAX_ total _ENTRIES-MAX_)';
  }

  // Convert the macros
  out = _fnMacros(settings, out);

  node.innerHTML = out;

  _fnCallbackFire(settings, null, 'info', [settings, node, out]);
}

var __lengthCounter = 0;

function _renderPageLength(settings) {
  var features = settings.features;

  // For compatibility with the legacy `pageLength` top level option
  if (!features.paging) {
    return null;
  }

  var tableId = settings.tableId,
    menu = settings.lengthMenu;

  // We can put the <select> outside of the label if it is at the start or
  // end which helps improve accessability (not all screen readers like
  // implicit for elements).
  var removed = ' _ENTRIES_ per page'.replace(/_MENU_/, '');

  var str = `_MENU_<label>${removed}</label>`;

  // Wrapper element - use a span as a holder for where the select will go
  var tmpId = `tmp-` + +new Date();
  var div = document.createElement('div');
  div.classList.add('dt-length');
  div.innerHTML = str.replace('_MENU_', `<span id="${tmpId}"></span>`);

  // Save text node content for macro updating
  var textNodes: any[] = [];
  div.querySelector('label')!.childNodes.forEach(function (el) {
    if (el.nodeType === Node.TEXT_NODE) {
      textNodes.push({
        el: el,
        text: el.textContent,
      });
    }
  });

  // Update the label text in case it has an entries value
  const updateEntries = function () {
    textNodes.forEach(function (node) {
      node.el.textContent = _fnMacros(settings, node.text);
    });
  };

  // Next, the select itself, along with the options
  const select = document.createElement('select');
  select.setAttribute('name', tableId + '_length');
  select.setAttribute('aria-controls', tableId);
  select.className = 'dt-input';

  for (let i = 0; i < menu.length; i++) {
    select[i] = new Option(_formatNumber(menu[i]), menu[i]);
  }

  // add for and id to label and input
  div
    .querySelector('label')!
    .setAttribute('for', 'dt-length-' + __lengthCounter);
  select.id = 'dt-length-' + __lengthCounter;
  __lengthCounter++;

  // Swap in the select list
  div.querySelector('#' + tmpId)!.replaceWith(select);

  // Can't use `select` variable as user might provide their own and the
  // reference is broken by the use of outerHTML
  select.value = settings._displayLength;
  select.addEventListener('change', function () {
    _fnLengthChange(settings, this.value);
    _fnDraw(settings);
  });

  // Update node value whenever anything changes the table's length
  settings.tableElement.addEventListener('length.dt', function (e) {
    if (settings === e.detail.settings) {
      div.querySelector('select')!.value = e.detail.len;

      // Resolve plurals in the text for the new length
      updateEntries();
    }
  });

  updateEntries();

  return div;
}

function _renderPaging(settings) {
  // Don't show the paging input if the table doesn't have paging enabled
  if (!settings.features.paging) {
    return null;
  }

  // create the host element for the controls
  const host = document.createElement('div');
  host.classList.add('dt-paging');
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'pagination');
  host.appendChild(nav);

  var draw = () => _pagingDraw(settings, nav, 7);

  settings.drawCallbacks.push(draw);

  // Responsive redraw of paging control
  settings.tableElement.addEventListener('column-sizing.dt', draw);

  return host;
}

function _pagingDraw(settings, host, buttons) {
  if (!settings._initComplete) {
    return;
  }

  const defaultPaging = ['first', 'previous', 'numbers', 'next', 'last'];

  const aria = {
    first: 'First',
    last: 'Last',
    next: 'Next',
    previous: 'Previous',
    number: '',
  };

  var start = settings._displayStart,
    len = settings._displayLength,
    visRecords = settings.totalDisplayed(),
    all = len === -1,
    page = all ? 0 : Math.ceil(start / len),
    pages = all ? 1 : Math.ceil(visRecords / len),
    buttonArray = defaultPaging
      .map(function (val) {
        return val === 'numbers' ? _pagingNumbers(page, pages, buttons) : val;
      })
      .flat();

  var buttonEls: any[] = [];

  for (var i = 0; i < buttonArray.length; i++) {
    var button = buttonArray[i];

    var btnInfo = _pagingButtonInfo(button, page, pages);
    var btn = _renderPagingButton(
      button,
      btnInfo.display,
      btnInfo.active,
      btnInfo.disabled,
    );

    var ariaLabel =
      typeof button === 'string'
        ? aria[button]
        : aria.number
          ? aria.number + (button + 1)
          : null;

    // Common attributes
    btn.clicker.setAttribute('aria-controls', settings.tableId);
    btn.clicker.setAttribute('aria-disabled', btnInfo.disabled);
    btn.clicker.setAttribute('aria-current', btnInfo.active ? 'page' : null);
    btn.clicker.setAttribute('aria-label', ariaLabel);
    btn.clicker.setAttribute('data-dt-idx', ariaLabel);
    btn.clicker.setAttribute('tabIndex', btnInfo.disabled ? -1 : null);

    if (typeof button !== 'number') {
      btn.clicker.classList.add(button);
    }

    const action = button;
    _fnBindActionWithData(btn.clicker, function (e) {
      e.preventDefault();

      _fnPageChange(settings, action);
    });

    buttonEls.push(btn.display);
  }

  var activeEl = host.querySelector(':active');

  host.replaceChildren(...buttonEls);

  if (activeEl) {
    const idx = activeEl.dataset['dt-idx'];

    host.querySelector(`[data-dt-idx=${idx}]`).focus();
  }
}

function _renderPagingButton(buttonType, content, active, disabled) {
  var btnClasses = ['dt-paging-button'];
  var btn;

  if (active) {
    btnClasses.push('current');
  }

  if (disabled) {
    btnClasses.push('disabled');
  }

  if (buttonType === 'ellipsis') {
    btn = document.createElement('span');
    btn.classList.add('ellipsis');
    btn.innerHTML = content;
  } else {
    btn = document.createElement('button');
    btn.classList.add(...btnClasses);
    btn.role = 'link';
    btn.type = 'button';
    btn.innerHTML = content;
  }

  return {
    display: btn,
    clicker: btn,
  };
}

/**
 * Get properties for a button based on the current paging state of the table
 *
 * @param {*} settings DT settings object
 * @param {*} button The button type in question
 * @param {*} page Table's current page
 * @param {*} pages Number of pages
 * @returns Info object
 */
function _pagingButtonInfo(button, page, pages) {
  var o = {
    display: '',
    active: false,
    disabled: false,
  };

  switch (button) {
    case 'ellipsis':
      o.display = '&#x2026;';
      o.disabled = true;
      break;

    case 'first':
      o.display = '\u00AB';

      if (page === 0) {
        o.disabled = true;
      }
      break;

    case 'previous':
      o.display = '\u2039';

      if (page === 0) {
        o.disabled = true;
      }
      break;

    case 'next':
      o.display = '\u203A';

      if (pages === 0 || page === pages - 1) {
        o.disabled = true;
      }
      break;

    case 'last':
      o.display = '\u00BB';

      if (pages === 0 || page === pages - 1) {
        o.disabled = true;
      }
      break;

    default:
      if (typeof button === 'number') {
        o.display = _formatNumber(button + 1);

        if (page === button) {
          o.active = true;
        }
      }
      break;
  }

  return o;
}

/**
 * Compute what number buttons to show in the paging control
 *
 * @param {*} page Current page
 * @param {*} pages Total number of pages
 * @param {*} buttons Target number of number buttons
 * @param {boolean} addFirstLast Indicate if page 1 and end should be included
 * @returns Buttons to show
 */
function _pagingNumbers(page, pages, buttons): string[] {
  var numbers: any[] = [],
    half = Math.floor(buttons / 2),
    before = 2,
    after = 1;

  if (pages <= buttons) {
    numbers = _range(0, pages);
  } else if (buttons === 1) {
    // Single button - current page only
    numbers = [page];
  } else if (buttons === 3) {
    // Special logic for just three buttons
    if (page <= 1) {
      numbers = [0, 1, 'ellipsis'];
    } else if (page >= pages - 2) {
      numbers = _range(pages - 2, pages);
      numbers.unshift('ellipsis');
    } else {
      numbers = ['ellipsis', page, 'ellipsis'];
    }
  } else if (page <= half) {
    numbers = _range(0, buttons - before);
    numbers.push('ellipsis');

    numbers.push(pages - 1);
  } else if (page >= pages - 1 - half) {
    numbers = _range(pages - (buttons - before), pages);
    numbers.unshift('ellipsis');

    numbers.unshift(0);
  } else {
    numbers = _range(page - half + before, page + half - after);
    numbers.push('ellipsis');
    numbers.unshift('ellipsis');

    numbers.push(pages - 1);
    numbers.unshift(0);
  }

  return numbers;
}

var __searchCounter = 0;

function _renderSearch(settings) {
  // Don't show the input if filtering isn't available on the table
  if (!settings.features.searching) {
    return null;
  }

  var tableId = settings.tableId;
  var previousSearch = settings.searchText;
  var input = '<input type="search" class="dt-input"/>';

  // We can put the <input> outside of the label if it is at the start or end
  // which helps improve accessability (not all screen readers like implicit
  // for elements).
  var str = '<label>Search:</label>_INPUT_';

  const filter = document.createElement('div');
  filter.classList.add('dt-search');
  filter.innerHTML = str.replace(/_INPUT_/, input);

  // add for and id to label and input
  filter
    .querySelector('label')!
    .setAttribute('for', 'dt-search-' + __searchCounter);
  filter
    .querySelector('input')!
    .setAttribute('id', 'dt-search-' + __searchCounter);
  __searchCounter++;

  var searchFn = function () {
    var val = this.value;

    /* Now do the filter */
    if (val != previousSearch) {
      previousSearch = val;

      _fnFilterComplete(settings, previousSearch);

      // Need to redraw, without resorting
      settings._displayStart = 0;
      _fnDraw(settings);
    }
  };

  var jqFilter = filter.querySelector('input')!;
  jqFilter.value = previousSearch;
  jqFilter.setAttribute('placeholder', '');

  ['keyup', 'search', 'input', 'paste', 'cut'].forEach((event) => {
    jqFilter.addEventListener(event, searchFn);
  });

  jqFilter.addEventListener('keypress', function (e) {
    // Prevent form submission
    if (e.keyCode == 13) {
      return false;
    }
  });

  jqFilter.setAttribute('aria-controls', tableId);

  return filter;
}
