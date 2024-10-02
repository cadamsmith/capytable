import { IColumn, IRow, ISettings } from './interfaces';

export class Settings implements ISettings {
  features: {
    searching: boolean;
    paging: boolean;
    ordering: boolean;
  };

  data: IRow[] = [];
  display: number[] = [];
  displayMaster: number[] = [];
  columns: IColumn[] = [];
  header: any[] = [];
  footer: any[] = [];
  searchText: string = '';
  order: [number, string] = [0, 'asc'];
  orderSequence: string[] = ['asc', 'desc', ''];
  drawCallbacks: Function[] = [];
  tableId: string = '';
  tableElement: HTMLTableElement;
  tHeadElement: HTMLTableSectionElement | null = null;
  tFootElement: HTMLTableSectionElement | null = null;
  tBodyElement: HTMLTableSectionElement | null = null;
  wrapperElement: HTMLDivElement | null = null;
  initialized: boolean = false;
  lengthMenu: number[] = [10, 25, 50, 100];
  _displayLength: number = 10;
  _displayStart: number = 0;

  _infoElement: HTMLDivElement | null = null;
  _initComplete: boolean = false;

  instance: any = null;
  lastOrder: [number, string] | null = null;
  colgroup: HTMLTableColElement;

  _reszEvt: boolean = false;

  constructor(
    searching: boolean,
    paging: boolean,
    ordering: boolean,
    tableId: string,
    elementRefs: { [id: string]: HTMLElement },
  ) {
    this.features = {
      searching: searching,
      paging: paging,
      ordering: ordering,
    };

    this.tableId = tableId;
    this.tableElement = elementRefs.table as HTMLTableElement;
    this.colgroup = elementRefs.colgroup as HTMLTableColElement;
  }

  total(): number {
    return this.displayMaster.length;
  }

  totalDisplayed(): number {
    return this.display.length;
  }

  displayEnd(): number {
    var len = this._displayLength,
      start = this._displayStart,
      calc = start + len,
      records = this.display.length,
      features = this.features,
      paginate = features.paging;

    return !paginate || calc > records || len === -1 ? records : calc;
  }
}
