import { ISettings } from '../models/interfaces';
import { Row } from '../models/row';
import { _fnCreateTr } from './draw';
import { _search } from './internal';
import { _fnLog } from './support';

/**
 * Add one or more TR elements to the table. Generally we'd expect to
 * use this for reading data from a DOM sourced table, but it could be
 * used for an TR element. Note that if a TR is given, it is used (i.e.
 * it is not cloned).
 * @param settings - Capytable settings object
 * @returns array of indexes for the added rows
 */
export function _fnAddTr(settings: ISettings): number[] {
  const trs = [...settings.tBodyElement.querySelectorAll(':scope > tr')];

  return trs.map(function (tr) {
    const tds: any[] = [];
    const data: any[] = [];

    let i = 0;
    let td = tr.firstChild as HTMLElement;
    while (td) {
      const name = td.nodeName.toUpperCase();

      if (name == 'TD' || name == 'TH') {
        const contents = td.innerHTML.trim();

        data[i] = contents;
        i++;

        tds.push(td);
      }

      td = td.nextSibling as HTMLElement;
    }

    /* Create the object for storing information about this new row */
    var rowIdx = settings.data.length;

    var rowModel = new Row(rowIdx, data);

    settings.data.push(rowModel);

    /* Add to the display array */
    settings.displayMaster.push(rowIdx);

    /* Create the DOM information, or register it if already present */
    if (tr) {
      _fnCreateTr(settings, rowIdx, tr as HTMLTableRowElement, tds);
    }

    return rowIdx;
  });
}

/**
 * Get the data for a given cell from the internal cache, taking into account data mapping
 * @param settings - Capytable settings object
 * @param rowIdx - data row id
 * @param colIdx - Column index
 * @param type - data get type ('display', 'type' 'filter|search' 'sort|order')
 * @returns Cell data
 */
export function _fnGetCellData(
  settings: ISettings,
  rowIdx: number,
  colIdx: number,
  type: string,
): string {
  var row = settings.data[rowIdx];
  if (!row) {
    return undefined;
  }

  var col = settings.columns[colIdx];
  var rowData = row._data;
  var cellData = rowData[col.idx];

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
