import { ISettings } from '../models/interfaces';
import { adjustColumnSizing } from './columns';
import { addRows } from './data';
import { addOptionsHtml, buildFooter, buildHeader, redraw } from './draw';
import { insertColGroup } from './sizing';
import { sortInit } from './sort';

/**
 * Draw the table for the first time, adding all required features
 * @param settings Capytable settings object
 */
export function initialize(settings: ISettings) {
  // Build the header / footer for the table
  buildHeader(settings);
  buildFooter(settings);

  // Grab the data from the page
  addRows(settings);

  // Filter not yet applied - copy the display master
  settings.display = settings.displayMaster.slice();

  // Enable features
  addOptionsHtml(settings);

  sortInit(settings);

  insertColGroup(settings);

  // If there is default sorting required - let's do it. The sort function
  // will do the drawing for us. Otherwise we draw the table regardless of the
  // Ajax source - this allows the table to look initialised for Ajax sourcing
  // data (show 'loading' message possibly)
  redraw(settings);

  settings._initComplete = true;

  // Table is fully set up and we have data, so calculate the
  // column widths
  adjustColumnSizing(settings);
}
