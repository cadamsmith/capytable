import { ISettings } from '../models/interfaces';
import { _fnColumnsFromHeader } from './columns';
import { _fnGetCellData } from './data';
import { _fnReDraw } from './draw';
import { _empty, _pluck } from './internal';
import { _fnBindAction, _fnCallbackFire } from './support';

export function _fnSortInit(settings: ISettings): void {
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
 * @param settings Capytable settings object
 * @param display Display array to sort
 */
function _fnSortDisplay(settings: ISettings, display: number[]): void {
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
 * @param settings Capytable settings object
 * @returns Array of the new display indexes
 */
export function _fnSort(settings: ISettings): number[] {
  var aiOrig: any[] = [],
    data = settings.data,
    displayMaster = settings.displayMaster;

  // Allow a specific column to be sorted, which will _not_ alter the display
  // master
  const aSort = settings.order;

  if (aSort) {
    // Load the data needed for the sort, for each cell
    _fnSortData(settings, aSort[0]);

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

  _fnCallbackFire(settings, null, 'order', [settings, aSort]);

  return displayMaster;
}

/**
 * Function to run on user sort request
 * @param settings Capytable settings object
 * @param colIdx column sorting index
 * @returns false if sorting is disabled for the column, otherwise true
 */
function _fnSortAdd(settings: ISettings, colIdx: number): boolean {
  var col = settings.columns[colIdx];
  var sorting = settings.order;

  var next = function (dir: string) {
    if (dir === 'asc') {
      return 'desc';
    } else if (dir === 'desc') {
      return '';
    } else {
      return 'asc';
    }
  };

  if (!col.orderable) {
    return false;
  }

  // If appending the sort then we are multi-column sorting
  if (sorting && sorting[0] == colIdx) {
    // Single column - already sorting on this column, modify the sort
    sorting[1] = next(sorting[1]);
  } else {
    // Single column - sort only on this column
    sorting = [colIdx, settings.orderSequence[0]];
  }

  settings.order = sorting;

  return true;
}

/**
 * Set the sorting classes on table's body, Note: it is safe to call this function
 * when bSort and bSortClasses are false
 * @param settings Capytable settings object
 */
export function _fnSortingClasses(settings: ISettings): void {
  const oldSort = settings.lastOrder;
  const sort = settings.order;

  if (settings.features.ordering) {
    // Remove old sorting classes
    if (oldSort) {
      // Remove column sorting
      _pluck(settings.data, 'cells', oldSort[0]).forEach((cell) =>
        cell.classList.remove('sorting'),
      );
    }

    // Add new column sorting
    if (sort) {
      _pluck(settings.data, 'cells', sort[0]).forEach((cell) =>
        cell.classList.remove('sorting'),
      );
    }
  }

  settings.lastOrder = sort;
}

// Get the data to sort a column, be it from cache, fresh (populating the
// cache), or from a sort formatter
function _fnSortData(settings: ISettings, colIdx: number): void {
  // Use / populate cache
  var data = settings.data;

  // iterate over the rows getting the data to be sorted
  for (var i = 0; i < data.length; i++) {
    // Sparse array
    if (!data[i]) {
      continue;
    }

    const row = data[i];

    if (!row._sortData) {
      row._sortData = [];
    }

    if (!row._sortData[colIdx]) {
      const cellData = _fnGetCellData(settings, i, colIdx, 'sort');

      row._sortData[colIdx] = _empty(cellData) ? '' : cellData.toLowerCase();
    }
  }
}
