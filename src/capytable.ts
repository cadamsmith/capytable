import { addColumns } from './core/columns';
import { detectHeaderLength } from './core/draw';
import { initialize } from './core/init';
import { adjustSortingClasses } from './core/sort';
import { logError } from './core/support';
import { ISettings } from './models/interfaces';
import { Settings } from './models/settings';

class Capytable {
  settings: ISettings;

  constructor(id: string) {
    var element = document.getElementById(id);
    if (!element) {
      console.error('Element with id ' + id + ' not found');
      return;
    }

    /* Sanity check */
    if (element.nodeName.toLowerCase() != 'table') {
      logError(
        null,
        'Non-table node initialisation (' + element.nodeName + ')',
        2,
      );
      return;
    }

    // make col group element
    const colGroupElement = document.createElement('colgroup');
    element.prepend(colGroupElement);

    /* Create the settings object for this table and set some of the default parameters */
    var oSettings: ISettings = new Settings(id, {
      table: element,
      colgroup: colGroupElement,
    });

    // Need to add the instance after the instance after the settings object has been added
    // to the settings array, so we can self reference the table instance if more than one
    oSettings.instance = this;

    element.classList.add('capytable');

    /*
     * Columns
     * See if we should load columns automatically or use defined ones
     */
    var thead = element.querySelector(
      ':scope > thead',
    ) as HTMLTableSectionElement;
    let initHeaderLength = detectHeaderLength(thead);

    // If we don't have a columns array, then generate one with nulls
    if (initHeaderLength === 0) {
      console.error('No columns defined in the table');
      return;
    }

    // Add the columns, apply the column definitions
    addColumns(oSettings, initHeaderLength);

    // Do a first pass on the sorting classes (allows any size changes to be taken into
    // account, and also will apply sorting disabled classes if disabled
    adjustSortingClasses(oSettings);
    oSettings.drawCallbacks.push(() => adjustSortingClasses(oSettings));

    /*
     * Table HTML init
     * Cache the header, body and footer as required, creating them if needed
     */
    if (!thead) {
      thead = document.createElement('thead');
      element.appendChild(thead);
    }
    oSettings.tHeadElement = thead;

    let tbody = element.querySelector(
      ':scope > tbody',
    ) as HTMLTableSectionElement;
    if (!tbody) {
      tbody = document.createElement('tbody');
      thead.insertAdjacentElement('afterend', tbody);
    }
    oSettings.tBodyElement = tbody;

    let tfoot = element.querySelector(
      ':scope > tfoot',
    ) as HTMLTableSectionElement;
    if (!tfoot) {
      // If we are a scrolling table, and no footer has been given, then we need to create
      // a tfoot element for the caption element to be appended to
      tfoot = document.createElement('tfoot');
      element.appendChild(tfoot);
    }
    oSettings.tFootElement = tfoot;

    // Initialisation complete - table can be drawn
    oSettings.initialized = true;

    // Language definitions
    initialize(oSettings);

    this.settings = oSettings;
  }
}

export { Capytable };
export default Capytable;
