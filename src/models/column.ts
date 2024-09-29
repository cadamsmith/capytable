import { IColumn } from './interfaces';

export class Column implements IColumn {
  idx: number;
  searchable: boolean;
  orderable: boolean;
  width: string | null;
  originalWidth: string | null;
  maxLenString: string | null;
  colElement: HTMLTableColElement;

  constructor(idx: number, colElement: HTMLTableColElement) {
    this.idx = idx;
    this.colElement = colElement;
    this.searchable = true;
    this.orderable = true;
    this.width = null;
    this.originalWidth = null;
    this.maxLenString = null;
  }
}
