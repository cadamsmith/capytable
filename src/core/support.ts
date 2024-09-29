import { _formatNumber } from './internal';

/**
 * Log an error message
 *  @param {object} settings Capytable settings object
 *  @param {string} msg error message
 *  @param {int} tn Technical note id to get more information about the error.
 *  @memberof Capytable#oApi
 */
export function _fnLog(settings, msg, tn) {
  msg =
    'Capytable warning: ' +
    (settings ? 'table id=' + settings.tableId + ' - ' : '') +
    msg;

  if (tn) {
    msg +=
      '. For more information about this error, please see ' +
      'https://Capytable.net/tn/' +
      tn;
  }

  alert(msg);
}

/**
 * Bind an event handers to allow a click or return key to activate the callback.
 * This is good for accessibility since a return on the keyboard will have the
 * same effect as a click, if the element has focus.
 *  @param {element} n Element to bind the action to
 *  @param {object|string} selector Selector (for delegated events) or data object
 *   to pass to the triggered function
 *  @param {function} fn Callback function for when the event is triggered
 *  @memberof Capytable#oApi
 */
export function _fnBindAction(n, selector, fn) {
  delegateEvent(n, 'click', selector, fn);

  delegateEvent(n, 'keypress', selector, function (e) {
    if (e.which === 13) {
      e.preventDefault();
      fn(e);
    }
  });

  delegateEvent(n, 'selectstart', selector, () => false);
}

function delegateEvent(el, evt, sel, handler) {
  el.addEventListener(evt, function (event) {
    var t = event.target;
    while (t && t !== this) {
      if (t.matches && t.matches(sel)) {
        handler.call(t, event);
      }
      t = t.parentNode;
    }
  });
}

export function _fnBindActionWithData(n, fn) {
  n.addEventListener('click', (e) => fn(e));
  n.addEventListener('keypress', (e) => {
    if (e.which === 13) {
      e.preventDefault();
      fn(e);
    }
  });
  n.addEventListener('selectstart', () => false);
}

/**
 * Fire callback functions and trigger events. Note that the loop over the
 * callback array store is done backwards! Further note that you do not want to
 * fire off triggers in time sensitive applications (for example cell creation)
 * as its slow.
 *  @param {object} settings Capytable settings object
 *  @param {string} callbackArr Name of the array storage for the callbacks in
 *      oSettings
 *  @param {string} eventName Name of the jQuery custom event to trigger. If
 *      null no trigger is fired
 *  @param {array} args Array of arguments to pass to the callback function /
 *      trigger
 *  @param {boolean} [bubbles] True if the event should bubble
 *  @memberof Capytable#oApi
 */
export function _fnCallbackFire(
  settings,
  callbackArr,
  eventName,
  args,
  bubbles = false,
) {
  if (callbackArr) {
    settings[callbackArr]
      .slice()
      .reverse()
      .map(function (val) {
        val.apply(settings.instance, args);
      });
  }

  if (eventName !== null) {
    var e = new CustomEvent(`${eventName}.dt`, {
      bubbles: !!bubbles,
      cancelable: true,
      detail: args,
    });
    var table = settings.tableElement;

    table.dispatchEvent(e);
  }
}

/**
 * Common replacement for language strings
 *
 * @param {*} settings DT settings object
 * @param {*} str String with values to replace
 * @returns String
 */
export function _fnMacros(settings, str) {
  // When infinite scrolling, we are always starting at 1. _displayStart is
  // used only internally
  var start = settings._displayStart + 1,
    len = settings._displayLength,
    vis = settings.totalDisplayed(),
    max = settings.total(),
    all = len === -1;

  return str
    .replace(/_START_/g, _formatNumber(start))
    .replace(/_END_/g, _formatNumber(settings.displayEnd()))
    .replace(/_MAX_/g, _formatNumber(max))
    .replace(/_TOTAL_/g, _formatNumber(vis))
    .replace(/_PAGE_/g, _formatNumber(all ? 1 : Math.ceil(start / len)))
    .replace(/_PAGES_/g, _formatNumber(all ? 1 : Math.ceil(vis / len)))
    .replace(/_ENTRIES_/g, 'entries')
    .replace(/_ENTRIES-MAX_/g, 'entries')
    .replace(/_ENTRIES-TOTAL_/g, 'entries');
}
