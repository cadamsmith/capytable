import { OrderDirection, type ICapytable } from './settings.js';
import type { IOptions } from './options.js';

class Capytable implements ICapytable {
  features = {
    searching: true,
    paging: true,
    ordering: true
  };

  order = {
    index: 0,
    direction: OrderDirection.Ascending
  };

  lengthMenu = [10, 25, 50, 100];

  searchText = '';

  colGroupElement!: HTMLTableColElement;

  _displayLength!: number;

  constructor(id: string, options: IOptions) {
    // map user options onto settings
    const {
      searching = true,
      paging = true,
      ordering = true
    } = options;
    this.features = { searching, paging, ordering };

    const element = document.querySelector(id);
    if (!element) {
      console.log('No element found for initialization');
    }

    if (element?.nodeName.toLowerCase() != 'table') {
      console.error('Non-table node');
      return;
    }

    const colGroupElement = document.createElement('colgroup');
    element.prepend(colGroupElement);
    this.colGroupElement = colGroupElement;

    this._displayLength = this.lengthMenu[0]!;
  }
}
