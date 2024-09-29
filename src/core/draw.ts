import { _fnVisibleColumns } from './columns';
import { _fnGetCellData } from './data';
import { _renderFeature } from './features';
import { _fnFilterComplete } from './filter';
import { _pluck } from './internal';
import { _fnSort } from './sort';
import { _fnCallbackFire, _fnLog } from './support';

/**
 * Render and cache a row's display data for the columns, if required
 * @returns
 */
export function _fnGetRowDisplay(settings, rowIdx) {
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
export function _fnCreateTr(oSettings, iRow, trElement, anTds) {
  var row = oSettings.data[iRow],
    cells: any[] = [],
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
export function _fnBuildHeader(settings) {
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
    const firstRow = row[0];

    for (let i = cells.length; i < columns.length; i++) {
      const cell = document.createElement('th');
      cell.innerHTML = columns[i]['title'] || '';
      firstRow.appendChild(cell);
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

export function _fnBuildFooter(settings) {
  var columns = settings.columns;
  var target = settings.tFootElement;

  // Footer might be defined
  if (!target) {
    return;
  }

  // If no cells yet and we have content for them, then create
  if (_pluck(settings.columns, 'footer').join('')) {
    const row = [...target.querySelectorAll('tr')];
    const firstRow = row[0];

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
        firstRow.appendChild(cell);
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
export function _fnDraw(oSettings) {
  var anRows: any[] = [];
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
export function _fnReDraw(settings, recompute = true) {
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
  td.setAttribute('colSpan', _fnVisibleColumns(settings).toString());
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
export function _fnAddOptionsHtml(settings) {
  const table = settings.tableElement;

  // Wrapper div around everything Capytable controls
  const container = document.createElement('div');
  container.id = settings.tableId + '_wrapper';
  container.className = 'dt-container';
  table.parentNode.insertBefore(container, table);

  settings.wrapperElement = container;

  // top row
  const topRow = _fnRenderLayoutRow();

  const pageLength = _renderFeature(settings, 'pageLength')!;
  pageLength.className = 'dt-layout-cell dt-layout-start';
  topRow.appendChild(pageLength);

  const search = _renderFeature(settings, 'search')!;
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

  const info = _renderFeature(settings, 'info')!;
  info.className = 'dt-layout-cell dt-layout-start';
  bottomRow.appendChild(info);

  const paging = _renderFeature(settings, 'paging')!;
  paging.className = 'dt-layout-cell dt-layout-end';
  bottomRow.appendChild(paging);

  // add rows to container
  container.appendChild(topRow);
  container.appendChild(middleRow);
  container.appendChild(bottomRow);
}

function _fnRenderLayoutRow(isTable = false) {
  const row = document.createElement('div');
  row.className = 'dt-layout-row';

  if (isTable) {
    row.className += 'dt-layout-table';
  }

  return row;
}

export function detectHeaderLength(thead) {
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
  var layout: any[] = [];

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
