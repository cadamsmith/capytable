export interface ICapytable {
  features: {
    searching: boolean;
    paging: boolean;
    ordering: boolean;
  };

  order: {
    index: number,
    direction: OrderDirection
  };

  lengthMenu: number[];

  searchText: string;

  colGroupElement: HTMLTableColElement;
}

export enum OrderDirection {
  Ascending = 'asc',
  Descending = 'desc'
}
