export interface IColumn {
  /**
   * Column index.
   */
  idx: number;

  /**
   * Flag to indicate if the column is searchable, and thus should be included
   * in the filtering or not.
   */
  searchable: boolean;

  /**
   * Flag to indicate if the column is sortable or not.
   */
  orderable: boolean;

  /**
   * Width of the column
   */
  width: string | null;

  /**
   * Width of the column when it was first "encountered"
   */
  originalWidth: string | null;

  /** Cached string which is the longest in the column */
  maxLenString: string | null;

  colElement: HTMLTableColElement;
}

export interface IRow {
  /**
   * Index in the data array. This saves an indexOf lookup when we have the
   * object, but want to know the index
   */
  idx: number;

  /**
   * TR element for the row
   */
  trElement: HTMLTableRowElement | null;

  /**
   * Array of TD elements for each row. This is null until the row has been
   * created.
   */
  cells: HTMLTableCellElement[] | null;
  _data: string[];
  _sortData: string[] | null;
  _filterData: string[] | null;
  _filterRow: string | null;
  displayData: string[] | null;
}

export interface ISettings {
  /**
   * Primary features of Capytable and their enablement state.
   */
  features: {
    /**
     * Enable filtering on the table or not. Note that if this is disabled
     * then there is no filtering at all on the table, including fnFilter.
     * To just remove the filtering input use sDom and remove the 'f' option.
     * Note that this parameter will be set by the initialisation routine.
     */
    searching: boolean;

    /**
     * Pagination enabled or not. Note that if this is disabled then length
     * changing must also be disabled.
     * Note that this parameter will be set by the initialisation routine.
     */
    paging: boolean;

    /**
     * Sorting enablement flag.
     * Note that this parameter will be set by the initialisation routine.
     */
    ordering: boolean;
  };

  /**
   * Store data information - see {@link Capytable.models.oRow} for detailed
   * information.
   */
  data: IRow[];

  /**
   * Array of indexes which are in the current display (after filtering etc)
   */
  display: number[];

  /**
   * Array of indexes for display - no filtering
   */
  displayMaster: number[];

  /**
   * Store information about each column that is in use
   */
  columns: IColumn[];

  /**
   * Store information about the table's header
   */
  header: any[];

  /**
   * Store information about the table's footer
   */
  footer: any[];

  /**
   * Store the applied global search information in case we want to force a
   * research or compare the old search to a new one.
   * Note that this parameter will be set by the initialisation routine.
   */
  searchText: string;

  /**
   * Sorting that is applied to the table. Note that the inner arrays are
   * used in the following manner:
   * <ul>
   *   <li>Index 0 - column number</li>
   *   <li>Index 1 - current sorting direction</li>
   * </ul>
   * Note that this parameter will be set by the initialisation routine.
   */
  order: [number, string];

  orderSequence: string[];

  /**
   * Array of callback functions for draw callback functions
   */
  drawCallbacks: Function[];

  /**
   * Cache the table ID for quick access
   */
  tableId: string;

  /**
   * The TABLE node for the main table
   */
  tableElement: HTMLTableElement;

  /**
   * Permanent ref to the thead element
   */
  tHeadElement: HTMLTableSectionElement | null;

  /**
   * Permanent ref to the tfoot element - if it exists
   */
  tFootElement: HTMLTableSectionElement | null;

  /**
   * Permanent ref to the tbody element
   */
  tBodyElement: HTMLTableSectionElement | null;

  /**
   * Cache the wrapper node (contains all Capytable controlled elements)
   */
  wrapperElement: HTMLDivElement | null;

  _infoElement: HTMLDivElement | null;

  /**
   * Indicate if all required information has been read in
   */
  initialized: boolean;

  _initComplete: boolean;

  /**
   * List of options that can be used for the user selectable length menu.
   * Note that this parameter will be set by the initialisation routine.
   */
  lengthMenu: number[];

  /**
   * Paging display length
   */
  _displayLength: number;

  /**
   * Paging start point - display index
   */
  _displayStart: number;

  /**
   * Get the number of records in the current record set, before filtering
   */
  total(): number;

  /**
   * Get the number of records in the current record set, after filtering
   */
  totalDisplayed(): number;

  /**
   * Get the display end point - display index
   */
  displayEnd(): number;

  /**
   * The Capytable object for this table
   */
  instance: any;

  /**
   * Last applied sort
   */
  lastOrder: [number, string] | null;

  colgroup: HTMLTableColElement;

  _reszEvt: boolean;
}
