import { ISettings } from '../models/interfaces';
import { adjustColumnSizing, sumColumnWidth } from './columns';
import { getRowDisplay } from './draw';
import { toCssUnits, range, stripHtml, throttle } from './internal';

/**
 * Calculate the width of columns for the table
 * @param settings Capytable settings object
 */
export function calculateColumnWidths(settings: ISettings): void {
  var table = settings.tableElement,
    columns = settings.columns,
    visibleColumns = range(columns.length),
    tableWidthAttr = table.getAttribute('width'), // from DOM element
    tableContainer = table.parentNode!,
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
  var tmpTable = table.cloneNode() as HTMLElement;
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
  tmpTable.appendChild(settings.tHeadElement!.cloneNode(true));
  tmpTable.appendChild(settings.tFootElement!.cloneNode(true));

  // Remove any assigned widths from the footer (from scrolling)
  [...tmpTable.querySelectorAll('tfoot th, tfoot td')].forEach(
    (el) => ((el as HTMLElement).style.width = ''),
  );

  // Apply custom sizing to the cloned header
  [...tmpTable.querySelectorAll('thead th, thead td')].forEach(
    (el) =>
      function () {
        // Get the `width` from the header layout
        var width = sumColumnWidth(settings, el, true);

        if (width) {
          // Need to set the width and min-width, otherwise the browser
          // will attempt to collapse the table beyond want might have
          // been specified
          (el as HTMLElement).style.width = width;
          this.style.minWidth = width;
        } else {
          (el as HTMLElement).style.width = '';
        }
      },
  );

  // Find the widest piece of data for each column and put it into the table
  for (let i = 0; i < visibleColumns.length; i++) {
    columnIdx = visibleColumns[i];

    var longest = getMaxLenString(settings, columnIdx);
    var text = longest;
    var insert =
      longest.indexOf('<') === -1 ? document.createTextNode(text) : text;

    const td = document.createElement('td');
    td.appendChild(insert as Node);
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
  var bodyCells = [...tmpTable.querySelector('tbody tr')!.children];

  for (let i = 0; i < visibleColumns.length; i++) {
    // Use getBounding for sub-pixel accuracy, which we then want to round up!
    var bounding = bodyCells[i].getBoundingClientRect().width;

    // Total is tracked to remove any sub-pixel errors as the outerWidth
    // of the table might not equal the total given here
    total += bounding;

    // Width for each column to use
    columns[visibleColumns[i]].width = toCssUnits(bounding);
  }

  table.style.width = toCssUnits(total);

  // Finished with the table - ditch it
  holder.remove();

  // If there is a width attr, we want to attach an event listener which
  // allows the table sizing to automatically adjust when the window is
  // resized. Use the width attr rather than CSS, since we can't know if the
  // CSS is a relative value or absolute - DOM read is always px.
  if (tableWidthAttr) {
    table.style.width = toCssUnits(tableWidthAttr);
  }

  if (tableWidthAttr && !settings._reszEvt) {
    window.addEventListener(
      'resize',
      throttle(() => adjustColumnSizing(settings)),
    );
    settings._reszEvt = true;
  }
}

/**
 * Get the maximum strlen for each data column
 * @param settings Capytable settings object
 * @param colIdx column of interest
 * @returns longest string in the column
 */
function getMaxLenString(settings: ISettings, colIdx: number): string {
  var column = settings.columns[colIdx];

  if (!column.maxLenString) {
    var max = '',
      maxLen = -1;

    for (var i = 0, ien = settings.displayMaster.length; i < ien; i++) {
      const rowIdx = settings.displayMaster[i];
      const data = getRowDisplay(settings, rowIdx)[colIdx];

      // Remove id / name attributes from elements so they
      // don't interfere with existing elements
      const cellString = data
        .replace(/id=".*?"/g, '')
        .replace(/name=".*?"/g, '');

      const s = stripHtml(cellString).replace(/&nbsp;/g, ' ');

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
 * Re-insert the `col` elements for current visibility
 * @param settings Capytable settings object
 */
export function insertColGroup(settings: ISettings): void {
  var cols = settings.columns;

  settings.colgroup.innerHTML = '';

  for (let i = 0; i < cols.length; i++) {
    settings.colgroup.appendChild(cols[i].colElement);
  }
}
