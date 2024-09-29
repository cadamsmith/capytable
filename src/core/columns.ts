import { Column } from '../models/column';
import { ISettings } from '../models/interfaces';
import { _fnCalculateColumnWidths } from './sizing';
import { _fnCallbackFire } from './support';

/**
 * Add columns to the list used for the table with default values
 *  @param {object} oSettings Capytable settings object
 *  @memberof Capytable#oApi
 */
export function _fnAddColumns(oSettings: ISettings, length: number) {
  for (let i = 0; i < length; i++) {
    // Add column to columns array
    var iCol = oSettings.columns.length;

    const colElement = document.createElement('col');
    colElement.setAttribute('data-dt-column', iCol.toString());

    var oCol = new Column(iCol, colElement);
    oSettings.columns.push(oCol);

    /* Feature sorting overrides column specific when off */
    if (!oSettings.features.ordering) {
      oCol.orderable = false;
    }
  }
}

/**
 * Adjust the table column widths for new data. Note: you would probably want to
 * do a redraw after calling this function!
 *  @param {object} settings Capytable settings object
 *  @memberof Capytable#oApi
 */
export function _fnAdjustColumnSizing(settings) {
  _fnCalculateColumnWidths(settings);

  var cols = settings.columns;

  for (var i = 0; i < cols.length; i++) {
    var width = _fnColumnsSumWidth(settings, [i], false);

    // Need to set the min-width, otherwise the browser might try to collapse
    // it further
    cols[i].colElement.style.width = width;
    cols[i].colElement.style.minWidth = width;
  }

  _fnCallbackFire(settings, null, 'column-sizing', [settings]);
}

/**
 * Get the number of visible columns
 *  @param {object} oSettings Capytable settings object
 *  @returns {int} i the number of visible columns
 *  @memberof Capytable#oApi
 */
export function _fnVisibleColumns(settings) {
  var layout = settings.header;
  var vis = 0;

  if (layout.length) {
    for (var i = 0, ien = layout[0].length; i < ien; i++) {
      if (layout[0][i].style.display !== 'none') {
        vis++;
      }
    }
  }

  return vis;
}

/**
 * Get the width for a given set of columns
 *
 * @param {*} settings Capytable settings object
 * @param {*} targets Columns - comma separated string or array of numbers
 * @param {*} original Use the original width (true) or calculated (false)
 * @returns Combined CSS value
 */
export function _fnColumnsSumWidth(settings, targets, original) {
  if (!Array.isArray(targets)) {
    targets = _fnColumnsFromHeader(targets);
  }

  var sum = 0;
  var unit;
  var columns = settings.columns;

  for (let i = 0; i < targets.length; i++) {
    var column = columns[targets[i]];
    var definedWidth = original ? column.originalWidth : column.width;

    if (definedWidth === null || definedWidth === undefined) {
      return null; // can't determine a defined width - browser defined
    } else if (typeof definedWidth === 'number') {
      unit = 'px';
      sum += definedWidth;
    } else {
      var matched = definedWidth.match(/([\d\.]+)([^\d]*)/);

      if (matched) {
        sum += parseInt(matched[1]) * 1;
        unit = matched.length === 3 ? matched[2] : 'px';
      }
    }
  }

  return sum + unit;
}

export function _fnColumnsFromHeader(cell) {
  const attr = cell.closest('[data-dt-column]').getAttribute('data-dt-column');

  if (!attr) {
    return [];
  }

  return attr.split(',').map((val) => val * 1);
}
