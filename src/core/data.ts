import { Row } from '../models/row';
import { _fnCreateTr } from './draw';
import { _search } from './internal';
import { _fnLog } from './support';

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
export function _fnAddTr(settings) {
  const trs = [...settings.tBodyElement.querySelectorAll(':scope > tr')];

  return trs.map(function (tr) {
    const tds: any[] = [];
    const data: any[] = [];

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

    var rowModel = new Row(rowIdx, data);

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
export function _fnGetCellData(settings, rowIdx, colIdx, type) {
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
