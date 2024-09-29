import { IRow } from './interfaces';

export class Row implements IRow {
  idx: number;
  trElement: HTMLTableRowElement | null;
  cells: HTMLTableCellElement[] | null;
  _data: string[];
  _sortData: string[] | null;
  _filterData: string[] | null;
  _filterRow: string | null;
  displayData: string[] | null;

  constructor(idx: number, data: string[]) {
    this.idx = idx;
    this._data = data;

    this.trElement = null;
    this.cells = null;
    this._sortData = null;
    this._filterData = null;
    this._filterRow = null;
    this.displayData = null;
  }
}
