/*! Capytable 0.1.0
 * © SpryMedia Ltd - datatables.net/license
 */

import './capytable.css';

// #region Capytable
class Capytable {
  constructor(id, options) {
    var element = document.getElementById(id);
    if (!element) {
      console.error('Element with id ' + id + ' not found');
      return;
    }

    // default options to empty
    if (options === undefined) {
      options = {};
    }

    var sId = element.getAttribute('id');

    /* Sanity check */
    if (element.nodeName.toLowerCase() != 'table') {
      _fnLog(
        null,
        'Non-table node initialisation (' + element.nodeName + ')',
        2,
      );
      return;
    }

    // make col group element
    const colGroupElement = document.createElement('colgroup');
    element.prepend(colGroupElement);

    /* Create the settings object for this table and set some of the default parameters */
    var oSettings = {
      ...Capytable.models.oSettings,
      tableId: sId,
      colgroup: colGroupElement,
    };

    oSettings.tableElement = element;

    // Need to add the instance after the instance after the settings object has been added
    // to the settings array, so we can self reference the table instance if more than one
    oSettings.instance = this;

    // Apply the defaults and init options to make a single init object will all
    // options defined from defaults and instance options.
    options = {
      ...options,
      searching: true,
      ordering: true,
      paging: true,
    };

    // Map the initialisation options onto the settings object
    ['paging', 'searching', 'ordering'].forEach((feature) => {
      if (options[feature] !== undefined) {
        oSettings.features[feature] = options[feature];
      }
    });

    element.classList.add('capytable');

    /*
     * Columns
     * See if we should load columns automatically or use defined ones
     */
    var thead = element.querySelector(':scope > thead');
    let initHeaderLength = detectHeaderLength(thead);

    // If we don't have a columns array, then generate one with nulls
    if (initHeaderLength === 0) {
      console.error('No columns defined in the table');
      return;
    }

    // Add the columns, apply the column definitions
    _fnAddColumns(oSettings, initHeaderLength);

    // Do a first pass on the sorting classes (allows any size changes to be taken into
    // account, and also will apply sorting disabled classes if disabled
    _fnSortingClasses(oSettings);
    oSettings.drawCallbacks.push(() => _fnSortingClasses(oSettings));

    /*
     * Table HTML init
     * Cache the header, body and footer as required, creating them if needed
     */
    if (!thead) {
      thead = document.createElement('thead');
      element.appendChild(thead);
    }
    oSettings.tHeadElement = thead;

    let tbody = element.querySelector(':scope > tbody');
    if (!tbody) {
      tbody = document.createElement('tbody');
      thead.insertAdjacentElement('afterend', tbody);
    }
    oSettings.tBodyElement = tbody;

    let tfoot = element.querySelector(':scope > tfoot');
    if (!tfoot) {
      // If we are a scrolling table, and no footer has been given, then we need to create
      // a tfoot element for the caption element to be appended to
      tfoot = document.createElement('tfoot');
      element.appendChild(tfoot);
    }
    oSettings.tFootElement = tfoot;

    // Initialisation complete - table can be drawn
    oSettings.initialized = true;

    // Language definitions
    _fnInitialise(oSettings);

    this.settings = oSettings;
  }
}
// #endregion

// #region core.internal.js

function _empty(d) {
  return !d || d === true || d === '-';
}

const _pluck = (arr, prop, prop2) => {
  return arr.reduce((out, item) => {
    if (prop2 !== undefined) {
      if (item && item[prop]) {
        out.push(item[prop][prop2]);
      }
    } else {
      if (item) {
        out.push(item[prop]);
      }
    }
    return out;
  }, []);
};

function _range(len, start) {
  var out = [];
  var end;

  if (start === undefined) {
    start = 0;
    end = len;
  } else {
    end = start;
    start = len;
  }

  for (var i = start; i < end; i++) {
    out.push(i);
  }

  return out;
}

function _search(str) {
  if (_empty(str) || typeof str !== 'string') {
    return str;
  }

  const _re_new_lines = /[\r\n\u2028]/g;

  str = str.replace(_re_new_lines, ' ');
  str = _normalize(str);

  return str;
}

// Replaceable function in api.util
function _stripHtml(input) {
  if (!input || typeof input !== 'string') {
    return input;
  }

  var previous;

  const _re_html = /<([^>]*>)/g;

  input = input.replace(_re_html, ''); // Complete tags

  // Safety for incomplete script tag - use do / while to ensure that
  // we get all instances
  do {
    previous = input;
    input = input.replace(/<script/i, '');
  } while (input !== previous);

  return previous;
}

// Remove diacritics from a string by decomposing it and then removing
// non-ascii characters
function _normalize(str) {
  if (typeof str !== 'string') {
    return str;
  }

  // It is faster to just run `normalize` than it is to check if
  // we need to with a regex!
  var res = str.normalize('NFD');

  // Equally, here we check if a regex is needed or not
  return res.length !== str.length ? res.replace(/[\u0300-\u036f]/g, '') : res;
}

/**
 * When rendering large numbers in the information element for the table
 * (i.e. "Showing 1 to 10 of 57 entries") Capytable will render large numbers
 * to have a comma separator for the 'thousands' units (e.g. 1 million is
 * rendered as "1,000,000") to help readability for the end user. This
 * function will override the default method Capytable uses.
 */
function _formatNumber(toFormat) {
  return toFormat.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function _formatString(a) {
  return _empty(a) && typeof a !== 'boolean'
    ? ''
    : typeof a === 'string'
      ? a.toLowerCase()
      : !a.toString
        ? ''
        : a.toString();
}

/**
 * Throttle the calls to a function. Arguments and context are maintained
 * for the throttled function.
 *
 * @param {function} fn Function to be called
 * @return {function} Wrapped function
 */
function _throttle(fn) {
  var frequency = 200,
    last,
    timer;

  return function () {
    var that = this,
      now = +new Date(),
      args = arguments;

    if (last && now < last + frequency) {
      clearTimeout(timer);

      timer = setTimeout(function () {
        last = undefined;
        fn.apply(that, args);
      }, frequency);
    } else {
      last = now;
      fn.apply(that, args);
    }
  };
}

// #endregion
// #region core.columns.js

/**
 * Add columns to the list used for the table with default values
 *  @param {object} oSettings Capytable settings object
 *  @memberof Capytable#oApi
 */
function _fnAddColumns(oSettings, length) {
  for (let i = 0; i < length; i++) {
    // Add column to columns array
    var iCol = oSettings.columns.length;

    const colElement = document.createElement('col');
    colElement.setAttribute('data-dt-column', iCol);

    var oCol = {
      ...Capytable.models.oColumn,
      idx: iCol,
      colElement: colElement,
    };
    oSettings.columns.push(oCol);

    /* Feature sorting overrides column specific when off */
    if (!oSettings.features.ordering) {
      oCol.orderable = false;
    }
  }
}

/**
 * Adjust the table column widths for new data. Note: you would probably want to
 * do a redraw after calling this function!
 *  @param {object} settings Capytable settings object
 *  @memberof Capytable#oApi
 */
function _fnAdjustColumnSizing(settings) {
  _fnCalculateColumnWidths(settings);

  var cols = settings.columns;

  for (var i = 0; i < cols.length; i++) {
    var width = _fnColumnsSumWidth(settings, [i], false);

    // Need to set the min-width, otherwise the browser might try to collapse
    // it further
    cols[i].colElement.style.width = width;
    cols[i].colElement.style.minWidth = width;
  }

  _fnCallbackFire(settings, null, 'column-sizing', [settings]);
}

/**
 * Get the number of visible columns
 *  @param {object} oSettings Capytable settings object
 *  @returns {int} i the number of visible columns
 *  @memberof Capytable#oApi
 */
function _fnVisibleColumns(settings) {
  var layout = settings.header;
  var vis = 0;

  if (layout.length) {
    for (var i = 0, ien = layout[0].length; i < ien; i++) {
      if (layout[0][i].style.display !== 'none') {
        vis++;
      }
    }
  }

  return vis;
}

/**
 * Get the width for a given set of columns
 *
 * @param {*} settings Capytable settings object
 * @param {*} targets Columns - comma separated string or array of numbers
 * @param {*} original Use the original width (true) or calculated (false)
 * @returns Combined CSS value
 */
function _fnColumnsSumWidth(settings, targets, original) {
  if (!Array.isArray(targets)) {
    targets = _fnColumnsFromHeader(targets);
  }

  var sum = 0;
  var unit;
  var columns = settings.columns;

  for (let i = 0; i < targets.length; i++) {
    var column = columns[targets[i]];
    var definedWidth = original ? column.originalWidth : column.width;

    if (definedWidth === null || definedWidth === undefined) {
      return null; // can't determine a defined width - browser defined
    } else if (typeof definedWidth === 'number') {
      unit = 'px';
      sum += definedWidth;
    } else {
      var matched = definedWidth.match(/([\d\.]+)([^\d]*)/);

      if (matched) {
        sum += matched[1] * 1;
        unit = matched.length === 3 ? matched[2] : 'px';
      }
    }
  }

  return sum + unit;
}

function _fnColumnsFromHeader(cell) {
  const attr = cell.closest('[data-dt-column]').getAttribute('data-dt-column');

  if (!attr) {
    return [];
  }

  return attr.split(',').map((val) => val * 1);
}

// #endregion
// #region core.data.js

/**
 * Add one or more TR elements to the table. Generally we'd expect to
 * use this for reading data from a DOM sourced table, but it could be
 * used for an TR element. Note that if a TR is given, it is used (i.e.
 * it is not cloned).
 *  @param {object} settings Capytable settings object
 *  @param {array|node|jQuery} trs The TR element(s) to add to the table
 *  @returns {array} Array of indexes for the added rows
 *  @memberof Capytable#oApi
 */
function _fnAddTr(settings) {
  const trs = [...settings.tBodyElement.querySelectorAll(':scope > tr')];

  return trs.map(function (tr) {
    const tds = [];
    const data = [];

    let i = 0;
    let td = tr.firstChild;
    while (td) {
      const name = td.nodeName.toUpperCase();

      if (name == 'TD' || name == 'TH') {
        const contents = td.innerHTML.trim();

        data[i] = contents;
        i++;

        tds.push(td);
      }

      td = td.nextSibling;
    }

    /* Create the object for storing information about this new row */
    var rowIdx = settings.data.length;

    var rowModel = {
      ...Capytable.models.oRow,
      idx: rowIdx,
      _data: data,
    };

    settings.data.push(rowModel);

    /* Add to the display array */
    settings.displayMaster.push(rowIdx);

    /* Create the DOM information, or register it if already present */
    if (tr) {
      _fnCreateTr(settings, rowIdx, tr, tds);
    }

    return rowIdx;
  });
}

/**
 * Get the data for a given cell from the internal cache, taking into account data mapping
 *  @param {object} settings Capytable settings object
 *  @param {int} rowIdx data row id
 *  @param {int} colIdx Column index
 *  @param {string} type data get type ('display', 'type' 'filter|search' 'sort|order')
 *  @returns {*} Cell data
 *  @memberof Capytable#oApi
 */
function _fnGetCellData(settings, rowIdx, colIdx, type) {
  var row = settings.data[rowIdx];
  if (!row) {
    return undefined;
  }

  var col = settings.columns[colIdx];
  var rowData = row._data;
  var cellData = rowData[col.idx];

  // Allow for a node being returned for non-display types
  if (
    type !== 'display' &&
    cellData &&
    typeof cellData === 'object' &&
    cellData.nodeName
  ) {
    cellData = cellData.innerHTML;
  }

  if (cellData === undefined) {
    _fnLog(
      settings,
      'Requested unknown parameter ' +
        (typeof col.idx == 'function' ? '{function}' : "'" + col.idx + "'") +
        ' for row ' +
        rowIdx +
        ', column ' +
        colIdx,
      4,
    );

    return null;
  }

  if (cellData === null && type === 'display') {
    return '';
  }

  if (type === 'filter') {
    cellData = _search(cellData);
  }

  return cellData;
}

// #endregion
// #region core.draw.js

/**
 * Render and cache a row's display data for the columns, if required
 * @returns
 */
function _fnGetRowDisplay(settings, rowIdx) {
  let rowModal = settings.data[rowIdx];
  let columns = settings.columns;

  if (!rowModal.displayData) {
    // Need to render and cache
    rowModal.displayData = [];

    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      rowModal.displayData.push(
        _fnGetCellData(settings, rowIdx, colIdx, 'display'),
      );
    }
  }

  return rowModal.displayData;
}

/**
 * Create a new TR element (and it's TD children) for a row
 *  @param {object} oSettings Capytable settings object
 *  @param {int} iRow Row to consider
 *  @param {node} [nTrIn] TR element to add to the table - optional. If not given,
 *    Capytable will create a row automatically
 *  @param {array} [anTds] Array of TD|TH elements for the row - must be given
 *    if trElement is.
 *  @memberof Capytable#oApi
 */
function _fnCreateTr(oSettings, iRow, trElement, anTds) {
  var row = oSettings.data[iRow],
    cells = [],
    nTd;

  if (row.trElement !== null) {
    return;
  }

  row.trElement = trElement;
  row.cells = cells;

  /* Use a private property on the node to allow reserve mapping from the node
   * to the data array for fast look up
   */
  trElement._DT_RowIndex = iRow;

  /* Special parameters can be given by the data source to be used on the row */
  var tr = row.trElement;

  if (tr) {
    var data = row._data;
    var id = data['DT_RowId'];

    if (id) {
      tr.id = id;
    }
  }

  /* Process each column */
  for (let i = 0; i < oSettings.columns.length; i++) {
    nTd = anTds[i];

    if (!nTd) {
      _fnLog(oSettings, 'Incorrect column count', 18);
    }

    nTd._DT_CellIndex = {
      row: iRow,
      column: i,
    };

    cells.push(nTd);
  }
}

/**
 * Create the HTML header for the table
 *  @param {object} oSettings Capytable settings object
 *  @memberof Capytable#oApi
 */
function _fnBuildHeader(settings) {
  var columns = settings.columns;
  var target = settings.tHeadElement;

  // Footer might be defined
  if (!target) {
    return;
  }

  // If no cells yet and we have content for them, then create
  const row = [...target.querySelectorAll('tr')];

  // Add a tr if needed
  if (!row.length) {
    const tr = document.createElement('tr');
    target.appendChild(tr);

    row.push(tr);
  }

  // Add the number of cells needed to make up to the number of columns
  if (row.length === 1) {
    const cells = [...row[0].querySelectorAll('th, td')];

    for (let i = cells.length; i < columns.length; i++) {
      const cell = document.createElement('th');
      cell.innerHTML = columns[i]['title'] || '';
      row.appendChild(cell);
    }
  }

  settings.header = _fnDetectHeader(settings, target);

  // ARIA role for the rows
  [...target.querySelectorAll(':scope > tr')].forEach((el) =>
    el.setAttribute('role', 'row'),
  );

  // Every cell needs to be passed through the renderer
  [...target.querySelectorAll(':scope > tr > th')].forEach((el, i) =>
    _fnRenderHeader(settings, el, i),
  );

  _fnDrawHead(settings.header);
}

function _fnRenderHeader(settings, cell, idx) {
  if (!settings.features.ordering) {
    cell.classList.add('dt-orderable-none');
  }

  // No additional mark-up required
  // Attach a sort listener to update on sort - note that using the
  // `DT` namespace will allow the event to be removed automatically
  // on destroy, while the `dt` namespaced event is the one we are
  // listening for
  settings.tableElement.addEventListener('order.dt', function () {
    var sorting = settings.order;

    if (!sorting) {
      return;
    }

    cell.classList.remove('dt-ordering-asc', 'dt-ordering-desc');
    cell.classList.add('dt-orderable-asc');
    cell.classList.add('dt-orderable-desc');

    // Determine if all of the columns that this cell covers are included in the
    // current ordering
    var isOrdering = idx === sorting[0];

    if (isOrdering) {
      if (sorting[1] === 'asc') {
        cell.classList.add('dt-ordering-asc');
      } else if (sorting[1] === 'desc') {
        cell.classList.add('dt-ordering-desc');
      }
    }
  });
}

function _fnBuildFooter(settings) {
  var columns = settings.columns;
  var target = settings.tFootElement;

  // Footer might be defined
  if (!target) {
    return;
  }

  // If no cells yet and we have content for them, then create
  if (_pluck(settings.columns, 'footer').join('')) {
    const row = [...target.querySelectorAll('tr')];

    // Add a tr if needed
    if (!row.length) {
      const tr = document.createElement('tr');
      target.appendChild(tr);

      row.push(tr);
    }

    // Add the number of cells needed to make up to the number of columns
    if (row.length === 1) {
      const cells = [...row[0].querySelectorAll('th, td')];

      for (let i = cells.length; i < columns.length; i++) {
        const cell = document.createElement('th');
        cell.innerHTML = columns[i]['footer'] || '';
        row.appendChild(cell);
      }
    }
  }

  settings.footer = _fnDetectHeader(settings, target);

  // ARIA role for the rows
  [...target.querySelectorAll(':scope > tr')].forEach((el) =>
    el.setAttribute('role', 'row'),
  );

  // Every cell needs to be passed through the renderer

  // TODO: add back footer rendering
  // [...target.querySelectorAll(':scope > tr > th, :scope > tr > td')]
  // 	.forEach(el => _fnRenderer('footer')(settings, el));

  _fnDrawHead(settings.footer);
}

/**
 * Draw the header (or footer) element based on the column visibility states.
 *
 *  @param object oSettings Capytable settings object
 *  @param array aoSource Layout array from _fnDetectHeader
 *  @memberof Capytable#oApi
 */
function _fnDrawHead(source) {
  if (!source) {
    return;
  }

  for (let row = 0; row < source.length; row++) {
    const tr = source[row].row;

    for (let column = 0; column < source[row].length; column++) {
      const point = source[row][column];

      if (point) {
        tr.appendChild(point);
      }
    }
  }
}

/**
 * Insert the required TR nodes into the table for display
 *  @param {object} oSettings Capytable settings object
 *  @memberof Capytable#oApi
 */
function _fnDraw(oSettings) {
  var anRows = [];
  var iRowCount = 0;
  var aiDisplay = oSettings.display;
  var iDisplayStart = oSettings._displayStart;
  var iDisplayEnd = oSettings.displayEnd();
  var body = oSettings.tBodyElement;

  if (aiDisplay.length !== 0) {
    var iStart = iDisplayStart;
    var iEnd = iDisplayEnd;

    for (var j = iStart; j < iEnd; j++) {
      var iDataIndex = aiDisplay[j];
      var data = oSettings.data[iDataIndex];

      var nRow = data.trElement;

      anRows.push(nRow);
      iRowCount++;
    }
  } else {
    anRows[0] = _emptyRow(oSettings);
  }

  body.replaceChildren(...anRows);

  // Empty table needs a specific class
  if (!oSettings.tFootElement.querySelector('tr')) {
    oSettings.wrapperElement.classList.add('dt-empty-footer');
  } else {
    oSettings.wrapperElement.classList.remove('dt-empty-footer');
  }

  /* Call all required callback functions for the end of a draw */
  _fnCallbackFire(oSettings, 'drawCallbacks', 'draw', [oSettings], true);
}

/**
 * Redraw the table - taking account of the various features which are enabled
 *  @param {object} oSettings Capytable settings object
 *  @param {boolean} [holdPosition] Keep the current paging position. By default
 *    the paging is reset to the first page
 *  @memberof Capytable#oApi
 */
function _fnReDraw(settings, recompute = true) {
  const features = settings.features;

  if (recompute) {
    if (features.ordering) {
      _fnSort(settings);
    }

    if (features.searching) {
      _fnFilterComplete(settings, settings.searchText);
    } else {
      // No filtering, so we want to just use the display master
      settings.display = settings.displayMaster.slice();
    }
  }

  settings._displayStart = 0;

  _fnDraw(settings);
}

/*
 * Table is empty - create a row with an empty message in it
 */
function _emptyRow(settings) {
  let zeroVerbiage = 'No matching records found';

  if (settings.total() === 0) {
    zeroVerbiage = 'No data available in table';
  }

  const td = document.createElement('td');
  td.setAttribute('colSpan', _fnVisibleColumns(settings));
  td.className = 'dt-empty';
  td.innerHTML = zeroVerbiage;

  const tr = document.createElement('tr');
  tr.appendChild(td);

  return tr;
}

/**
 * Add the options to the page HTML for the table
 *  @param {object} settings Capytable settings object
 *  @memberof Capytable#oApi
 */
function _fnAddOptionsHtml(settings) {
  const table = settings.tableElement;

  // Wrapper div around everything Capytable controls
  const container = document.createElement('div');
  container.id = settings.tableId + '_wrapper';
  container.className = 'dt-container';
  table.parentNode.insertBefore(container, table);

  settings.wrapperElement = container;

  // top row
  const topRow = _fnRenderLayoutRow();

  const pageLength = _renderFeature(settings, 'pageLength');
  pageLength.className = 'dt-layout-cell dt-layout-start';
  topRow.appendChild(pageLength);

  const search = _renderFeature(settings, 'search');
  search.className = 'dt-layout-cell dt-layout-end';
  topRow.appendChild(search);

  // middle row
  const middleRow = _fnRenderLayoutRow(true);

  const div = document.createElement('div');
  div.className = 'dt-layout-cell dt-layout-full';
  div.appendChild(settings.tableElement);
  middleRow.appendChild(div);

  // bottom row
  const bottomRow = _fnRenderLayoutRow();

  const info = _renderFeature(settings, 'info');
  info.className = 'dt-layout-cell dt-layout-start';
  bottomRow.appendChild(info);

  const paging = _renderFeature(settings, 'paging');
  paging.className = 'dt-layout-cell dt-layout-end';
  bottomRow.appendChild(paging);

  // add rows to container
  container.appendChild(topRow);
  container.appendChild(middleRow);
  container.appendChild(bottomRow);
}

function _fnRenderLayoutRow(isTable) {
  const row = document.createElement('div');
  row.className = 'dt-layout-row';

  if (isTable) {
    row.className += 'dt-layout-table';
  }

  return row;
}

function detectHeaderLength(thead) {
  const rows = [...thead.querySelectorAll(':scope > tr')];
  if (!rows) {
    return 0;
  }

  let length = 0;

  const row = rows[0];

  // For every cell in the row..
  let cell = row.firstChild;
  while (cell) {
    if (cell.nodeName.toUpperCase() == 'TH') {
      length++;
    }

    cell = cell.nextSibling;
  }

  return length;
}

/**
 * Use the DOM source to create up an array of header cells. The idea here is to
 * create a layout grid (array) of rows x columns, which contains a reference
 * to the cell that that point in the grid (regardless of col/rowspan), such that
 * any column / row could be removed and the new grid constructed
 *  @param {node} thead The header/footer element for the table
 *  @returns {array} Calculated layout array
 *  @memberof Capytable#oApi
 */
function _fnDetectHeader(settings, thead) {
  var columns = settings.columns;
  var rows = thead.querySelectorAll(':scope > tr');
  var row, cell;
  var isHeader = thead && thead.nodeName.toLowerCase() === 'thead';
  var layout = [];

  // We know how many rows there are in the layout - so prep it
  for (let i = 0; i < rows.length; i++) {
    layout.push([]);
  }

  for (let i = 0; i < rows.length; i++) {
    row = rows[i];
    let column = 0;

    // For every cell in the row..
    cell = row.firstChild;
    while (cell) {
      if (cell.nodeName.toUpperCase() == 'TH') {
        // Perform header setup
        // Get the width for the column. This can be defined from the
        // width attribute, style attribute or `columns.width` option
        var columnDef = columns[column];
        var width = cell.getAttribute('width') || null;
        var t = cell.style.width.match(/width:\s*(\d+[pxem%]+)/);
        if (t) {
          width = t[1];
        }

        columnDef.originalWidth = columnDef.width || width;

        // Wrap the column title so we can write to it in future
        if (!cell.querySelector('span.dt-column-title')) {
          const span = document.createElement('span');
          span.classList.add('dt-column-title');
          span.replaceChildren(...cell.childNodes);
          cell.appendChild(span);
        }

        if (isHeader && !cell.querySelector('span.dt-column-order')) {
          const span = document.createElement('span');
          span.classList.add('dt-column-order');
          cell.appendChild(span);
        }

        // If there is col / rowspan, copy the information into the layout grid
        layout[i][column] = cell;

        layout[i].row = row;

        cell.setAttribute('data-dt-column', column);

        column++;
      }

      cell = cell.nextSibling;
    }
  }

  return layout;
}

// #endregion
// #region core.filter.js

/**
 * Filter the table using both the global filter and column based filtering
 *  @param {object} settings Capytable settings object
 *  @param {string} search filter string
 *  @memberof Capytable#oApi
 */
function _fnFilterComplete(settings, search) {
  // Check if any of the rows were invalidated
  _fnFilterData(settings);

  // Start from the full data set
  settings.display = settings.displayMaster.slice();

  const searchRows = settings.display;

  if (search === '') {
    return;
  }

  var i = 0;
  var matched = [];

  // Then for each row, does the test pass. If not, lop the row from the array
  for (i = 0; i < searchRows.length; i++) {
    var row = settings.data[searchRows[i]];
    var data = row._filterRow;

    if (data.includes(search)) {
      matched.push(searchRows[i]);
    }
  }

  // Mutate the searchRows array
  searchRows.length = matched.length;

  for (i = 0; i < matched.length; i++) {
    searchRows[i] = matched[i];
  }

  _fnCallbackFire(settings, null, 'search', [settings]);
}

var __filter_div = document.createElement('div');
var __filter_div_textContent = __filter_div.textContent !== undefined;

// Update the filtering data for each row if needed (by invalidation or first run)
function _fnFilterData(settings) {
  var columns = settings.columns;
  var data = settings.data;
  var column;
  var filterData, cellData, row;
  var wasInvalidated = false;

  for (var rowIdx = 0; rowIdx < data.length; rowIdx++) {
    if (!data[rowIdx]) {
      continue;
    }

    row = data[rowIdx];

    if (!row._filterData) {
      filterData = [];

      for (let j = 0; j < columns.length; j++) {
        column = columns[j];

        if (column.searchable) {
          cellData = _fnGetCellData(settings, rowIdx, j, 'filter');

          // Search in Capytable is string based
          if (cellData === null) {
            cellData = '';
          }

          if (typeof cellData !== 'string' && cellData.toString) {
            cellData = cellData.toString();
          }
        } else {
          cellData = '';
        }

        // If it looks like there is an HTML entity in the string,
        // attempt to decode it so sorting works as expected. Note that
        // we could use a single line of jQuery to do this, but the DOM
        // method used here is much faster https://jsperf.com/html-decode
        if (cellData.indexOf && cellData.indexOf('&') !== -1) {
          __filter_div.innerHTML = cellData;
          cellData = __filter_div_textContent
            ? __filter_div.textContent
            : __filter_div.innerText;
        }

        if (cellData.replace) {
          cellData = cellData.replace(/[\r\n\u2028]/g, '');
        }

        filterData.push(cellData);
      }

      row._filterData = filterData;
      row._filterRow = filterData.join('  ');
      wasInvalidated = true;
    }
  }

  return wasInvalidated;
}

// #endregion
// #region core.init.js

/**
 * Draw the table for the first time, adding all required features
 *  @param {object} settings Capytable settings object
 *  @memberof Capytable#oApi
 */
function _fnInitialise(settings) {
  // Build the header / footer for the table
  _fnBuildHeader(settings);
  _fnBuildFooter(settings);

  // Grab the data from the page
  _fnAddTr(settings);

  // Filter not yet applied - copy the display master
  settings.display = settings.displayMaster.slice();

  // Enable features
  _fnAddOptionsHtml(settings);

  _fnSortInit(settings);

  _colGroup(settings);

  // If there is default sorting required - let's do it. The sort function
  // will do the drawing for us. Otherwise we draw the table regardless of the
  // Ajax source - this allows the table to look initialised for Ajax sourcing
  // data (show 'loading' message possibly)
  _fnReDraw(settings);

  settings._initComplete = true;

  // Table is fully set up and we have data, so calculate the
  // column widths
  _fnAdjustColumnSizing(settings);
}

// #endregion
// #region core.length.js

function _fnLengthChange(settings, val) {
  var len = parseInt(val, 10);
  settings._displayLength = len;

  var start = settings._displayStart,
    end = settings.displayEnd(),
    len = settings._displayLength;

  /* If we have space to show extra rows (backing up from the end point - then do so */
  if (start >= end) {
    start = end - len;
  }

  // Keep the start record on the current page
  start -= start % len;

  if (len === -1 || start < 0) {
    start = 0;
  }

  settings._displayStart = start;

  // Fire length change event
  _fnCallbackFire(settings, null, 'length', [settings, len]);
}

// #endregion
// #region core.page.js

/**
 * Alter the display settings to change the page
 *  @param {object} settings Capytable settings object
 *  @param {string|int} action Paging action to take: "first", "previous",
 *    "next" or "last" or page number to jump to (integer)
 *  @param [bool] redraw Automatically draw the update or not
 *  @returns {bool} true page has changed, false - no change
 *  @memberof Capytable#oApi
 */
function _fnPageChange(settings, action) {
  var start = settings._displayStart,
    len = settings._displayLength,
    records = settings.totalDisplayed();

  if (records === 0 || len === -1) {
    start = 0;
  } else if (typeof action === 'number') {
    start = action * len;

    if (start > records) {
      start = 0;
    }
  } else if (action == 'first') {
    start = 0;
  } else if (action == 'previous') {
    start = len >= 0 ? start - len : 0;

    if (start < 0) {
      start = 0;
    }
  } else if (action == 'next') {
    if (start + len < records) {
      start += len;
    }
  } else if (action == 'last') {
    start = Math.floor((records - 1) / len) * len;
  } else if (action === 'ellipsis') {
    return;
  } else {
    _fnLog(settings, 'Unknown paging action: ' + action, 5);
  }

  var changed = settings._displayStart !== start;
  settings._displayStart = start;

  _fnCallbackFire(settings, null, changed ? 'page' : 'page-nc', [settings]);

  if (changed) {
    _fnDraw(settings);
  }

  return changed;
}

// #endregion
// #region core.sizing.js

/**
 * Calculate the width of columns for the table
 *  @param {object} settings Capytable settings object
 *  @memberof Capytable#oApi
 */
function _fnCalculateColumnWidths(settings) {
  var table = settings.tableElement,
    columns = settings.columns,
    visibleColumns = _range(columns.length),
    tableWidthAttr = table.getAttribute('width'), // from DOM element
    tableContainer = table.parentNode,
    columnIdx;

  var styleWidth = table.style.width;

  // If there is no width applied as a CSS style or as an attribute, we assume that
  // the width is intended to be 100%, which is usually is in CSS, but it is very
  // difficult to correctly parse the rules to get the final result.
  if (!styleWidth && !tableWidthAttr) {
    table.style.width = '100%';
    styleWidth = '100%';
  }

  if (styleWidth && styleWidth.indexOf('%') !== -1) {
    tableWidthAttr = styleWidth;
  }

  // Construct a single row, worst case, table with the widest
  // node in the data, assign any user defined widths, then insert it into
  // the DOM and allow the browser to do all the hard work of calculating
  // table widths
  var tmpTable = table.cloneNode();
  tmpTable.style.visibility = 'hidden';
  tmpTable.removeAttribute('id');

  // Clean up the table body
  const tr = document.createElement('tr');
  const tbody = document.createElement('tbody');

  tbody.appendChild(tr);
  tmpTable.appendChild(tbody);

  // Clone the table header and footer - we can't use the header / footer
  // from the cloned table, since if scrolling is active, the table's
  // real header and footer are contained in different table tags
  tmpTable.appendChild(settings.tHeadElement.cloneNode(true));
  tmpTable.appendChild(settings.tFootElement.cloneNode(true));

  // Remove any assigned widths from the footer (from scrolling)
  [...tmpTable.querySelectorAll('tfoot th, tfoot td')].forEach(
    (el) => (el.style.width = ''),
  );

  // Apply custom sizing to the cloned header
  [...tmpTable.querySelectorAll('thead th, thead td')].forEach(
    (el) =>
      function () {
        // Get the `width` from the header layout
        var width = _fnColumnsSumWidth(settings, el, true);

        if (width) {
          // Need to set the width and min-width, otherwise the browser
          // will attempt to collapse the table beyond want might have
          // been specified
          el.style.width = width;
          this.style.minWidth = width;
        } else {
          el.style.width = '';
        }
      },
  );

  // Find the widest piece of data for each column and put it into the table
  for (let i = 0; i < visibleColumns.length; i++) {
    columnIdx = visibleColumns[i];

    var longest = _fnGetMaxLenString(settings, columnIdx);
    var text = longest;
    var insert =
      longest.indexOf('<') === -1 ? document.createTextNode(text) : text;

    const td = document.createElement('td');
    td.appendChild(insert);
    tr.appendChild(td);
  }

  // Tidy the temporary table - remove name attributes so there aren't
  // duplicated in the dom (radio elements for example)
  tmpTable
    .querySelectorAll('[name]')
    .forEach((el) => el.removeAttribute('name'));

  // Table has been built, attach to the document so we can work with it.
  // A holding element is used, positioned at the top of the container
  // with minimal height, so it has no effect on if the container scrolls
  // or not. Otherwise it might trigger scrolling when it actually isn't
  // needed
  const holder = document.createElement('div');
  holder.appendChild(tmpTable);
  tableContainer.appendChild(holder);

  // When scrolling (X or Y) we want to set the width of the table as
  // appropriate. However, when not scrolling leave the table width as it
  // is. This results in slightly different, but I think correct behaviour
  if (tableWidthAttr) {
    tmpTable.style.width = tableWidthAttr;
  }

  // Get the width of each column in the constructed table
  var total = 0;
  var bodyCells = [...tmpTable.querySelector('tbody tr').children];

  for (let i = 0; i < visibleColumns.length; i++) {
    // Use getBounding for sub-pixel accuracy, which we then want to round up!
    var bounding = bodyCells[i].getBoundingClientRect().width;

    // Total is tracked to remove any sub-pixel errors as the outerWidth
    // of the table might not equal the total given here
    total += bounding;

    // Width for each column to use
    columns[visibleColumns[i]].width = _fnStringToCss(bounding);
  }

  table.style.width = _fnStringToCss(total);

  // Finished with the table - ditch it
  holder.remove();

  // If there is a width attr, we want to attach an event listener which
  // allows the table sizing to automatically adjust when the window is
  // resized. Use the width attr rather than CSS, since we can't know if the
  // CSS is a relative value or absolute - DOM read is always px.
  if (tableWidthAttr) {
    table.style.width = _fnStringToCss(tableWidthAttr);
  }

  if (tableWidthAttr && !settings._reszEvt) {
    window.addEventListener(
      'resize',
      _throttle(() => _fnAdjustColumnSizing(settings)),
    );
    settings._reszEvt = true;
  }
}

/**
 * Get the maximum strlen for each data column
 *  @param {object} settings Capytable settings object
 *  @param {int} colIdx column of interest
 *  @returns {string} string of the max length
 *  @memberof Capytable#oApi
 */
function _fnGetMaxLenString(settings, colIdx) {
  var column = settings.columns[colIdx];

  if (!column.maxLenString) {
    var s,
      max = '',
      maxLen = -1;

    for (var i = 0, ien = settings.displayMaster.length; i < ien; i++) {
      var rowIdx = settings.displayMaster[i];
      var data = _fnGetRowDisplay(settings, rowIdx)[colIdx];

      var cellString =
        data && typeof data === 'object' && data.nodeType
          ? data.innerHTML
          : data + '';

      // Remove id / name attributes from elements so they
      // don't interfere with existing elements
      cellString = cellString
        .replace(/id=".*?"/g, '')
        .replace(/name=".*?"/g, '');

      s = _stripHtml(cellString).replace(/&nbsp;/g, ' ');

      if (s.length > maxLen) {
        // We want the HTML in the string, but the length that
        // is important is the stripped string
        max = cellString;
        maxLen = s.length;
      }
    }

    column.maxLenString = max;
  }

  return column.maxLenString;
}

/**
 * Append a CSS unit (only if required) to a string
 *  @param {string} value to css-ify
 *  @returns {string} value with css unit
 *  @memberof Capytable#oApi
 */
function _fnStringToCss(s) {
  if (s === null) {
    return '0px';
  }

  if (typeof s == 'number') {
    return s < 0 ? '0px' : s + 'px';
  }

  // Check it has a unit character already
  return s.match(/\d$/) ? s + 'px' : s;
}

/**
 * Re-insert the `col` elements for current visibility
 *
 * @param {*} settings DT settings
 */
function _colGroup(settings) {
  var cols = settings.columns;

  settings.colgroup.innerHTML = '';

  for (let i = 0; i < cols.length; i++) {
    settings.colgroup.appendChild(cols[i].colElement);
  }
}
// #endregion
// #region core.sort.js

function _fnSortInit(settings) {
  const notSelector =
    ':not([data-dt-order="disable"]):not([data-dt-order="icon-only"])';
  const selector = `tr${notSelector} th${notSelector}, tr${notSelector} td${notSelector}`;

  // Click event handler to add / remove sorting
  _fnBindAction(settings.tHeadElement, selector, function (e) {
    let run = false;
    const idx = _fnColumnsFromHeader(e.target)[0];

    var ret = _fnSortAdd(settings, idx);

    if (ret !== false) {
      run = true;
    }

    if (run) {
      _fnSort(settings);
      _fnSortDisplay(settings, settings.display);

      _fnReDraw(settings, false);
    }
  });
}

/**
 * Sort the display array to match the master's order
 * @param {*} settings
 */
function _fnSortDisplay(settings, display) {
  if (display.length < 2) {
    return;
  }

  var master = settings.displayMaster;
  var masterMap = {};
  var map = {};

  // Rather than needing an `indexOf` on master array, we can create a map
  for (let i = 0; i < master.length; i++) {
    masterMap[master[i]] = i;
  }

  // And then cache what would be the indexOf fom the display
  for (let i = 0; i < display.length; i++) {
    map[display[i]] = masterMap[display[i]];
  }

  display.sort(function (a, b) {
    // Short version of this function is simply `master.indexOf(a) - master.indexOf(b);`
    return map[a] - map[b];
  });
}

/**
 * Change the order of the table
 *  @param {object} oSettings Capytable settings object
 *  @memberof Capytable#oApi
 */
function _fnSort(oSettings) {
  var aiOrig = [],
    data = oSettings.data,
    displayMaster = oSettings.displayMaster;

  // Allow a specific column to be sorted, which will _not_ alter the display
  // master
  const aSort = oSettings.order;

  if (aSort) {
    // Load the data needed for the sort, for each cell
    _fnSortData(oSettings, aSort[0]);

    // Reset the initial positions on each pass so we get a stable sort
    for (let i = 0; i < displayMaster.length; i++) {
      aiOrig[i] = i;
    }

    // If the first sort is desc, then reverse the array to preserve original
    // order, just in reverse
    if (aSort[1] === 'desc') {
      aiOrig.reverse();
    }

    /* Do the sort - here we want multi-column sorting based on a given data source (column)
     * and sorting function (from oSort) in a certain direction. It's reasonably complex to
     * follow on it's own, but this is what we want (example two column sorting):
     *  fnLocalSorting = function(a,b){
     *    var test;
     *    test = oSort['string-asc']('data11', 'data12');
     *      if (test !== 0)
     *        return test;
     *    test = oSort['numeric-desc']('data21', 'data22');
     *    if (test !== 0)
     *      return test;
     *    return oSort['numeric-asc']( aiOrig[a], aiOrig[b] );
     *  }
     * Basically we have a test for each sorting column, if the data in that column is equal,
     * test the next column. If all columns match, then we use a numeric sort on the row
     * positions in the original data array to provide a stable sort.
     */
    displayMaster.sort(function (a, b) {
      const dataA = data[a]._sortData;
      const dataB = data[b]._sortData;

      // Data, which may have already been through a `-pre` function
      let x = dataA[aSort[0]];
      let y = dataB[aSort[0]];

      const test = x < y ? -1 : x > y ? 1 : 0;

      if (test !== 0) {
        return aSort[1] === 'asc' ? test : -test;
      }

      x = aiOrig[a];
      y = aiOrig[b];

      return x < y ? -1 : x > y ? 1 : 0;
    });
  }

  _fnCallbackFire(oSettings, null, 'order', [oSettings, aSort]);

  return displayMaster;
}

/**
 * Function to run on user sort request
 *  @param {object} settings Capytable settings object
 *  @param {int} colIdx column sorting index
 *  @memberof Capytable#oApi
 */
function _fnSortAdd(settings, colIdx) {
  var col = settings.columns[colIdx];
  var sorting = settings.order;
  var nextSortIdx;
  var next = function (a) {
    var idx = a._idx;
    if (idx === undefined) {
      idx = settings.orderSequence.indexOf(a[1]);
    }

    return idx + 1 < settings.orderSequence.length ? idx + 1 : 0;
  };

  if (!col.orderable) {
    return false;
  }

  // If appending the sort then we are multi-column sorting
  if (sorting && sorting[0] == colIdx) {
    // Single column - already sorting on this column, modify the sort
    nextSortIdx = next(sorting);

    sorting[1] = settings.orderSequence[nextSortIdx];
    sorting._idx = nextSortIdx;
  } else {
    // Single column - sort only on this column
    sorting = [colIdx, settings.orderSequence[0]];
    sorting._idx = 0;
  }

  settings.order = sorting;
}

/**
 * Set the sorting classes on table's body, Note: it is safe to call this function
 * when bSort and bSortClasses are false
 *  @param {object} oSettings Capytable settings object
 *  @memberof Capytable#oApi
 */
function _fnSortingClasses(settings) {
  const oldSort = settings.lastOrder;
  const sort = settings.order;

  if (settings.features.ordering) {
    // Remove old sorting classes
    if (oldSort) {
      // Remove column sorting
      _pluck(settings.data, 'cells', oldSort[0]).forEach((cell) =>
        cell.classList.remove('sorting_1'),
      );
    }

    // Add new column sorting
    if (sort) {
      _pluck(settings.data, 'cells', sort[0]).forEach((cell) =>
        cell.classList.remove('sorting_1'),
      );
    }
  }

  settings.lastOrder = sort;
}

// Get the data to sort a column, be it from cache, fresh (populating the
// cache), or from a sort formatter
function _fnSortData(settings, colIdx) {
  // Use / populate cache
  var row, cellData;

  var data = settings.data;

  // iterate over the rows getting the data to be sorted
  for (var i = 0; i < data.length; i++) {
    // Sparse array
    if (!data[i]) {
      continue;
    }

    row = data[i];

    if (!row._sortData) {
      row._sortData = [];
    }

    if (!row._sortData[colIdx]) {
      cellData = _fnGetCellData(settings, i, colIdx, 'sort');

      row._sortData[colIdx] = _formatString(cellData);
    }
  }
}

// #endregion
// #region core.support.js

/**
 * Log an error message
 *  @param {object} settings Capytable settings object
 *  @param {string} msg error message
 *  @param {int} tn Technical note id to get more information about the error.
 *  @memberof Capytable#oApi
 */
function _fnLog(settings, msg, tn) {
  msg =
    'Capytable warning: ' +
    (settings ? 'table id=' + settings.tableId + ' - ' : '') +
    msg;

  if (tn) {
    msg +=
      '. For more information about this error, please see ' +
      'https://Capytable.net/tn/' +
      tn;
  }

  alert(msg);
}

/**
 * Bind an event handers to allow a click or return key to activate the callback.
 * This is good for accessibility since a return on the keyboard will have the
 * same effect as a click, if the element has focus.
 *  @param {element} n Element to bind the action to
 *  @param {object|string} selector Selector (for delegated events) or data object
 *   to pass to the triggered function
 *  @param {function} fn Callback function for when the event is triggered
 *  @memberof Capytable#oApi
 */
function _fnBindAction(n, selector, fn) {
  delegateEvent(n, 'click', selector, fn);

  delegateEvent(n, 'keypress', selector, function (e) {
    if (e.which === 13) {
      e.preventDefault();
      fn(e);
    }
  });

  delegateEvent(n, 'selectstart', selector, () => false);
}

function delegateEvent(el, evt, sel, handler) {
  el.addEventListener(evt, function (event) {
    var t = event.target;
    while (t && t !== this) {
      if (t.matches && t.matches(sel)) {
        handler.call(t, event);
      }
      t = t.parentNode;
    }
  });
}

function _fnBindActionWithData(n, fn) {
  n.addEventListener('click', (e) => fn(e));
  n.addEventListener('keypress', (e) => {
    if (e.which === 13) {
      e.preventDefault();
      fn(e);
    }
  });
  n.addEventListener('selectstart', () => false);
}

/**
 * Fire callback functions and trigger events. Note that the loop over the
 * callback array store is done backwards! Further note that you do not want to
 * fire off triggers in time sensitive applications (for example cell creation)
 * as its slow.
 *  @param {object} settings Capytable settings object
 *  @param {string} callbackArr Name of the array storage for the callbacks in
 *      oSettings
 *  @param {string} eventName Name of the jQuery custom event to trigger. If
 *      null no trigger is fired
 *  @param {array} args Array of arguments to pass to the callback function /
 *      trigger
 *  @param {boolean} [bubbles] True if the event should bubble
 *  @memberof Capytable#oApi
 */
function _fnCallbackFire(settings, callbackArr, eventName, args, bubbles) {
  if (callbackArr) {
    settings[callbackArr]
      .slice()
      .reverse()
      .map(function (val) {
        val.apply(settings.instance, args);
      });
  }

  if (eventName !== null) {
    var e = new CustomEvent(`${eventName}.dt`, {
      bubbles: !!bubbles,
      cancelable: true,
      detail: args,
    });
    var table = settings.tableElement;

    table.dispatchEvent(e);
  }
}

/**
 * Common replacement for language strings
 *
 * @param {*} settings DT settings object
 * @param {*} str String with values to replace
 * @returns String
 */
function _fnMacros(settings, str) {
  // When infinite scrolling, we are always starting at 1. _displayStart is
  // used only internally
  var start = settings._displayStart + 1,
    len = settings._displayLength,
    vis = settings.totalDisplayed(),
    max = settings.total(),
    all = len === -1;

  return str
    .replace(/_START_/g, _formatNumber(start))
    .replace(/_END_/g, _formatNumber(settings.displayEnd()))
    .replace(/_MAX_/g, _formatNumber(max))
    .replace(/_TOTAL_/g, _formatNumber(vis))
    .replace(/_PAGE_/g, _formatNumber(all ? 1 : Math.ceil(start / len)))
    .replace(/_PAGES_/g, _formatNumber(all ? 1 : Math.ceil(vis / len)))
    .replace(/_ENTRIES_/g, 'entries')
    .replace(/_ENTRIES-MAX_/g, 'entries')
    .replace(/_ENTRIES-TOTAL_/g, 'entries');
}

// #endregion

// #region render features

function _renderFeature(settings, feature) {
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
  var textNodes = [];
  div.querySelector('label').childNodes.forEach(function (el) {
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
    .querySelector('label')
    .setAttribute('for', 'dt-length-' + __lengthCounter);
  select.id = 'dt-length-' + __lengthCounter;
  __lengthCounter++;

  // Swap in the select list
  div.querySelector('#' + tmpId).replaceWith(select);

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
      div.querySelector('select').value = e.detail.len;

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
    buttons = defaultPaging
      .map(function (val) {
        return val === 'numbers' ? _pagingNumbers(page, pages, buttons) : val;
      })
      .flat();

  var buttonEls = [];

  for (var i = 0; i < buttons.length; i++) {
    var button = buttons[i];

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
function _pagingNumbers(page, pages, buttons) {
  var numbers = [],
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

    if (addFirstLast) {
      numbers.push(pages - 1);
    }
  } else if (page >= pages - 1 - half) {
    numbers = _range(pages - (buttons - before), pages);
    numbers.unshift('ellipsis');

    if (addFirstLast) {
      numbers.unshift(0);
    }
  } else {
    numbers = _range(page - half + before, page + half - after);
    numbers.push('ellipsis');
    numbers.unshift('ellipsis');

    if (addFirstLast) {
      numbers.push(pages - 1);
      numbers.unshift(0);
    }
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
    .querySelector('label')
    .setAttribute('for', 'dt-search-' + __searchCounter);
  filter
    .querySelector('input')
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

  var jqFilter = filter.querySelector('input');
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

// #endregion

Capytable.models = {};

// #region model.row.js

/**
 * Template object for the way in which Capytable holds information about
 * each individual row. This is the object format used for the settings
 * data array.
 *  @namespace
 */
Capytable.models.oRow = {
  /**
   * TR element for the row
   */
  trElement: null,

  /**
   * Array of TD elements for each row. This is null until the row has been
   * created.
   */
  cells: null,

  /**
   * Data object from the original data source for the row. This is either
   * an array if using the traditional form of Capytable, or an object if
   * using data options. The exact type will depend on the passed in
   * data from the data source, or will be an array if using DOM a data
   * source.
   */
  _data: [],

  /**
   * Sorting data cache - this array is ostensibly the same length as the
   * number of columns (although each index is generated only as it is
   * needed), and holds the data that is used for sorting each column in the
   * row. We do this cache generation at the start of the sort in order that
   * the formatting of the sort data need be done only once for each cell
   * per sort. This array should not be read from or written to by anything
   * other than the master sorting methods.
   */
  _sortData: null,

  /**
   * Per cell filtering data cache. As per the sort data cache, used to
   * increase the performance of the filtering in Capytable
   */
  _filterData: null,

  /**
   * Filtering data cache. This is the same as the cell filtering cache, but
   * in this case a string rather than an array. This is easily computed with
   * a join on `_filterData`, but is provided as a cache so the join isn't
   * needed on every search (memory traded for performance)
   */
  _filterRow: null,

  /**
   * Index in the data array. This saves an indexOf lookup when we have the
   * object, but want to know the index
   */
  idx: -1,

  /**
   * Cached display value
   */
  displayData: null,
};

// #endregion
// #region model.column.js

/**
 * Template object for the column information object in Capytable. This object
 * is held in the settings columns array and contains all the information that
 * Capytable needs about each individual column.
 *  @namespace
 */
Capytable.models.oColumn = {
  /**
   * Column index.
   */
  idx: null,

  /**
   * Flag to indicate if the column is searchable, and thus should be included
   * in the filtering or not.
   */
  searchable: true,

  /**
   * Flag to indicate if the column is sortable or not.
   */
  orderable: true,

  /**
   * Width of the column
   */
  width: null,

  /**
   * Width of the column when it was first "encountered"
   */
  originalWidth: null,

  /** Cached string which is the longest in the column */
  maxLenString: null,
};

// #endregion
// #region model.settings.js

/**
 * Capytable settings object - this holds all the information needed for a
 * given table, including configuration, data and current application of the
 * table options. Capytable does not have a single instance for each Capytable
 * with the settings attached to that instance, but rather instances of the
 * Capytable "class" are created on-the-fly as needed and the settings object is then applied to that
 * instance.
 */
Capytable.models.oSettings = {
  /**
   * Primary features of Capytable and their enablement state.
   */
  features: {
    /**
     * Enable filtering on the table or not. Note that if this is disabled
     * then there is no filtering at all on the table, including fnFilter.
     * To just remove the filtering input use sDom and remove the 'f' option.
     * Note that this parameter will be set by the initialisation routine.
     */
    searching: null,

    /**
     * Pagination enabled or not. Note that if this is disabled then length
     * changing must also be disabled.
     * Note that this parameter will be set by the initialisation routine.
     */
    paging: null,

    /**
     * Sorting enablement flag.
     * Note that this parameter will be set by the initialisation routine.
     */
    ordering: null,
  },

  /**
   * Store data information - see {@link Capytable.models.oRow} for detailed
   * information.
   */
  data: [],

  /**
   * Array of indexes which are in the current display (after filtering etc)
   */
  display: [],

  /**
   * Array of indexes for display - no filtering
   */
  displayMaster: [],

  /**
   * Store information about each column that is in use
   */
  columns: [],

  /**
   * Store information about the table's header
   */
  header: [],

  /**
   * Store information about the table's footer
   */
  footer: [],

  /**
   * Store the applied global search information in case we want to force a
   * research or compare the old search to a new one.
   * Note that this parameter will be set by the initialisation routine.
   */
  searchText: '',

  /**
   * Sorting that is applied to the table. Note that the inner arrays are
   * used in the following manner:
   * <ul>
   *   <li>Index 0 - column number</li>
   *   <li>Index 1 - current sorting direction</li>
   * </ul>
   * Note that this parameter will be set by the initialisation routine.
   */
  order: [0, 'asc'],

  orderSequence: ['asc', 'desc', ''],

  /**
   * Array of callback functions for draw callback functions
   */
  drawCallbacks: [],

  /**
   * Cache the table ID for quick access
   */
  tableId: '',

  /**
   * The TABLE node for the main table
   */
  tableElement: null,

  /**
   * Permanent ref to the thead element
   */
  tHeadElement: null,

  /**
   * Permanent ref to the tfoot element - if it exists
   */
  tFootElement: null,

  /**
   * Permanent ref to the tbody element
   */
  tBodyElement: null,

  /**
   * Cache the wrapper node (contains all Capytable controlled elements)
   */
  wrapperElement: null,

  /**
   * Indicate if all required information has been read in
   */
  initialized: false,

  /**
   * List of options that can be used for the user selectable length menu.
   * Note that this parameter will be set by the initialisation routine.
   */
  lengthMenu: [10, 25, 50, 100],

  /**
   * Paging display length
   */
  _displayLength: 10,

  /**
   * Paging start point - display index
   */
  _displayStart: 0,

  /**
   * Get the number of records in the current record set, before filtering
   */
  total: function () {
    return this.displayMaster.length;
  },

  /**
   * Get the number of records in the current record set, after filtering
   */
  totalDisplayed: function () {
    return this.display.length;
  },

  /**
   * Get the display end point - display index
   */
  displayEnd: function () {
    var len = this._displayLength,
      start = this._displayStart,
      calc = start + len,
      records = this.display.length,
      features = this.features,
      paginate = features.paging;

    return !paginate || calc > records || len === -1 ? records : calc;
  },

  /**
   * The Capytable object for this table
   */
  instance: null,

  /**
   * Last applied sort
   */
  lastOrder: null,

  colgroup: null,
};

// #endregion

export { Capytable };
export default Capytable;
