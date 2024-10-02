import { ISettings } from '../models/interfaces';
import { draw } from './draw';
import { callbackFire, logError } from './support';

/**
 * Alter the display settings to change the page
 * @param settings Capytable settings object
 * @param action Paging action to take: "first", "previous",
 * "next" or "last" or page number to jump to (integer)
 * @returns true if page has changed, false otherwise
 */
export function changePage(
  settings: ISettings,
  action: string | number,
): boolean {
  var start = settings._displayStart,
    len = settings._displayLength,
    records = settings.totalDisplayed();

  if (records === 0 || len === -1) {
    start = 0;
  } else if (typeof action === 'number') {
    start = action * len;

    if (start > records) {
      start = 0;
    }
  } else if (action == 'first') {
    start = 0;
  } else if (action == 'previous') {
    start = len >= 0 ? start - len : 0;

    if (start < 0) {
      start = 0;
    }
  } else if (action == 'next') {
    if (start + len < records) {
      start += len;
    }
  } else if (action == 'last') {
    start = Math.floor((records - 1) / len) * len;
  } else if (action === 'ellipsis') {
    return;
  } else {
    logError(settings, 'Unknown paging action: ' + action, 5);
  }

  var changed = settings._displayStart !== start;
  settings._displayStart = start;

  callbackFire(settings, null, changed ? 'page' : 'page-nc', [settings]);

  if (changed) {
    draw(settings);
  }

  return changed;
}
