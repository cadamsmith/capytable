import { _fnAdjustColumnSizing } from './columns';
import { _fnAddTr } from './data';
import {
  _fnAddOptionsHtml,
  _fnBuildFooter,
  _fnBuildHeader,
  _fnReDraw,
} from './draw';
import { _colGroup } from './sizing';
import { _fnSortInit } from './sort';

/**
 * Draw the table for the first time, adding all required features
 *  @param {object} settings Capytable settings object
 *  @memberof Capytable#oApi
 */
export function _fnInitialise(settings) {
  // Build the header / footer for the table
  _fnBuildHeader(settings);
  _fnBuildFooter(settings);

  // Grab the data from the page
  _fnAddTr(settings);

  // Filter not yet applied - copy the display master
  settings.display = settings.displayMaster.slice();

  // Enable features
  _fnAddOptionsHtml(settings);

  _fnSortInit(settings);

  _colGroup(settings);

  // If there is default sorting required - let's do it. The sort function
  // will do the drawing for us. Otherwise we draw the table regardless of the
  // Ajax source - this allows the table to look initialised for Ajax sourcing
  // data (show 'loading' message possibly)
  _fnReDraw(settings);

  settings._initComplete = true;

  // Table is fully set up and we have data, so calculate the
  // column widths
  _fnAdjustColumnSizing(settings);
}
