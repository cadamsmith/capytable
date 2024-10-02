import { ISettings } from '../models/interfaces';
import { draw } from './draw';
import { filterComplete } from './filter';
import { formatNumber, range } from './internal';
import { changeLength } from './length';
import { changePage } from './page';
import {
  bindActionWithData,
  callbackFire,
  applyLanguageMacros,
} from './support';

/**
 * Render a feature element
 * @param settings Capytable settings object
 * @param feature name of the feature to render
 * @returns div element containing the feature, or null if not a valid feature
 */
export function renderFeature(
  settings: ISettings,
  feature: string,
): HTMLDivElement {
  let element: HTMLDivElement;

  if (feature === 'info') {
    element = renderInfo(settings);
  } else if (feature === 'pageLength') {
    element = renderPageLength(settings);
  } else if (feature === 'paging') {
    element = renderPaging(settings);
  } else if (feature === 'search') {
    element = renderSearch(settings);
  } else {
    console.error(`Feature ${feature} not found`);
    return null;
  }

  const divElement = document.createElement('div');
  divElement.appendChild(element);

  return divElement;
}

/**
 * render the table information element (i.e. "Showing 1 to 10 of 57 entries")
 * @param settings Capytable settings object
 * @returns div element containing the info element
 */
function renderInfo(settings: ISettings): HTMLDivElement {
  const tid = settings.tableId;

  const n = document.createElement('div');
  n.className = 'ct-info';

  // Update display on each draw
  settings.drawCallbacks.push(function (s: ISettings) {
    updateInfo(s, n);
  });

  // For the first info display in the table, we add a callback and aria information.
  if (!settings._infoElement) {
    n.setAttribute('aria-live', 'polite');
    n.setAttribute('id', `${tid}_info`);
    n.setAttribute('role', 'status');

    // Table is described by our info div
    settings.tableElement.setAttribute('aria-describedby', `${tid}_info`);

    settings._infoElement = n;
  }

  return n;
}

/**
 * Update the information elements in the display
 * @param settings Capytable settings object
 */
function updateInfo(settings: ISettings, node: HTMLDivElement): void {
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
  out = applyLanguageMacros(settings, out);

  node.innerHTML = out;

  callbackFire(settings, null, 'info', [settings, node, out]);
}

var __lengthCounter = 0;

function renderPageLength(settings: ISettings): HTMLDivElement {
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
  div.classList.add('ct-length');
  div.innerHTML = str.replace('_MENU_', `<span id="${tmpId}"></span>`);

  // Save text node content for macro updating
  var textNodes: { el: ChildNode; text: string }[] = [];
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
      node.el.textContent = applyLanguageMacros(settings, node.text);
    });
  };

  // Next, the select itself, along with the options
  const select = document.createElement('select');
  select.setAttribute('name', tableId + '_length');
  select.setAttribute('aria-controls', tableId);
  select.className = 'ct-input';

  for (let i = 0; i < menu.length; i++) {
    select[i] = new Option(formatNumber(menu[i]), menu[i].toString());
  }

  // add for and id to label and input
  div
    .querySelector('label')!
    .setAttribute('for', 'ct-length-' + __lengthCounter);
  select.id = 'ct-length-' + __lengthCounter;
  __lengthCounter++;

  // Swap in the select list
  div.querySelector('#' + tmpId)!.replaceWith(select);

  // Can't use `select` variable as user might provide their own and the
  // reference is broken by the use of outerHTML
  select.value = settings._displayLength.toString();
  select.addEventListener('change', function () {
    changeLength(settings, this.value);
    draw(settings);
  });

  // Update node value whenever anything changes the table's length
  settings.tableElement.addEventListener('length.dt', function (e) {
    const event = e as CustomEvent;

    if (settings === event.detail.settings) {
      div.querySelector('select')!.value = event.detail.len;

      // Resolve plurals in the text for the new length
      updateEntries();
    }
  });

  updateEntries();

  return div;
}

function renderPaging(settings: ISettings): HTMLDivElement {
  // Don't show the paging input if the table doesn't have paging enabled
  if (!settings.features.paging) {
    return null;
  }

  // create the host element for the controls
  const host = document.createElement('div');
  host.classList.add('ct-paging');
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'pagination');
  host.appendChild(nav);

  var draw = () => pagingDraw(settings, nav, 7);

  settings.drawCallbacks.push(draw);

  // Responsive redraw of paging control
  settings.tableElement.addEventListener('column-sizing.dt', draw);

  return host;
}

function pagingDraw(
  settings: ISettings,
  host: HTMLElement,
  buttons: number,
): void {
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
        return val === 'numbers' ? pagingNumbers(page, pages, buttons) : val;
      })
      .flat();

  var buttonEls: any[] = [];

  for (var i = 0; i < buttonArray.length; i++) {
    var button = buttonArray[i];

    var btnInfo = pagingButtonInfo(button, page, pages);
    var btn = renderPagingButton(
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
    btn.setAttribute('aria-controls', settings.tableId);
    btn.setAttribute('aria-disabled', btnInfo.disabled.toString());
    btn.setAttribute('aria-current', btnInfo.active ? 'page' : null);
    btn.setAttribute('aria-label', ariaLabel);
    btn.setAttribute('data-ct-idx', ariaLabel);
    btn.setAttribute('tabIndex', btnInfo.disabled ? '-1' : null);

    if (typeof button !== 'number') {
      btn.classList.add(button);
    }

    const action = button;
    bindActionWithData(btn, function (e: Event) {
      e.preventDefault();

      changePage(settings, action);
    });

    buttonEls.push(btn);
  }

  var activeEl = host.querySelector(':active') as HTMLElement;

  host.replaceChildren(...buttonEls);

  if (activeEl) {
    const idx = activeEl.dataset['ct-idx'];

    const focusEl = host.querySelector(`[data-ct-idx=${idx}]`) as HTMLElement;
    focusEl.focus();
  }
}

function renderPagingButton(
  buttonType: string,
  content: string,
  active: boolean,
  disabled: boolean,
): HTMLSpanElement | HTMLButtonElement {
  var btnClasses = ['ct-paging-button'];
  if (active) {
    btnClasses.push('current');
  }
  if (disabled) {
    btnClasses.push('disabled');
  }

  if (buttonType === 'ellipsis') {
    const btn = document.createElement('span');
    btn.classList.add('ellipsis');
    btn.innerHTML = content;

    return btn;
  } else {
    const btn = document.createElement('button');
    btn.classList.add(...btnClasses);
    btn.role = 'link';
    btn.type = 'button';
    btn.innerHTML = content;

    return btn;
  }
}

/**
 * Get properties for a button based on the current paging state of the table
 * @param button The button type in question
 * @param page Table's current page
 * @param pages Number of pages
 * @returns Info object
 */
function pagingButtonInfo(
  button: string | number,
  page: number,
  pages: number,
): { display: string; active: boolean; disabled: boolean } {
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
        o.display = formatNumber(button + 1);

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
 * @param page Current page
 * @param pages Total number of pages
 * @param buttons Target number of number buttons
 * @returns Buttons to show
 */
function pagingNumbers(page: number, pages: number, buttons: number): string[] {
  var numbers: any[] = [],
    half = Math.floor(buttons / 2),
    before = 2,
    after = 1;

  if (pages <= buttons) {
    numbers = range(0, pages);
  } else if (buttons === 1) {
    // Single button - current page only
    numbers = [page];
  } else if (buttons === 3) {
    // Special logic for just three buttons
    if (page <= 1) {
      numbers = [0, 1, 'ellipsis'];
    } else if (page >= pages - 2) {
      numbers = range(pages - 2, pages);
      numbers.unshift('ellipsis');
    } else {
      numbers = ['ellipsis', page, 'ellipsis'];
    }
  } else if (page <= half) {
    numbers = range(0, buttons - before);
    numbers.push('ellipsis');

    numbers.push(pages - 1);
  } else if (page >= pages - 1 - half) {
    numbers = range(pages - (buttons - before), pages);
    numbers.unshift('ellipsis');

    numbers.unshift(0);
  } else {
    numbers = range(page - half + before, page + half - after);
    numbers.push('ellipsis');
    numbers.unshift('ellipsis');

    numbers.push(pages - 1);
    numbers.unshift(0);
  }

  return numbers;
}

var __searchCounter = 0;

function renderSearch(settings: ISettings): HTMLDivElement {
  // Don't show the input if filtering isn't available on the table
  if (!settings.features.searching) {
    return null;
  }

  var tableId = settings.tableId;
  var previousSearch = settings.searchText;
  var input = '<input type="search" class="ct-input"/>';

  // We can put the <input> outside of the label if it is at the start or end
  // which helps improve accessability (not all screen readers like implicit
  // for elements).
  var str = '<label>Search:</label>_INPUT_';

  const filter = document.createElement('div');
  filter.classList.add('ct-search');
  filter.innerHTML = str.replace(/_INPUT_/, input);

  // add for and id to label and input
  filter
    .querySelector('label')!
    .setAttribute('for', 'ct-search-' + __searchCounter);
  filter
    .querySelector('input')!
    .setAttribute('id', 'ct-search-' + __searchCounter);
  __searchCounter++;

  var searchFn = function () {
    var val = this.value;

    /* Now do the filter */
    if (val != previousSearch) {
      previousSearch = val;

      filterComplete(settings, previousSearch);

      // Need to redraw, without resorting
      settings._displayStart = 0;
      draw(settings);
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
