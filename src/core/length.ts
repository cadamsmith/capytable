import { ISettings } from '../models/interfaces';
import { _fnCallbackFire } from './support';

/**
 * recalculate the display length and adjust the start point
 * @param settings Capytable settings object
 * @param val new display length
 */
export function _fnLengthChange(settings: ISettings, val: string): void {
  var len = parseInt(val, 10);
  settings._displayLength = len;

  var start = settings._displayStart,
    end = settings.displayEnd(),
    len = settings._displayLength as number;

  /* If we have space to show extra rows (backing up from the end point - then do so */
  if (start >= end) {
    start = end - len;
  }

  // Keep the start record on the current page
  start -= start % len;

  if (len === -1 || start < 0) {
    start = 0;
  }

  settings._displayStart = start;

  // Fire length change event
  _fnCallbackFire(settings, null, 'length', [settings, len]);
}
