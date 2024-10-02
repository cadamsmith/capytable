import { ISettings } from '../models/interfaces';
import { getCellData } from './data';
import { callbackFire } from './support';

/**
 * Filter the table using both the global filter and column based filtering
 * @param settings Capytable settings object
 * @param search filter string
 */
export function filterComplete(settings: ISettings, search: string): void {
  // Check if any of the rows were invalidated
  filterData(settings);

  // Start from the full data set
  settings.display = settings.displayMaster.slice();

  const searchRows = settings.display;

  if (search === '') {
    return;
  }

  var i = 0;
  var matched: any[] = [];

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

  callbackFire(settings, null, 'search', [settings]);
}

var __filter_div = document.createElement('div');
var __filter_div_textContent = __filter_div.textContent !== undefined;

/**
 * Update the filtering data for each row if needed (by invalidation or first run)
 * @param settings Capytable settings object
 * @returns boolean if the data was invalidated
 */
function filterData(settings: ISettings): boolean {
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
          cellData = getCellData(settings, rowIdx, j, 'filter');

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
