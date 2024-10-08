import { ISettings } from '../models/interfaces';
import { countVisibleColumns } from './columns';
import { getCellData } from './data';
import { renderFeature } from './features';
import { filterComplete } from './filter';
import { pluck } from './internal';
import { sort } from './sort';
import { callbackFire, logError } from './support';

/**
 * Render and cache a row's display data for the columns, if required
 * @param settings - Capytable settings object
 * @param rowIdx - data row id
 * @returns that row's display data
 */
export function getRowDisplay(settings: ISettings, rowIdx: number): string[] {
  let rowModal = settings.data[rowIdx];
  let columns = settings.columns;

  if (!rowModal.displayData) {
    // Need to render and cache
    rowModal.displayData = [];

    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      rowModal.displayData.push(
        getCellData(settings, rowIdx, colIdx, 'display'),
      );
    }
  }

  return rowModal.displayData;
}

/**
 * Create a new TR element (and it's TD children) for a row
 * @param settings - Capytable settings object
 * @param iRow - Row to consider
 * @param trElement - TR element to add to the table - optional. If not given,
 * Capytable will create a row automatically
 * @param anTds - Array of TD|TH elements for the row - must be given if trElement is.
 */
export function createRow(
  settings: ISettings,
  iRow: number,
  trElement: HTMLTableRowElement,
  anTds: HTMLTableCellElement[],
): void {
  var row = settings.data[iRow],
    cells = [];

  if (row.trElement !== null) {
    return;
  }

  row.trElement = trElement;
  row.cells = cells;

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
  for (let i = 0; i < settings.columns.length; i++) {
    const nTd = anTds[i];

    if (!nTd) {
      logError(settings, 'Incorrect column count', 18);
    }

    cells.push(nTd);
  }
}

/**
 * Create the HTML header for the table
 *  @param settings - Capytable settings object
 */
export function buildHeader(settings: ISettings): void {
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

  settings.header = detectHeader(settings, target);

  // ARIA role for the rows
  [...target.querySelectorAll(':scope > tr')].forEach((el) =>
    el.setAttribute('role', 'row'),
  );

  // Every cell needs to be passed through the renderer
  [...target.querySelectorAll(':scope > tr > th')].forEach(function (el, idx) {
    const cell = el as HTMLTableCellElement;

    if (!settings.features.ordering) {
      cell.classList.add('ct-orderable-none');
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

      cell.classList.remove('ct-ordering-asc', 'ct-ordering-desc');
      cell.classList.add('ct-orderable-asc');
      cell.classList.add('ct-orderable-desc');

      // Determine if all of the columns that this cell covers are included in the
      // current ordering
      var isOrdering = idx === sorting[0];

      if (isOrdering) {
        if (sorting[1] === 'asc') {
          cell.classList.add('ct-ordering-asc');
        } else if (sorting[1] === 'desc') {
          cell.classList.add('ct-ordering-desc');
        }
      }
    });
  });

  drawHead(settings.header);
}

/**
 * Create the HTML footer for the table
 *  @param settings - Capytable settings object
 */
export function buildFooter(settings: ISettings): void {
  var columns = settings.columns;
  var target = settings.tFootElement;

  // Footer might be defined
  if (!target) {
    return;
  }

  // If no cells yet and we have content for them, then create
  if (pluck(settings.columns, 'footer').join('')) {
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

  settings.footer = detectHeader(settings, target);

  // ARIA role for the rows
  [...target.querySelectorAll(':scope > tr')].forEach((el) =>
    el.setAttribute('role', 'row'),
  );

  // Every cell needs to be passed through the renderer

  // TODO: add back footer rendering
  // [...target.querySelectorAll(':scope > tr > th, :scope > tr > td')]
  // 	.forEach(el => _fnRenderer('footer')(settings, el));

  drawHead(settings.footer);
}

/**
 * Insert the required TR nodes into the table for display
 *  @param settings - Capytable settings object
 */
export function draw(settings: ISettings): void {
  var anRows: any[] = [];
  var iRowCount = 0;
  var aiDisplay = settings.display;
  var iDisplayStart = settings._displayStart;
  var iDisplayEnd = settings.displayEnd();
  var body = settings.tBodyElement;

  if (aiDisplay.length !== 0) {
    var iStart = iDisplayStart;
    var iEnd = iDisplayEnd;

    for (var j = iStart; j < iEnd; j++) {
      var iDataIndex = aiDisplay[j];
      var data = settings.data[iDataIndex];

      var nRow = data.trElement;

      anRows.push(nRow);
      iRowCount++;
    }
  } else {
    anRows[0] = makeEmptyRow(settings);
  }

  body.replaceChildren(...anRows);

  // Empty table needs a specific class
  if (!settings.tFootElement.querySelector('tr')) {
    settings.wrapperElement.classList.add('ct-empty-footer');
  } else {
    settings.wrapperElement.classList.remove('ct-empty-footer');
  }

  /* Call all required callback functions for the end of a draw */
  callbackFire(settings, 'drawCallbacks', 'draw', [settings], true);
}

/**
 * Redraw the table - taking account of the various features which are enabled
 *  @param settings - Capytable settings object
 *  @param recompute - indicates whether to recompute the table data or not
 */
export function redraw(settings: ISettings, recompute = true): void {
  const features = settings.features;

  if (recompute) {
    if (features.ordering) {
      sort(settings);
    }

    if (features.searching) {
      filterComplete(settings, settings.searchText);
    } else {
      // No filtering, so we want to just use the display master
      settings.display = settings.displayMaster.slice();
    }
  }

  settings._displayStart = 0;

  draw(settings);
}

/**
 * Add the options to the page HTML for the table
 * @param settings Capytable settings object
 */
export function addOptionsHtml(settings: ISettings): void {
  const table = settings.tableElement;

  // Wrapper div around everything Capytable controls
  const container = document.createElement('div');
  container.id = settings.tableId + '_wrapper';
  container.className = 'ct-container';
  table.parentNode.insertBefore(container, table);

  settings.wrapperElement = container;

  // top row
  const topRow = renderLayoutRow();

  const pageLength = renderFeature(settings, 'pageLength')!;
  pageLength.className = 'ct-layout-cell ct-layout-start';
  topRow.appendChild(pageLength);

  const search = renderFeature(settings, 'search')!;
  search.className = 'ct-layout-cell ct-layout-end';
  topRow.appendChild(search);

  // middle row
  const middleRow = renderLayoutRow(true);

  const div = document.createElement('div');
  div.className = 'ct-layout-cell ct-layout-full';
  div.appendChild(settings.tableElement);
  middleRow.appendChild(div);

  // bottom row
  const bottomRow = renderLayoutRow();

  const info = renderFeature(settings, 'info')!;
  info.className = 'ct-layout-cell ct-layout-start';
  bottomRow.appendChild(info);

  const paging = renderFeature(settings, 'paging')!;
  paging.className = 'ct-layout-cell ct-layout-end';
  bottomRow.appendChild(paging);

  // add rows to container
  container.appendChild(topRow);
  container.appendChild(middleRow);
  container.appendChild(bottomRow);
}

/**
 * detects the number of columns in the table header
 * @param thead table header element
 * @returns number of columns in the header
 */
export function detectHeaderLength(thead: HTMLTableSectionElement): number {
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
 * Draw the header (or footer) element based on the column visibility states.
 * @param source - Layout array from _fnDetectHeader
 */
function drawHead(source): void {
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
 * Table is empty - create a row with an empty message in it
 * @param settings - Capytable settings object
 * @returns empty row element
 */
function makeEmptyRow(settings: ISettings): HTMLTableRowElement {
  let zeroVerbiage = 'No matching records found';

  if (settings.total() === 0) {
    zeroVerbiage = 'No data available in table';
  }

  const td = document.createElement('td');
  td.setAttribute('colSpan', countVisibleColumns(settings).toString());
  td.className = 'ct-empty';
  td.innerHTML = zeroVerbiage;

  const tr = document.createElement('tr');
  tr.appendChild(td);

  return tr;
}

/**
 * Render a row layout div
 * @param isTable whether the row is a table row or not
 * @returns the row layout div element
 */
function renderLayoutRow(isTable = false): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'ct-layout-row';

  if (isTable) {
    row.className += 'ct-layout-table';
  }

  return row;
}

/**
 * Use the DOM source to create up an array of header cells. The idea here is to
 * create a layout grid (array) of rows x columns, which contains a reference
 * to the cell that that point in the grid (regardless of col/rowspan), such that
 * any column / row could be removed and the new grid constructed
 * @param settings Capytable settings object
 * @param thead The header/footer element for the table
 * @returns Calculated layout array
 */
function detectHeader(settings: ISettings, thead: HTMLTableSectionElement) {
  var columns = settings.columns;
  var rows = thead.querySelectorAll(':scope > tr');
  var isHeader = thead && thead.nodeName.toLowerCase() === 'thead';
  var layout: any[] = [];

  // We know how many rows there are in the layout - so prep it
  for (let i = 0; i < rows.length; i++) {
    layout.push([]);
  }

  for (let i = 0; i < rows.length; i++) {
    let row = rows[i];
    let column = 0;

    // For every cell in the row..
    let cell = row.firstChild as HTMLTableCellElement;
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
        if (!cell.querySelector('span.ct-column-title')) {
          const span = document.createElement('span');
          span.classList.add('ct-column-title');
          span.replaceChildren(...cell.childNodes);
          cell.appendChild(span);
        }

        if (isHeader && !cell.querySelector('span.ct-column-order')) {
          const span = document.createElement('span');
          span.classList.add('ct-column-order');
          cell.appendChild(span);
        }

        // If there is col / rowspan, copy the information into the layout grid
        layout[i][column] = cell;

        layout[i].row = row;

        cell.setAttribute('data-ct-column', column.toString());

        column++;
      }

      cell = cell.nextSibling as HTMLTableCellElement;
    }
  }

  return layout;
}
