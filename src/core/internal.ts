export function _empty(d: string) {
  return !d || d === '-';
}

export function _pluck(
  arr: any[],
  prop: string | number,
  prop2?: string | number,
) {
  return arr.reduce((out, item) => {
    if (prop2 !== undefined) {
      if (item && item[prop]) {
        out.push(item[prop][prop2]);
      }
    } else {
      if (item) {
        out.push(item[prop]);
      }
    }
    return out;
  }, []);
}

export function _range(len: number, start?: number): number[] {
  var out: number[] = [];
  var end: number;

  if (start === undefined) {
    start = 0;
    end = len;
  } else {
    end = start;
    start = len;
  }

  for (var i = start; i < end; i++) {
    out.push(i);
  }

  return out;
}

export function _search(str: string): string {
  if (_empty(str)) {
    return str;
  }

  const _re_new_lines = /[\r\n\u2028]/g;

  str = str.replace(_re_new_lines, ' ');
  str = _normalize(str);

  return str;
}

/**
 * strip HTML tags from a string
 * @param input input string to sanitize
 * @returns sanitized string
 */
export function _stripHtml(input: string): string {
  if (!input) {
    return input;
  }

  let previous: string;

  const _re_html = /<([^>]*>)/g;

  input = input.replace(_re_html, ''); // Complete tags

  // Safety for incomplete script tag - use do / while to ensure that
  // we get all instances
  do {
    previous = input;
    input = input.replace(/<script/i, '');
  } while (input !== previous);

  return previous;
}

/**
 * Remove diacritics from a string by decomposing it and then removing
 * non-ascii characters
 * @param str input string to normalize
 * @returns normalized string
 */
export function _normalize(str: string): string {
  if (typeof str !== 'string') {
    return str;
  }

  // It is faster to just run `normalize` than it is to check if
  // we need to with a regex!
  var res = str.normalize('NFD');

  // Equally, here we check if a regex is needed or not
  return res.length !== str.length ? res.replace(/[\u0300-\u036f]/g, '') : res;
}

/**
 * When rendering large numbers in the information element for the table
 * (i.e. "Showing 1 to 10 of 57 entries") Capytable will render large numbers
 * to have a comma separator for the 'thousands' units (e.g. 1 million is
 * rendered as "1,000,000") to help readability for the end user. This
 * function will override the default method Capytable uses.
 * @param toFormat number to format
 * @returns formatted number
 */
export function _formatNumber(toFormat: number): string {
  return toFormat.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Throttle the calls to a function. Arguments and context are maintained
 * for the throttled function.
 * @param fn Function to be called
 * @return Wrapped function
 */
export function _throttle(fn: () => void): () => void {
  var frequency = 200,
    last: number,
    timer: string | number | NodeJS.Timeout;

  return function () {
    var that = this,
      now = +new Date(),
      args = arguments;

    if (last && now < last + frequency) {
      clearTimeout(timer);

      timer = setTimeout(function () {
        last = undefined;
        fn.apply(that, args);
      }, frequency);
    } else {
      last = now;
      fn.apply(that, args);
    }
  };
}

/**
 * Append a CSS unit (only if required) to a string
 * @param s value to css-ify
 * @returns value with css unit
 */
export function _fnStringToCss(s: string | number) {
  if (s === null) {
    return '0px';
  }

  if (typeof s == 'number') {
    return s < 0 ? '0px' : s + 'px';
  }

  // Check it has a unit character already
  return s.match(/\d$/) ? s + 'px' : s;
}
