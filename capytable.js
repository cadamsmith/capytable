/*! DataTables 2.1.6
 * © SpryMedia Ltd - datatables.net/license
 */

// #region core.main.js
export class DataTable {
	constructor(id, options) {
		this.element = document.getElementById(id);

		var emptyInit = options === undefined;
		if (emptyInit) {
			options = {};
		}

		// Method to get DT API instance from jQuery object
		this.api = function () {
			return new _Api(this.element);
		};

		// For each initialisation we want to give it a clean initialisation
		// object that can be bashed around
		var oInit = options;

		var i = 0;
		var iLen;
		var sId = this.element.getAttribute('id');
		var defaults = DataTable.defaults;
		var $this = $(this);

		/* Sanity check */
		if (this.element.nodeName.toLowerCase() != 'table') {
			_fnLog(null, 0, 'Non-table node initialisation (' + this.nodeName + ')', 2);
			return;
		}

		$(this).trigger('options.dt', oInit);

		/* Setting up the initialisation object */
		Object.assign(oInit, this.dataset);

		/* Check to see if we are re-initialising a table */
		var allSettings = DataTable.settings;
		for (i = 0, iLen = allSettings.length; i < iLen; i++) {
			var s = allSettings[i];

			/* Base check on table node */
			var check = s.table == this
				|| (s.tHead && s.tHead.parentNode == this)
				|| (s.tFoot && s.tFoot.parentNode == this);

			if (check) {
				var bRetrieve = oInit.retrieve !== undefined ? oInit.retrieve : defaults.retrieve;
				var bDestroy = oInit.destroy !== undefined ? oInit.destroy : defaults.destroy;

				if (emptyInit || bRetrieve) {
					return s.oInstance;
				}
				else if (bDestroy) {
					new DataTable.Api(s).destroy();
					break;
				}
				else {
					_fnLog(s, 0, 'Cannot reinitialise DataTable', 3);
					return;
				}
			}

			/* If the element we are initialising has the same ID as a table which was previously
			 * initialised, but the table nodes don't match (from before) then we destroy the old
			 * instance by simply deleting it. This is under the assumption that the table has been
			 * destroyed by other methods. Anyone using non-id selectors will need to do this manually
			 */
			if (s.tableId == this.id) {
				allSettings.splice(i, 1);
				break;
			}
		}

		/* Create the settings object for this table and set some of the default parameters */
		var oSettings = $.extend(true, {}, DataTable.models.oSettings, {
			"destroyWidth": $this[0].style.width,
			"instanceId": sId,
			"tableId": sId,
			colgroup: $('<colgroup>').prependTo(this),
			fastData: function (row, column, type) {
				return _fnGetCellData(oSettings, row, column, type);
			}
		});
		oSettings.table = this.element;
		oSettings.init = oInit;

		allSettings.push(oSettings);

		// Make a single API instance available for internal handling
		oSettings.api = new _Api(oSettings);

		// Need to add the instance after the instance after the settings object has been added
		// to the settings array, so we can self reference the table instance if more than one
		oSettings.instance = this.element;

		// Apply the defaults and init options to make a single init object will all
		// options defined from defaults and instance options.
		oInit = _fnExtend($.extend(true, {}, defaults), oInit);

		// Map the initialisation options onto the settings object
		_fnMap(oSettings.features, oInit, [
			"paging",
			"lengthChange",
			"searching",
			"ordering",
			"orderMulti",
			"info",
			"processing",
			"autoWidth",
			"orderClasses",
			"serverSide",
			"deferRender"
		]);

		_fnMap(oSettings, oInit, [
			"ajax",
			"formatNumber",
			"serverMethod",
			"order",
			"orderFixed",
			"lengthMenu",
			"pagingType",
			"stateDuration",
			"orderCellsTo",
			"tabIndex",
			"dom",
			"stateLoadCallback",
			"stateSaveCallback",
			"renderer",
			"searchDelay",
			"rowId",
			"caption",
			"layout",
			"orderDescReverse",
			"typeDetect",
			"stateDuration",
			"previousSearch",
			"preSearchCols",
			"pageLength"
		]);

		_fnMap(oSettings.scroll, oInit, [
			"scrollX",
			"scrollXInner",
			"scrollY",
			"scrollCollapse"
		]);

		_fnMap(oSettings.language, oInit, "infoCallback");

		/* Callback functions which are array driven */
		_fnCallbackReg(oSettings, 'drawCallback', oInit.drawCallback);
		_fnCallbackReg(oSettings, 'stateSaveParams', oInit.stateSaveParams);
		_fnCallbackReg(oSettings, 'stateLoadParams', oInit.stateLoadParams);
		_fnCallbackReg(oSettings, 'stateLoaded', oInit.stateLoaded);
		_fnCallbackReg(oSettings, 'rowCallback', oInit.rowCallback);
		_fnCallbackReg(oSettings, 'rowCreatedCallback', oInit.createdRow);
		_fnCallbackReg(oSettings, 'headerCallback', oInit.headerCallback);
		_fnCallbackReg(oSettings, 'footerCallback', oInit.footerCallback);
		_fnCallbackReg(oSettings, 'initComplete', oInit.initComplete);
		_fnCallbackReg(oSettings, 'preDrawCallback', oInit.preDrawCallback);

		oSettings.rowIdFn = _fnGetObjectDataFn(oInit.rowId);

		/* Browser support detection */
		// _fnBrowserDetect(oSettings);

		var oClasses = oSettings.classes;

		$.extend(oClasses, oInit.classes);
		this.element.classList.add(oClasses.table);

		if (!oSettings.features.paginate) {
			oInit.displayStart = 0;
		}

		if (oSettings.initDisplayStart === undefined) {
			/* Display start point, taking into account the save saving */
			oSettings.initDisplayStart = oInit.displayStart;
			oSettings._displayStart = oInit.displayStart;
		}

		/*
		 * Columns
		 * See if we should load columns automatically or use defined ones
		 */
		var columnsInit = [];
		var thead = this.getElementsByTagName('thead');
		var initHeaderLayout = _fnDetectHeader(oSettings, thead[0]);

		// If we don't have a columns array, then generate one with nulls
		if (oInit.columns) {
			columnsInit = oInit.columns;
		}
		else if (initHeaderLayout.length) {
			for (i = 0, iLen = initHeaderLayout[0].length; i < iLen; i++) {
				columnsInit.push(null);
			}
		}

		// Add the columns
		for (i = 0, iLen = columnsInit.length; i < iLen; i++) {
			_fnAddColumn(oSettings);
		}

		// Apply the column definitions
		_fnApplyColumnDefs(oSettings, oInit.columnDefs, columnsInit, initHeaderLayout, function (iCol, oDef) {
			_fnColumnOptions(oSettings, iCol, oDef);
		});

		/* HTML5 attribute detection - build an mData object automatically if the
		 * attributes are found
		 */
		var rowOne = $this.children('tbody').find('tr').eq(0);

		if (rowOne.length) {
			var a = function (cell, name) {
				return cell.getAttribute('data-' + name) !== null ? name : null;
			};

			$(rowOne[0]).children('th, td').each(function (i, cell) {
				var col = oSettings.columns[i];

				if (!col) {
					_fnLog(oSettings, 0, 'Incorrect column count', 18);
				}

				if (col.mData === i) {
					var sort = a(cell, 'sort') || a(cell, 'order');
					var filter = a(cell, 'filter') || a(cell, 'search');

					if (sort !== null || filter !== null) {
						col.mData = {
							_: i + '.display',
							sort: sort !== null ? i + '.@data-' + sort : undefined,
							type: sort !== null ? i + '.@data-' + sort : undefined,
							filter: filter !== null ? i + '.@data-' + filter : undefined
						};
						col._isArrayHost = true;

						_fnColumnOptions(oSettings, i);
					}
				}
			});
		}

		// Must be done after everything which can be overridden by the state saving!
		_fnCallbackReg(oSettings, 'aoDrawCallback', _fnSaveState);

		var features = oSettings.features;

		// If aaSorting is not defined, then we use the first indicator in asSorting
		// in case that has been altered, so the default sort reflects that option
		if (oInit.sorting === undefined) {
			var sorting = oSettings.sorting;
			for (i = 0, iLen = sorting.length; i < iLen; i++) {
				sorting[i][1] = oSettings.columns[i].sorting[0];
			}
		}

		// Do a first pass on the sorting classes (allows any size changes to be taken into
		// account, and also will apply sorting disabled classes if disabled
		_fnSortingClasses(oSettings);

		_fnCallbackReg(oSettings, 'drawCallback', function () {
			if (oSettings.sorted || _fnDataSource(oSettings) === 'ssp' || features.deferRender) {
				_fnSortingClasses(oSettings);
			}
		});

		/*
		 * Table HTML init
		 * Cache the header, body and footer as required, creating them if needed
		 */

		if (thead.length === 0) {
			thead = $('<thead/>').appendTo($this);
		}
		oSettings.tHead = thead[0];
		$('tr', thead).addClass(oClasses.thead.row);

		var tbody = $this.children('tbody');
		if (tbody.length === 0) {
			tbody = $('<tbody/>').insertAfter(thead);
		}
		oSettings.tBody = tbody[0];

		var tfoot = $this.children('tfoot');
		if (tfoot.length === 0) {
			// If we are a scrolling table, and no footer has been given, then we need to create
			// a tfoot element for the caption element to be appended to
			tfoot = $('<tfoot/>').appendTo($this);
		}
		oSettings.tFoot = tfoot[0];
		$('tr', tfoot).addClass(oClasses.tfoot.row);

		// Copy the data index array
		oSettings.display = oSettings.displayMaster.slice();

		// Initialisation complete - table can be drawn
		oSettings.initialised = true;

		// Language definitions
		var oLanguage = oSettings.language;
		$.extend(true, oLanguage, oInit.language);

		_fnCallbackFire(oSettings, null, 'i18n', [oSettings], true);
		_fnInitialise(oSettings);

		return this;
	}
}

// _buildInclude('ext.js');
// _buildInclude('ext.classes.js');

// #region core.internal.js

/*
 * It is useful to have variables which are scoped locally so only the
 * DataTables functions can access them and they don't leak into global space.
 * At the same time these functions are often useful over multiple files in the
 * core and API, so we list, or at least document, all variables which are used
 * by DataTables as private variables here. This also ensures that there is no
 * clashing of variable names and that they can easily referenced for reuse.
 */


// Defined else where
//  _selector_run
//  _selector_opts
//  _selector_row_indexes

var _ext; // DataTable.ext
var _Api; // DataTable.Api
var _api_register; // DataTable.Api.register
var _api_registerPlural; // DataTable.Api.registerPlural

var _re_dic = {};
var _re_new_lines = /[\r\n\u2028]/g;
var _re_html = /<([^>]*>)/g;
var _max_str_len = Math.pow(2, 28);

// This is not strict ISO8601 - Date.parse() is quite lax, although
// implementations differ between browsers.
var _re_date = /^\d{2,4}[./-]\d{1,2}[./-]\d{1,2}([T ]{1}\d{1,2}[:.]\d{2}([.:]\d{2})?)?$/;

// Escape regular expression special characters
var _re_escape_regex = new RegExp( '(\\' + [ '/', '.', '*', '+', '?', '|', '(', ')', '[', ']', '{', '}', '\\', '$', '^', '-' ].join('|\\') + ')', 'g' );

// https://en.wikipedia.org/wiki/Foreign_exchange_market
// - \u20BD - Russian ruble.
// - \u20a9 - South Korean Won
// - \u20BA - Turkish Lira
// - \u20B9 - Indian Rupee
// - R - Brazil (R$) and South Africa
// - fr - Swiss Franc
// - kr - Swedish krona, Norwegian krone and Danish krone
// - \u2009 is thin space and \u202F is narrow no-break space, both used in many
// - Ƀ - Bitcoin
// - Ξ - Ethereum
//   standards as thousands separators.
var _re_formatted_numeric = /['\u00A0,$£€¥%\u2009\u202F\u20BD\u20a9\u20BArfkɃΞ]/gi;


var _empty = function ( d ) {
	return !d || d === true || d === '-' ? true : false;
};


var _intVal = function ( s ) {
	var integer = parseInt( s, 10 );
	return !isNaN(integer) && isFinite(s) ? integer : null;
};

// Convert from a formatted number with characters other than `.` as the
// decimal place, to a Javascript number
var _numToDecimal = function ( num, decimalPoint ) {
	// Cache created regular expressions for speed as this function is called often
	if ( ! _re_dic[ decimalPoint ] ) {
		_re_dic[ decimalPoint ] = new RegExp( _fnEscapeRegex( decimalPoint ), 'g' );
	}
	return typeof num === 'string' && decimalPoint !== '.' ?
		num.replace( /\./g, '' ).replace( _re_dic[ decimalPoint ], '.' ) :
		num;
};


var _isNumber = function ( d, decimalPoint, formatted, allowEmpty ) {
	var type = typeof d;
	var strType = type === 'string';

	if ( type === 'number' || type === 'bigint') {
		return true;
	}

	// If empty return immediately so there must be a number if it is a
	// formatted string (this stops the string "k", or "kr", etc being detected
	// as a formatted number for currency
	if ( allowEmpty && _empty( d ) ) {
		return true;
	}

	if ( decimalPoint && strType ) {
		d = _numToDecimal( d, decimalPoint );
	}

	if ( formatted && strType ) {
		d = d.replace( _re_formatted_numeric, '' );
	}

	return !isNaN( parseFloat(d) ) && isFinite( d );
};


// A string without HTML in it can be considered to be HTML still
var _isHtml = function ( d ) {
	return _empty( d ) || typeof d === 'string';
};

// Is a string a number surrounded by HTML?
var _htmlNumeric = function ( d, decimalPoint, formatted, allowEmpty ) {
	if ( allowEmpty && _empty( d ) ) {
		return true;
	}

	// input and select strings mean that this isn't just a number
	if (typeof d === 'string' && d.match(/<(input|select)/i)) {
		return null;
	}

	var html = _isHtml( d );
	return ! html ?
		null :
		_isNumber( _stripHtml( d ), decimalPoint, formatted, allowEmpty ) ?
			true :
			null;
};


var _pluck = function ( a, prop, prop2 ) {
	var out = [];
	var i=0, ien=a.length;

	// Could have the test in the loop for slightly smaller code, but speed
	// is essential here
	if ( prop2 !== undefined ) {
		for ( ; i<ien ; i++ ) {
			if ( a[i] && a[i][ prop ] ) {
				out.push( a[i][ prop ][ prop2 ] );
			}
		}
	}
	else {
		for ( ; i<ien ; i++ ) {
			if ( a[i] ) {
				out.push( a[i][ prop ] );
			}
		}
	}

	return out;
};


// Basically the same as _pluck, but rather than looping over `a` we use `order`
// as the indexes to pick from `a`
var _pluck_order = function ( a, order, prop, prop2 )
{
	var out = [];
	var i=0, ien=order.length;

	// Could have the test in the loop for slightly smaller code, but speed
	// is essential here
	if ( prop2 !== undefined ) {
		for ( ; i<ien ; i++ ) {
			if ( a[ order[i] ] && a[ order[i] ][ prop ] ) {
				out.push( a[ order[i] ][ prop ][ prop2 ] );
			}
		}
	}
	else {
		for ( ; i<ien ; i++ ) {
			if ( a[ order[i] ] ) {
				out.push( a[ order[i] ][ prop ] );
			}
		}
	}

	return out;
};


var _range = function ( len, start )
{
	var out = [];
	var end;

	if ( start === undefined ) {
		start = 0;
		end = len;
	}
	else {
		end = start;
		start = len;
	}

	for ( var i=start ; i<end ; i++ ) {
		out.push( i );
	}

	return out;
};


var _removeEmpty = function ( a )
{
	var out = [];

	for ( var i=0, ien=a.length ; i<ien ; i++ ) {
		if ( a[i] ) { // careful - will remove all falsy values!
			out.push( a[i] );
		}
	}

	return out;
};

// Replaceable function in api.util
var _stripHtml = function (input) {
	if (! input || typeof input !== 'string') {
		return input;
	}

	// Irrelevant check to workaround CodeQL's false positive on the regex
	if (input.length > _max_str_len) {
		throw new Error('Exceeded max str len');
	}

	var previous;

	input = input.replace(_re_html, ''); // Complete tags

	// Safety for incomplete script tag - use do / while to ensure that
	// we get all instances
	do {
		previous = input;
		input = input.replace(/<script/i, '');
	} while (input !== previous);

	return previous;
};

// Replaceable function in api.util
var _escapeHtml = function ( d ) {
	if (Array.isArray(d)) {
		d = d.join(',');
	}

	return typeof d === 'string' ?
		d
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;') :
		d;
};

// Remove diacritics from a string by decomposing it and then removing
// non-ascii characters
var _normalize = function (str, both) {
	if (typeof str !== 'string') {
		return str;
	}

	// It is faster to just run `normalize` than it is to check if
	// we need to with a regex!
	var res = str.normalize("NFD");

	// Equally, here we check if a regex is needed or not
	return res.length !== str.length
		? (both === true ? str + ' ' : '' ) + res.replace(/[\u0300-\u036f]/g, "")
		: res;
}

/**
 * Determine if all values in the array are unique. This means we can short
 * cut the _unique method at the cost of a single loop. A sorted array is used
 * to easily check the values.
 *
 * @param  {array} src Source array
 * @return {boolean} true if all unique, false otherwise
 * @ignore
 */
var _areAllUnique = function ( src ) {
	if ( src.length < 2 ) {
		return true;
	}

	var sorted = src.slice().sort();
	var last = sorted[0];

	for ( var i=1, ien=sorted.length ; i<ien ; i++ ) {
		if ( sorted[i] === last ) {
			return false;
		}

		last = sorted[i];
	}

	return true;
};


/**
 * Find the unique elements in a source array.
 *
 * @param  {array} src Source array
 * @return {array} Array of unique items
 * @ignore
 */
var _unique = function ( src )
{
	if (Array.from && Set) {
		return Array.from(new Set(src));
	}

	if ( _areAllUnique( src ) ) {
		return src.slice();
	}

	// A faster unique method is to use object keys to identify used values,
	// but this doesn't work with arrays or objects, which we must also
	// consider. See jsperf.app/compare-array-unique-versions/4 for more
	// information.
	var
		out = [],
		val,
		i, ien=src.length,
		j, k=0;

	again: for ( i=0 ; i<ien ; i++ ) {
		val = src[i];

		for ( j=0 ; j<k ; j++ ) {
			if ( out[j] === val ) {
				continue again;
			}
		}

		out.push( val );
		k++;
	}

	return out;
};

// Surprisingly this is faster than [].concat.apply
// https://jsperf.com/flatten-an-array-loop-vs-reduce/2
var _flatten = function (out, val) {
	if (Array.isArray(val)) {
		for (var i=0 ; i<val.length ; i++) {
			_flatten(out, val[i]);
		}
	}
	else {
		out.push(val);
	}

	return out;
}

// Similar to jQuery's addClass, but use classList.add
function _addClass(el, name) {
	if (name) {
		name.split(' ').forEach(function (n) {
			if (n) {
				// `add` does deduplication, so no need to check `contains`
				el.classList.add(n);
			}
		});
	}
}

// #endregion

// #region api.util.js

/**
 * DataTables utility methods
 * 
 * This namespace provides helper methods that DataTables uses internally to
 * create a DataTable, but which are not exclusively used only for DataTables.
 * These methods can be used by extension authors to save the duplication of
 * code.
 *
 *  @namespace
 */
DataTable.util = {
	/**
	 * Return a string with diacritic characters decomposed
	 * @param {*} mixed Function or string to normalize
	 * @param {*} both Return original string and the normalized string
	 * @returns String or undefined
	 */
	diacritics: function (mixed, both) {
		var type = typeof mixed;

		if (type !== 'function') {
			return _normalize(mixed, both);
		}
		_normalize = mixed;
	},

	/**
	 * Debounce a function
	 *
	 * @param {function} fn Function to be called
	 * @param {integer} freq Call frequency in mS
	 * @return {function} Wrapped function
	 */
	debounce: function ( fn, timeout ) {
		var timer;

		return function () {
			var that = this;
			var args = arguments;

			clearTimeout(timer);

			timer = setTimeout( function () {
				fn.apply(that, args);
			}, timeout || 250 );
		};
	},

	/**
	 * Throttle the calls to a function. Arguments and context are maintained
	 * for the throttled function.
	 *
	 * @param {function} fn Function to be called
	 * @param {integer} freq Call frequency in mS
	 * @return {function} Wrapped function
	 */
	throttle: function ( fn, freq ) {
		var
			frequency = freq !== undefined ? freq : 200,
			last,
			timer;

		return function () {
			var
				that = this,
				now  = +new Date(),
				args = arguments;

			if ( last && now < last + frequency ) {
				clearTimeout( timer );

				timer = setTimeout( function () {
					last = undefined;
					fn.apply( that, args );
				}, frequency );
			}
			else {
				last = now;
				fn.apply( that, args );
			}
		};
	},

	/**
	 * Escape a string such that it can be used in a regular expression
	 *
	 *  @param {string} val string to escape
	 *  @returns {string} escaped string
	 */
	escapeRegex: function ( val ) {
		return val.replace( _re_escape_regex, '\\$1' );
	},

	/**
	 * Create a function that will write to a nested object or array
	 * @param {*} source JSON notation string
	 * @returns Write function
	 */
	set: function ( source ) {
		if ( $.isPlainObject( source ) ) {
			/* Unlike get, only the underscore (global) option is used for for
			 * setting data since we don't know the type here. This is why an object
			 * option is not documented for `mData` (which is read/write), but it is
			 * for `mRender` which is read only.
			 */
			return DataTable.util.set( source._ );
		}
		else if ( source === null ) {
			// Nothing to do when the data source is null
			return function () {};
		}
		else if ( typeof source === 'function' ) {
			return function (data, val, meta) {
				source( data, 'set', val, meta );
			};
		}
		else if (
			typeof source === 'string' && (source.indexOf('.') !== -1 ||
			source.indexOf('[') !== -1 || source.indexOf('(') !== -1)
		) {
			// Like the get, we need to get data from a nested object
			var setData = function (data, val, src) {
				var a = _fnSplitObjNotation( src ), b;
				var aLast = a[a.length-1];
				var arrayNotation, funcNotation, o, innerSrc;
	
				for ( var i=0, iLen=a.length-1 ; i<iLen ; i++ ) {
					// Protect against prototype pollution
					if (a[i] === '__proto__' || a[i] === 'constructor') {
						throw new Error('Cannot set prototype values');
					}
	
					// Check if we are dealing with an array notation request
					arrayNotation = a[i].match(__reArray);
					funcNotation = a[i].match(__reFn);
	
					if ( arrayNotation ) {
						a[i] = a[i].replace(__reArray, '');
						data[ a[i] ] = [];
	
						// Get the remainder of the nested object to set so we can recurse
						b = a.slice();
						b.splice( 0, i+1 );
						innerSrc = b.join('.');
	
						// Traverse each entry in the array setting the properties requested
						if ( Array.isArray( val ) ) {
							for ( var j=0, jLen=val.length ; j<jLen ; j++ ) {
								o = {};
								setData( o, val[j], innerSrc );
								data[ a[i] ].push( o );
							}
						}
						else {
							// We've been asked to save data to an array, but it
							// isn't array data to be saved. Best that can be done
							// is to just save the value.
							data[ a[i] ] = val;
						}
	
						// The inner call to setData has already traversed through the remainder
						// of the source and has set the data, thus we can exit here
						return;
					}
					else if ( funcNotation ) {
						// Function call
						a[i] = a[i].replace(__reFn, '');
						data = data[ a[i] ]( val );
					}
	
					// If the nested object doesn't currently exist - since we are
					// trying to set the value - create it
					if ( data[ a[i] ] === null || data[ a[i] ] === undefined ) {
						data[ a[i] ] = {};
					}
					data = data[ a[i] ];
				}
	
				// Last item in the input - i.e, the actual set
				if ( aLast.match(__reFn ) ) {
					// Function call
					data = data[ aLast.replace(__reFn, '') ]( val );
				}
				else {
					// If array notation is used, we just want to strip it and use the property name
					// and assign the value. If it isn't used, then we get the result we want anyway
					data[ aLast.replace(__reArray, '') ] = val;
				}
			};
	
			return function (data, val) { // meta is also passed in, but not used
				return setData( data, val, source );
			};
		}
		else {
			// Array or flat object mapping
			return function (data, val) { // meta is also passed in, but not used
				data[source] = val;
			};
		}
	},

	/**
	 * Create a function that will read nested objects from arrays, based on JSON notation
	 * @param {*} source JSON notation string
	 * @returns Value read
	 */
	get: function ( source ) {
		if ( $.isPlainObject( source ) ) {
			// Build an object of get functions, and wrap them in a single call
			var o = {};
			$.each( source, function (key, val) {
				if ( val ) {
					o[key] = DataTable.util.get( val );
				}
			} );
	
			return function (data, type, row, meta) {
				var t = o[type] || o._;
				return t !== undefined ?
					t(data, type, row, meta) :
					data;
			};
		}
		else if ( source === null ) {
			// Give an empty string for rendering / sorting etc
			return function (data) { // type, row and meta also passed, but not used
				return data;
			};
		}
		else if ( typeof source === 'function' ) {
			return function (data, type, row, meta) {
				return source( data, type, row, meta );
			};
		}
		else if (
			typeof source === 'string' && (source.indexOf('.') !== -1 ||
			source.indexOf('[') !== -1 || source.indexOf('(') !== -1)
		) {
			/* If there is a . in the source string then the data source is in a
			 * nested object so we loop over the data for each level to get the next
			 * level down. On each loop we test for undefined, and if found immediately
			 * return. This allows entire objects to be missing and sDefaultContent to
			 * be used if defined, rather than throwing an error
			 */
			var fetchData = function (data, type, src) {
				var arrayNotation, funcNotation, out, innerSrc;
	
				if ( src !== "" ) {
					var a = _fnSplitObjNotation( src );
	
					for ( var i=0, iLen=a.length ; i<iLen ; i++ ) {
						// Check if we are dealing with special notation
						arrayNotation = a[i].match(__reArray);
						funcNotation = a[i].match(__reFn);
	
						if ( arrayNotation ) {
							// Array notation
							a[i] = a[i].replace(__reArray, '');
	
							// Condition allows simply [] to be passed in
							if ( a[i] !== "" ) {
								data = data[ a[i] ];
							}
							out = [];
	
							// Get the remainder of the nested object to get
							a.splice( 0, i+1 );
							innerSrc = a.join('.');
	
							// Traverse each entry in the array getting the properties requested
							if ( Array.isArray( data ) ) {
								for ( var j=0, jLen=data.length ; j<jLen ; j++ ) {
									out.push( fetchData( data[j], type, innerSrc ) );
								}
							}
	
							// If a string is given in between the array notation indicators, that
							// is used to join the strings together, otherwise an array is returned
							var join = arrayNotation[0].substring(1, arrayNotation[0].length-1);
							data = (join==="") ? out : out.join(join);
	
							// The inner call to fetchData has already traversed through the remainder
							// of the source requested, so we exit from the loop
							break;
						}
						else if ( funcNotation ) {
							// Function call
							a[i] = a[i].replace(__reFn, '');
							data = data[ a[i] ]();
							continue;
						}
	
						if (data === null || data[ a[i] ] === null) {
							return null;
						}
						else if ( data === undefined || data[ a[i] ] === undefined ) {
							return undefined;
						}

						data = data[ a[i] ];
					}
				}
	
				return data;
			};
	
			return function (data, type) { // row and meta also passed, but not used
				return fetchData( data, type, source );
			};
		}
		else {
			// Array or flat object mapping
			return function (data) { // row and meta also passed, but not used
				return data[source];
			};
		}
	},

	stripHtml: function (mixed) {
		var type = typeof mixed;

		if (type === 'function') {
			_stripHtml = mixed;
			return;
		}
		else if (type === 'string') {
			return _stripHtml(mixed);
		}
		return mixed;
	},

	escapeHtml: function (mixed) {
		var type = typeof mixed;

		if (type === 'function') {
			_escapeHtml = mixed;
			return;
		}
		else if (type === 'string' || Array.isArray(mixed)) {
			return _escapeHtml(mixed);
		}
		return mixed;
	},

	unique: _unique
};

// #endregion

// #region core.compat.js

/**
 * Create a mapping object that allows camel case parameters to be looked up
 * for their Hungarian counterparts. The mapping is stored in a private
 * parameter called `_hungarianMap` which can be accessed on the source object.
 *  @param {object} o
 *  @memberof DataTable#oApi
 */
function _fnHungarianMap(o) {
	var hungarian = 'a aa ai ao as b fn i m o s ';
	var match;
	var newKey;
	var map = {};

	$.each(o, function (key) {
		match = key.match(/^([^A-Z]+?)([A-Z])/);

		if (match && hungarian.indexOf(match[1] + ' ') !== -1) {
			newKey = key.replace(match[0], match[2].toLowerCase());
			map[newKey] = key;

			if (match[1] === 'o') {
				_fnHungarianMap(o[key]);
			}
		}
	});

	o._hungarianMap = map;
}


/**
 * Convert from camel case parameters to Hungarian, based on a Hungarian map
 * created by _fnHungarianMap.
 *  @param {object} src The model object which holds all parameters that can be
 *    mapped.
 *  @param {object} user The object to convert from camel case to Hungarian.
 *  @param {boolean} force When set to `true`, properties which already have a
 *    Hungarian value in the `user` object will be overwritten. Otherwise they
 *    won't be.
 *  @memberof DataTable#oApi
 */
function _fnCamelToHungarian(src, user, force) {
	if (!src._hungarianMap) {
		_fnHungarianMap(src);
	}

	var hungarianKey;

	$.each(user, function (key) {
		hungarianKey = src._hungarianMap[key];

		if (hungarianKey !== undefined && (force || user[hungarianKey] === undefined)) {
			// For objects, we need to buzz down into the object to copy parameters
			if (hungarianKey.charAt(0) === 'o') {
				// Copy the camelCase options over to the hungarian
				if (!user[hungarianKey]) {
					user[hungarianKey] = {};
				}
				$.extend(true, user[hungarianKey], user[key]);

				_fnCamelToHungarian(src[hungarianKey], user[hungarianKey], force);
			}
			else {
				user[hungarianKey] = user[key];
			}
		}
	});
}

/**
 * Map one parameter onto another
 *  @param {object} o Object to map
 *  @param {*} knew The new parameter name
 *  @param {*} old The old parameter name
 */
var _fnCompatMap = function (o, knew, old) {
	if (o[knew] !== undefined) {
		o[old] = o[knew];
	}
};


/**
 * Provide backwards compatibility for the main DT options. Note that the new
 * options are mapped onto the old parameters, so this is an external interface
 * change only.
 *  @param {object} init Object to map
 */
function _fnCompatOpts(init) {
	_fnCompatMap(init, 'ordering', 'bSort');
	_fnCompatMap(init, 'orderMulti', 'bSortMulti');
	_fnCompatMap(init, 'orderClasses', 'bSortClasses');
	_fnCompatMap(init, 'orderCellsTop', 'bSortCellsTop');
	_fnCompatMap(init, 'order', 'aaSorting');
	_fnCompatMap(init, 'orderFixed', 'aaSortingFixed');
	_fnCompatMap(init, 'paging', 'bPaginate');
	_fnCompatMap(init, 'pagingType', 'sPaginationType');
	_fnCompatMap(init, 'pageLength', 'iDisplayLength');
	_fnCompatMap(init, 'searching', 'bFilter');

	// Boolean initialisation of x-scrolling
	if (typeof init.sScrollX === 'boolean') {
		init.sScrollX = init.sScrollX ? '100%' : '';
	}
	if (typeof init.scrollX === 'boolean') {
		init.scrollX = init.scrollX ? '100%' : '';
	}

	// Column search objects are in an array, so it needs to be converted
	// element by element
	var searchCols = init.aoSearchCols;

	if (searchCols) {
		for (var i = 0, ien = searchCols.length; i < ien; i++) {
			if (searchCols[i]) {
				_fnCamelToHungarian(DataTable.models.oSearch, searchCols[i]);
			}
		}
	}

	// Enable search delay if server-side processing is enabled
	if (init.serverSide && !init.searchDelay) {
		init.searchDelay = 400;
	}
}


/**
 * Provide backwards compatibility for column options. Note that the new options
 * are mapped onto the old parameters, so this is an external interface change
 * only.
 *  @param {object} init Object to map
 */
function _fnCompatCols(init) {
	_fnCompatMap(init, 'orderable', 'bSortable');
	_fnCompatMap(init, 'orderData', 'aDataSort');
	_fnCompatMap(init, 'orderSequence', 'asSorting');
	_fnCompatMap(init, 'orderDataType', 'sortDataType');

	// orderData can be given as an integer
	var dataSort = init.aDataSort;
	if (typeof dataSort === 'number' && !Array.isArray(dataSort)) {
		init.aDataSort = [dataSort];
	}
}


/**
 * Browser feature detection for capabilities, quirks
 *  @param {object} settings dataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnBrowserDetect(settings) {
	// We don't need to do this every time DataTables is constructed, the values
	// calculated are specific to the browser and OS configuration which we
	// don't expect to change between initialisations
	if (!DataTable.__browser) {
		var browser = {};
		DataTable.__browser = browser;

		// Scrolling feature / quirks detection
		var n = $('<div/>')
			.css({
				position: 'fixed',
				top: 0,
				left: -1 * window.pageXOffset, // allow for scrolling
				height: 1,
				width: 1,
				overflow: 'hidden'
			})
			.append(
				$('<div/>')
					.css({
						position: 'absolute',
						top: 1,
						left: 1,
						width: 100,
						overflow: 'scroll'
					})
					.append(
						$('<div/>')
							.css({
								width: '100%',
								height: 10
							})
					)
			)
			.appendTo('body');

		var outer = n.children();
		var inner = outer.children();

		// Get scrollbar width
		browser.barWidth = outer[0].offsetWidth - outer[0].clientWidth;

		// In rtl text layout, some browsers (most, but not all) will place the
		// scrollbar on the left, rather than the right.
		browser.bScrollbarLeft = Math.round(inner.offset().left) !== 1;

		n.remove();
	}

	$.extend(settings.oBrowser, DataTable.__browser);
	settings.oScroll.iBarWidth = DataTable.__browser.barWidth;
}

// #endregion

// #region core.columns.js

/**
 * Add a column to the list used for the table with default values
 *  @param {object} oSettings dataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnAddColumn(oSettings) {
	// Add column to aoColumns array
	var oDefaults = DataTable.defaults.column;
	var iCol = oSettings.aoColumns.length;
	var oCol = $.extend({}, DataTable.models.oColumn, oDefaults, {
		"aDataSort": oDefaults.aDataSort ? oDefaults.aDataSort : [iCol],
		"mData": oDefaults.mData ? oDefaults.mData : iCol,
		idx: iCol,
		searchFixed: {},
		colEl: $('<col>').attr('data-dt-column', iCol)
	});
	oSettings.aoColumns.push(oCol);

	// Add search object for column specific search. Note that the `searchCols[ iCol ]`
	// passed into extend can be undefined. This allows the user to give a default
	// with only some of the parameters defined, and also not give a default
	var searchCols = oSettings.aoPreSearchCols;
	searchCols[iCol] = $.extend({}, DataTable.models.oSearch, searchCols[iCol]);
}


/**
 * Apply options for a column
 *  @param {object} oSettings dataTables settings object
 *  @param {int} iCol column index to consider
 *  @param {object} oOptions object with sType, bVisible and bSearchable etc
 *  @memberof DataTable#oApi
 */
function _fnColumnOptions(oSettings, iCol, oOptions) {
	var oCol = oSettings.aoColumns[iCol];

	/* User specified column options */
	if (oOptions !== undefined && oOptions !== null) {
		// Backwards compatibility
		_fnCompatCols(oOptions);

		// Map camel case parameters to their Hungarian counterparts
		_fnCamelToHungarian(DataTable.defaults.column, oOptions, true);

		/* Backwards compatibility for mDataProp */
		if (oOptions.mDataProp !== undefined && !oOptions.mData) {
			oOptions.mData = oOptions.mDataProp;
		}

		if (oOptions.sType) {
			oCol._sManualType = oOptions.sType;
		}

		// `class` is a reserved word in Javascript, so we need to provide
		// the ability to use a valid name for the camel case input
		if (oOptions.className && !oOptions.sClass) {
			oOptions.sClass = oOptions.className;
		}

		var origClass = oCol.sClass;

		$.extend(oCol, oOptions);
		_fnMap(oCol, oOptions, "sWidth", "sWidthOrig");

		// Merge class from previously defined classes with this one, rather than just
		// overwriting it in the extend above
		if (origClass !== oCol.sClass) {
			oCol.sClass = origClass + ' ' + oCol.sClass;
		}

		/* iDataSort to be applied (backwards compatibility), but aDataSort will take
		 * priority if defined
		 */
		if (oOptions.iDataSort !== undefined) {
			oCol.aDataSort = [oOptions.iDataSort];
		}
		_fnMap(oCol, oOptions, "aDataSort");
	}

	/* Cache the data get and set functions for speed */
	var mDataSrc = oCol.mData;
	var mData = _fnGetObjectDataFn(mDataSrc);

	// The `render` option can be given as an array to access the helper rendering methods.
	// The first element is the rendering method to use, the rest are the parameters to pass
	if (oCol.mRender && Array.isArray(oCol.mRender)) {
		var copy = oCol.mRender.slice();
		var name = copy.shift();

		oCol.mRender = DataTable.render[name].apply(window, copy);
	}

	oCol._render = oCol.mRender ? _fnGetObjectDataFn(oCol.mRender) : null;

	var attrTest = function (src) {
		return typeof src === 'string' && src.indexOf('@') !== -1;
	};
	oCol._bAttrSrc = $.isPlainObject(mDataSrc) && (
		attrTest(mDataSrc.sort) || attrTest(mDataSrc.type) || attrTest(mDataSrc.filter)
	);
	oCol._setter = null;

	oCol.fnGetData = function (rowData, type, meta) {
		var innerData = mData(rowData, type, undefined, meta);

		return oCol._render && type ?
			oCol._render(innerData, type, rowData, meta) :
			innerData;
	};
	oCol.fnSetData = function (rowData, val, meta) {
		return _fnSetObjectDataFn(mDataSrc)(rowData, val, meta);
	};

	// Indicate if DataTables should read DOM data as an object or array
	// Used in _fnGetRowElements
	if (typeof mDataSrc !== 'number' && !oCol._isArrayHost) {
		oSettings._rowReadObject = true;
	}

	/* Feature sorting overrides column specific when off */
	if (!oSettings.oFeatures.bSort) {
		oCol.bSortable = false;
	}
}


/**
 * Adjust the table column widths for new data. Note: you would probably want to
 * do a redraw after calling this function!
 *  @param {object} settings dataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnAdjustColumnSizing(settings) {
	_fnCalculateColumnWidths(settings);
	_fnColumnSizes(settings);

	var scroll = settings.oScroll;
	if (scroll.sY !== '' || scroll.sX !== '') {
		_fnScrollDraw(settings);
	}

	_fnCallbackFire(settings, null, 'column-sizing', [settings]);
}

/**
 * Apply column sizes
 *
 * @param {*} settings DataTables settings object
 */
function _fnColumnSizes(settings) {
	var cols = settings.aoColumns;

	for (var i = 0; i < cols.length; i++) {
		var width = _fnColumnsSumWidth(settings, [i], false, false);

		// Need to set the min-width, otherwise the browser might try to collapse
		// it further
		cols[i].colEl
			.css('width', width)
			.css('min-width', width);
	}
}


/**
 * Convert the index of a visible column to the index in the data array (take account
 * of hidden columns)
 *  @param {object} oSettings dataTables settings object
 *  @param {int} iMatch Visible column index to lookup
 *  @returns {int} i the data index
 *  @memberof DataTable#oApi
 */
function _fnVisibleToColumnIndex(oSettings, iMatch) {
	var aiVis = _fnGetColumns(oSettings, 'bVisible');

	return typeof aiVis[iMatch] === 'number' ?
		aiVis[iMatch] :
		null;
}


/**
 * Convert the index of an index in the data array and convert it to the visible
 *   column index (take account of hidden columns)
 *  @param {int} iMatch Column index to lookup
 *  @param {object} oSettings dataTables settings object
 *  @returns {int} i the data index
 *  @memberof DataTable#oApi
 */
function _fnColumnIndexToVisible(oSettings, iMatch) {
	var aiVis = _fnGetColumns(oSettings, 'bVisible');
	var iPos = aiVis.indexOf(iMatch);

	return iPos !== -1 ? iPos : null;
}


/**
 * Get the number of visible columns
 *  @param {object} oSettings dataTables settings object
 *  @returns {int} i the number of visible columns
 *  @memberof DataTable#oApi
 */
function _fnVisbleColumns(settings) {
	var layout = settings.aoHeader;
	var columns = settings.aoColumns;
	var vis = 0;

	if (layout.length) {
		for (var i = 0, ien = layout[0].length; i < ien; i++) {
			if (columns[i].bVisible && $(layout[0][i].cell).css('display') !== 'none') {
				vis++;
			}
		}
	}

	return vis;
}


/**
 * Get an array of column indexes that match a given property
 *  @param {object} oSettings dataTables settings object
 *  @param {string} sParam Parameter in aoColumns to look for - typically
 *    bVisible or bSearchable
 *  @returns {array} Array of indexes with matched properties
 *  @memberof DataTable#oApi
 */
function _fnGetColumns(oSettings, sParam) {
	var a = [];

	oSettings.aoColumns.map(function (val, i) {
		if (val[sParam]) {
			a.push(i);
		}
	});

	return a;
}

/**
 * Allow the result from a type detection function to be `true` while
 * translating that into a string. Old type detection functions will
 * return the type name if it passes. An obect store would be better,
 * but not backwards compatible.
 *
 * @param {*} typeDetect Object or function for type detection
 * @param {*} res Result from the type detection function
 * @returns Type name or false
 */
function _typeResult(typeDetect, res) {
	return res === true
		? typeDetect.name
		: res;
}

/**
 * Calculate the 'type' of a column
 *  @param {object} settings dataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnColumnTypes(settings) {
	var columns = settings.aoColumns;
	var data = settings.aoData;
	var types = DataTable.ext.type.detect;
	var i, ien, j, jen, k, ken;
	var col, detectedType, cache;

	// For each column, spin over the data type detection functions, seeing if one matches
	for (i = 0, ien = columns.length; i < ien; i++) {
		col = columns[i];
		cache = [];

		if (!col.sType && col._sManualType) {
			col.sType = col._sManualType;
		}
		else if (!col.sType) {
			// With SSP type detection can be unreliable and error prone, so we provide a way
			// to turn it off.
			if (!settings.typeDetect) {
				return;
			}

			for (j = 0, jen = types.length; j < jen; j++) {
				var typeDetect = types[j];

				// There can be either one, or three type detection functions
				var oneOf = typeDetect.oneOf;
				var allOf = typeDetect.allOf || typeDetect;
				var init = typeDetect.init;
				var one = false;

				detectedType = null;

				// Fast detect based on column assignment
				if (init) {
					detectedType = _typeResult(typeDetect, init(settings, col, i));

					if (detectedType) {
						col.sType = detectedType;
						break;
					}
				}

				for (k = 0, ken = data.length; k < ken; k++) {
					if (!data[k]) {
						continue;
					}

					// Use a cache array so we only need to get the type data
					// from the formatter once (when using multiple detectors)
					if (cache[k] === undefined) {
						cache[k] = _fnGetCellData(settings, k, i, 'type');
					}

					// Only one data point in the column needs to match this function
					if (oneOf && !one) {
						one = _typeResult(typeDetect, oneOf(cache[k], settings));
					}

					// All data points need to match this function
					detectedType = _typeResult(typeDetect, allOf(cache[k], settings));

					// If null, then this type can't apply to this column, so
					// rather than testing all cells, break out. There is an
					// exception for the last type which is `html`. We need to
					// scan all rows since it is possible to mix string and HTML
					// types
					if (!detectedType && j !== types.length - 3) {
						break;
					}

					// Only a single match is needed for html type since it is
					// bottom of the pile and very similar to string - but it
					// must not be empty
					if (detectedType === 'html' && !_empty(cache[k])) {
						break;
					}
				}

				// Type is valid for all data points in the column - use this
				// type
				if ((oneOf && one && detectedType) || (!oneOf && detectedType)) {
					col.sType = detectedType;
					break;
				}
			}

			// Fall back - if no type was detected, always use string
			if (!col.sType) {
				col.sType = 'string';
			}
		}

		// Set class names for header / footer for auto type classes
		var autoClass = _ext.type.className[col.sType];

		if (autoClass) {
			_columnAutoClass(settings.aoHeader, i, autoClass);
			_columnAutoClass(settings.aoFooter, i, autoClass);
		}

		var renderer = _ext.type.render[col.sType];

		// This can only happen once! There is no way to remove
		// a renderer. After the first time the renderer has
		// already been set so createTr will run the renderer itself.
		if (renderer && !col._render) {
			col._render = DataTable.util.get(renderer);

			_columnAutoRender(settings, i);
		}
	}
}

/**
 * Apply an auto detected renderer to data which doesn't yet have
 * a renderer
 */
function _columnAutoRender(settings, colIdx) {
	var data = settings.aoData;

	for (var i = 0; i < data.length; i++) {
		if (data[i].nTr) {
			// We have to update the display here since there is no
			// invalidation check for the data
			var display = _fnGetCellData(settings, i, colIdx, 'display');

			data[i].displayData[colIdx] = display;
			_fnWriteCell(data[i].anCells[colIdx], display);

			// No need to update sort / filter data since it has
			// been invalidated and will be re-read with the
			// renderer now applied
		}
	}
}

/**
 * Apply a class name to a column's header cells
 */
function _columnAutoClass(container, colIdx, className) {
	container.forEach(function (row) {
		if (row[colIdx] && row[colIdx].unique) {
			_addClass(row[colIdx].cell, className);
		}
	});
}

/**
 * Take the column definitions and static columns arrays and calculate how
 * they relate to column indexes. The callback function will then apply the
 * definition found for a column to a suitable configuration object.
 *  @param {object} oSettings dataTables settings object
 *  @param {array} aoColDefs The aoColumnDefs array that is to be applied
 *  @param {array} aoCols The aoColumns array that defines columns individually
 *  @param {array} headerLayout Layout for header as it was loaded
 *  @param {function} fn Callback function - takes two parameters, the calculated
 *    column index and the definition for that column.
 *  @memberof DataTable#oApi
 */
function _fnApplyColumnDefs(oSettings, aoColDefs, aoCols, headerLayout, fn) {
	var i, iLen, j, jLen, k, kLen, def;
	var columns = oSettings.aoColumns;

	if (aoCols) {
		for (i = 0, iLen = aoCols.length; i < iLen; i++) {
			if (aoCols[i] && aoCols[i].name) {
				columns[i].sName = aoCols[i].name;
			}
		}
	}

	// Column definitions with aTargets
	if (aoColDefs) {
		/* Loop over the definitions array - loop in reverse so first instance has priority */
		for (i = aoColDefs.length - 1; i >= 0; i--) {
			def = aoColDefs[i];

			/* Each definition can target multiple columns, as it is an array */
			var aTargets = def.target !== undefined
				? def.target
				: def.targets !== undefined
					? def.targets
					: def.aTargets;

			if (!Array.isArray(aTargets)) {
				aTargets = [aTargets];
			}

			for (j = 0, jLen = aTargets.length; j < jLen; j++) {
				var target = aTargets[j];

				if (typeof target === 'number' && target >= 0) {
					/* Add columns that we don't yet know about */
					while (columns.length <= target) {
						_fnAddColumn(oSettings);
					}

					/* Integer, basic index */
					fn(target, def);
				}
				else if (typeof target === 'number' && target < 0) {
					/* Negative integer, right to left column counting */
					fn(columns.length + target, def);
				}
				else if (typeof target === 'string') {
					for (k = 0, kLen = columns.length; k < kLen; k++) {
						if (target === '_all') {
							// Apply to all columns
							fn(k, def);
						}
						else if (target.indexOf(':name') !== -1) {
							// Column selector
							if (columns[k].sName === target.replace(':name', '')) {
								fn(k, def);
							}
						}
						else {
							// Cell selector
							headerLayout.forEach(function (row) {
								if (row[k]) {
									var cell = $(row[k].cell);

									// Legacy support. Note that it means that we don't support
									// an element name selector only, since they are treated as
									// class names for 1.x compat.
									if (target.match(/^[a-z][\w-]*$/i)) {
										target = '.' + target;
									}

									if (cell.is(target)) {
										fn(k, def);
									}
								}
							});
						}
					}
				}
			}
		}
	}

	// Statically defined columns array
	if (aoCols) {
		for (i = 0, iLen = aoCols.length; i < iLen; i++) {
			fn(i, aoCols[i]);
		}
	}
}


/**
 * Get the width for a given set of columns
 *
 * @param {*} settings DataTables settings object
 * @param {*} targets Columns - comma separated string or array of numbers
 * @param {*} original Use the original width (true) or calculated (false)
 * @param {*} incVisible Include visible columns (true) or not (false)
 * @returns Combined CSS value
 */
function _fnColumnsSumWidth(settings, targets, original, incVisible) {
	if (!Array.isArray(targets)) {
		targets = _fnColumnsFromHeader(targets);
	}

	var sum = 0;
	var unit;
	var columns = settings.aoColumns;

	for (var i = 0, ien = targets.length; i < ien; i++) {
		var column = columns[targets[i]];
		var definedWidth = original ?
			column.sWidthOrig :
			column.sWidth;

		if (!incVisible && column.bVisible === false) {
			continue;
		}

		if (definedWidth === null || definedWidth === undefined) {
			return null; // can't determine a defined width - browser defined
		}
		else if (typeof definedWidth === 'number') {
			unit = 'px';
			sum += definedWidth;
		}
		else {
			var matched = definedWidth.match(/([\d\.]+)([^\d]*)/);

			if (matched) {
				sum += matched[1] * 1;
				unit = matched.length === 3 ?
					matched[2] :
					'px';
			}
		}
	}

	return sum + unit;
}

function _fnColumnsFromHeader(cell) {
	var attr = $(cell).closest('[data-dt-column]').attr('data-dt-column');

	if (!attr) {
		return [];
	}

	return attr.split(',').map(function (val) {
		return val * 1;
	});
}

// #endregion

// #region core.data.js

/**
 * Add a data array to the table, creating DOM node etc. This is the parallel to
 * _fnGatherData, but for adding rows from a Javascript source, rather than a
 * DOM source.
 *  @param {object} settings dataTables settings object
 *  @param {array} data data array to be added
 *  @param {node} [tr] TR element to add to the table - optional. If not given,
 *    DataTables will create a row automatically
 *  @param {array} [tds] Array of TD|TH elements for the row - must be given
 *    if nTr is.
 *  @returns {int} >=0 if successful (index of new aoData entry), -1 if failed
 *  @memberof DataTable#oApi
 */
function _fnAddData ( settings, dataIn, tr, tds )
{
	/* Create the object for storing information about this new row */
	var rowIdx = settings.aoData.length;
	var rowModel = $.extend( true, {}, DataTable.models.oRow, {
		src: tr ? 'dom' : 'data',
		idx: rowIdx
	} );

	rowModel._aData = dataIn;
	settings.aoData.push( rowModel );

	var columns = settings.aoColumns;

	for ( var i=0, iLen=columns.length ; i<iLen ; i++ )
	{
		// Invalidate the column types as the new data needs to be revalidated
		columns[i].sType = null;
	}

	/* Add to the display array */
	settings.aiDisplayMaster.push( rowIdx );

	var id = settings.rowIdFn( dataIn );
	if ( id !== undefined ) {
		settings.aIds[ id ] = rowModel;
	}

	/* Create the DOM information, or register it if already present */
	if ( tr || ! settings.oFeatures.bDeferRender )
	{
		_fnCreateTr( settings, rowIdx, tr, tds );
	}

	return rowIdx;
}

/**
 * Add one or more TR elements to the table. Generally we'd expect to
 * use this for reading data from a DOM sourced table, but it could be
 * used for an TR element. Note that if a TR is given, it is used (i.e.
 * it is not cloned).
 *  @param {object} settings dataTables settings object
 *  @param {array|node|jQuery} trs The TR element(s) to add to the table
 *  @returns {array} Array of indexes for the added rows
 *  @memberof DataTable#oApi
 */
function _fnAddTr( settings, trs )
{
	var row;

	// Allow an individual node to be passed in
	if ( ! (trs instanceof $) ) {
		trs = $(trs);
	}

	return trs.map( function (i, el) {
		row = _fnGetRowElements( settings, el );
		return _fnAddData( settings, row.data, el, row.cells );
	} );
}


/**
 * Get the data for a given cell from the internal cache, taking into account data mapping
 *  @param {object} settings dataTables settings object
 *  @param {int} rowIdx aoData row id
 *  @param {int} colIdx Column index
 *  @param {string} type data get type ('display', 'type' 'filter|search' 'sort|order')
 *  @returns {*} Cell data
 *  @memberof DataTable#oApi
 */
function _fnGetCellData( settings, rowIdx, colIdx, type )
{
	if (type === 'search') {
		type = 'filter';
	}
	else if (type === 'order') {
		type = 'sort';
	}

	var row = settings.aoData[rowIdx];

	if (! row) {
		return undefined;
	}

	var draw           = settings.iDraw;
	var col            = settings.aoColumns[colIdx];
	var rowData        = row._aData;
	var defaultContent = col.sDefaultContent;
	var cellData       = col.fnGetData( rowData, type, {
		settings: settings,
		row:      rowIdx,
		col:      colIdx
	} );

	// Allow for a node being returned for non-display types
	if (type !== 'display' && cellData && typeof cellData === 'object' && cellData.nodeName) {
		cellData = cellData.innerHTML;
	}

	if ( cellData === undefined ) {
		if ( settings.iDrawError != draw && defaultContent === null ) {
			_fnLog( settings, 0, "Requested unknown parameter "+
				(typeof col.mData=='function' ? '{function}' : "'"+col.mData+"'")+
				" for row "+rowIdx+", column "+colIdx, 4 );
			settings.iDrawError = draw;
		}
		return defaultContent;
	}

	// When the data source is null and a specific data type is requested (i.e.
	// not the original data), we can use default column data
	if ( (cellData === rowData || cellData === null) && defaultContent !== null && type !== undefined ) {
		cellData = defaultContent;
	}
	else if ( typeof cellData === 'function' ) {
		// If the data source is a function, then we run it and use the return,
		// executing in the scope of the data object (for instances)
		return cellData.call( rowData );
	}

	if ( cellData === null && type === 'display' ) {
		return '';
	}

	if ( type === 'filter' ) {
		var fomatters = DataTable.ext.type.search;

		if ( fomatters[ col.sType ] ) {
			cellData = fomatters[ col.sType ]( cellData );
		}
	}

	return cellData;
}


/**
 * Set the value for a specific cell, into the internal data cache
 *  @param {object} settings dataTables settings object
 *  @param {int} rowIdx aoData row id
 *  @param {int} colIdx Column index
 *  @param {*} val Value to set
 *  @memberof DataTable#oApi
 */
function _fnSetCellData( settings, rowIdx, colIdx, val )
{
	var col     = settings.aoColumns[colIdx];
	var rowData = settings.aoData[rowIdx]._aData;

	col.fnSetData( rowData, val, {
		settings: settings,
		row:      rowIdx,
		col:      colIdx
	}  );
}

/**
 * Write a value to a cell
 * @param {*} td Cell
 * @param {*} val Value
 */
function _fnWriteCell(td, val)
{
	if (val && typeof val === 'object' && val.nodeName) {
		$(td)
			.empty()
			.append(val);
	}
	else {
		td.innerHTML = val;
	}
}


// Private variable that is used to match action syntax in the data property object
var __reArray = /\[.*?\]$/;
var __reFn = /\(\)$/;

/**
 * Split string on periods, taking into account escaped periods
 * @param  {string} str String to split
 * @return {array} Split string
 */
function _fnSplitObjNotation( str )
{
	var parts = str.match(/(\\.|[^.])+/g) || [''];

	return parts.map( function ( s ) {
		return s.replace(/\\\./g, '.');
	} );
}


/**
 * Return a function that can be used to get data from a source object, taking
 * into account the ability to use nested objects as a source
 *  @param {string|int|function} mSource The data source for the object
 *  @returns {function} Data get function
 *  @memberof DataTable#oApi
 */
var _fnGetObjectDataFn = DataTable.util.get;


/**
 * Return a function that can be used to set data from a source object, taking
 * into account the ability to use nested objects as a source
 *  @param {string|int|function} mSource The data source for the object
 *  @returns {function} Data set function
 *  @memberof DataTable#oApi
 */
var _fnSetObjectDataFn = DataTable.util.set;


/**
 * Return an array with the full table data
 *  @param {object} oSettings dataTables settings object
 *  @returns array {array} aData Master data array
 *  @memberof DataTable#oApi
 */
function _fnGetDataMaster ( settings )
{
	return _pluck( settings.aoData, '_aData' );
}


/**
 * Nuke the table
 *  @param {object} oSettings dataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnClearTable( settings )
{
	settings.aoData.length = 0;
	settings.aiDisplayMaster.length = 0;
	settings.aiDisplay.length = 0;
	settings.aIds = {};
}


/**
 * Mark cached data as invalid such that a re-read of the data will occur when
 * the cached data is next requested. Also update from the data source object.
 *
 * @param {object} settings DataTables settings object
 * @param {int}    rowIdx   Row index to invalidate
 * @param {string} [src]    Source to invalidate from: undefined, 'auto', 'dom'
 *     or 'data'
 * @param {int}    [colIdx] Column index to invalidate. If undefined the whole
 *     row will be invalidated
 * @memberof DataTable#oApi
 *
 * @todo For the modularisation of v1.11 this will need to become a callback, so
 *   the sort and filter methods can subscribe to it. That will required
 *   initialisation options for sorting, which is why it is not already baked in
 */
function _fnInvalidate( settings, rowIdx, src, colIdx )
{
	var row = settings.aoData[ rowIdx ];
	var i, ien;

	// Remove the cached data for the row
	row._aSortData = null;
	row._aFilterData = null;
	row.displayData = null;

	// Are we reading last data from DOM or the data object?
	if ( src === 'dom' || ((! src || src === 'auto') && row.src === 'dom') ) {
		// Read the data from the DOM
		row._aData = _fnGetRowElements(
				settings, row, colIdx, colIdx === undefined ? undefined : row._aData
			)
			.data;
	}
	else {
		// Reading from data object, update the DOM
		var cells = row.anCells;
		var display = _fnGetRowDisplay(settings, rowIdx);

		if ( cells ) {
			if ( colIdx !== undefined ) {
				_fnWriteCell(cells[colIdx], display[colIdx]);
			}
			else {
				for ( i=0, ien=cells.length ; i<ien ; i++ ) {
					_fnWriteCell(cells[i], display[i]);
				}
			}
		}
	}

	// Column specific invalidation
	var cols = settings.aoColumns;
	if ( colIdx !== undefined ) {
		// Type - the data might have changed
		cols[ colIdx ].sType = null;

		// Max length string. Its a fairly cheep recalculation, so not worth
		// something more complicated
		cols[ colIdx ].maxLenString = null;
	}
	else {
		for ( i=0, ien=cols.length ; i<ien ; i++ ) {
			cols[i].sType = null;
			cols[i].maxLenString = null;
		}

		// Update DataTables special `DT_*` attributes for the row
		_fnRowAttributes( settings, row );
	}
}


/**
 * Build a data source object from an HTML row, reading the contents of the
 * cells that are in the row.
 *
 * @param {object} settings DataTables settings object
 * @param {node|object} TR element from which to read data or existing row
 *   object from which to re-read the data from the cells
 * @param {int} [colIdx] Optional column index
 * @param {array|object} [d] Data source object. If `colIdx` is given then this
 *   parameter should also be given and will be used to write the data into.
 *   Only the column in question will be written
 * @returns {object} Object with two parameters: `data` the data read, in
 *   document order, and `cells` and array of nodes (they can be useful to the
 *   caller, so rather than needing a second traversal to get them, just return
 *   them from here).
 * @memberof DataTable#oApi
 */
function _fnGetRowElements( settings, row, colIdx, d )
{
	var
		tds = [],
		td = row.firstChild,
		name, col, i=0, contents,
		columns = settings.aoColumns,
		objectRead = settings._rowReadObject;

	// Allow the data object to be passed in, or construct
	d = d !== undefined ?
		d :
		objectRead ?
			{} :
			[];

	var attr = function ( str, td  ) {
		if ( typeof str === 'string' ) {
			var idx = str.indexOf('@');

			if ( idx !== -1 ) {
				var attr = str.substring( idx+1 );
				var setter = _fnSetObjectDataFn( str );
				setter( d, td.getAttribute( attr ) );
			}
		}
	};

	// Read data from a cell and store into the data object
	var cellProcess = function ( cell ) {
		if ( colIdx === undefined || colIdx === i ) {
			col = columns[i];
			contents = (cell.innerHTML).trim();

			if ( col && col._bAttrSrc ) {
				var setter = _fnSetObjectDataFn( col.mData._ );
				setter( d, contents );

				attr( col.mData.sort, cell );
				attr( col.mData.type, cell );
				attr( col.mData.filter, cell );
			}
			else {
				// Depending on the `data` option for the columns the data can
				// be read to either an object or an array.
				if ( objectRead ) {
					if ( ! col._setter ) {
						// Cache the setter function
						col._setter = _fnSetObjectDataFn( col.mData );
					}
					col._setter( d, contents );
				}
				else {
					d[i] = contents;
				}
			}
		}

		i++;
	};

	if ( td ) {
		// `tr` element was passed in
		while ( td ) {
			name = td.nodeName.toUpperCase();

			if ( name == "TD" || name == "TH" ) {
				cellProcess( td );
				tds.push( td );
			}

			td = td.nextSibling;
		}
	}
	else {
		// Existing row object passed in
		tds = row.anCells;

		for ( var j=0, jen=tds.length ; j<jen ; j++ ) {
			cellProcess( tds[j] );
		}
	}

	// Read the ID from the DOM if present
	var rowNode = row.firstChild ? row : row.nTr;

	if ( rowNode ) {
		var id = rowNode.getAttribute( 'id' );

		if ( id ) {
			_fnSetObjectDataFn( settings.rowId )( d, id );
		}
	}

	return {
		data: d,
		cells: tds
	};
}

// #endregion

// #region core.draw.js

/**
 * Render and cache a row's display data for the columns, if required
 * @returns 
 */
function _fnGetRowDisplay(settings, rowIdx) {
	let rowModal = settings.aoData[rowIdx];
	let columns = settings.aoColumns;

	if (!rowModal.displayData) {
		// Need to render and cache
		rowModal.displayData = [];

		for (var colIdx = 0, len = columns.length; colIdx < len; colIdx++) {
			rowModal.displayData.push(
				_fnGetCellData(settings, rowIdx, colIdx, 'display')
			);
		}
	}

	return rowModal.displayData;
}

/**
 * Create a new TR element (and it's TD children) for a row
 *  @param {object} oSettings dataTables settings object
 *  @param {int} iRow Row to consider
 *  @param {node} [nTrIn] TR element to add to the table - optional. If not given,
 *    DataTables will create a row automatically
 *  @param {array} [anTds] Array of TD|TH elements for the row - must be given
 *    if nTr is.
 *  @memberof DataTable#oApi
 */
function _fnCreateTr(oSettings, iRow, nTrIn, anTds) {
	var
		row = oSettings.aoData[iRow],
		rowData = row._aData,
		cells = [],
		nTr, nTd, oCol,
		i, iLen, create,
		trClass = oSettings.oClasses.tbody.row;

	if (row.nTr === null) {
		nTr = nTrIn || document.createElement('tr');

		row.nTr = nTr;
		row.anCells = cells;

		_addClass(nTr, trClass);

		/* Use a private property on the node to allow reserve mapping from the node
		 * to the aoData array for fast look up
		 */
		nTr._DT_RowIndex = iRow;

		/* Special parameters can be given by the data source to be used on the row */
		_fnRowAttributes(oSettings, row);

		/* Process each column */
		for (i = 0, iLen = oSettings.aoColumns.length; i < iLen; i++) {
			oCol = oSettings.aoColumns[i];
			create = nTrIn && anTds[i] ? false : true;

			nTd = create ? document.createElement(oCol.sCellType) : anTds[i];

			if (!nTd) {
				_fnLog(oSettings, 0, 'Incorrect column count', 18);
			}

			nTd._DT_CellIndex = {
				row: iRow,
				column: i
			};

			cells.push(nTd);

			var display = _fnGetRowDisplay(oSettings, iRow);

			// Need to create the HTML if new, or if a rendering function is defined
			if (
				create ||
				(
					(oCol.mRender || oCol.mData !== i) &&
					(!$.isPlainObject(oCol.mData) || oCol.mData._ !== i + '.display')
				)
			) {
				_fnWriteCell(nTd, display[i]);
			}

			// column class
			_addClass(nTd, oCol.sClass);

			// Visibility - add or remove as required
			if (oCol.bVisible && create) {
				nTr.appendChild(nTd);
			}
			else if (!oCol.bVisible && !create) {
				nTd.parentNode.removeChild(nTd);
			}

			if (oCol.fnCreatedCell) {
				oCol.fnCreatedCell.call(oSettings.oInstance,
					nTd, _fnGetCellData(oSettings, iRow, i), rowData, iRow, i
				);
			}
		}

		_fnCallbackFire(oSettings, 'aoRowCreatedCallback', 'row-created', [nTr, rowData, iRow, cells]);
	}
	else {
		_addClass(row.nTr, trClass);
	}
}


/**
 * Add attributes to a row based on the special `DT_*` parameters in a data
 * source object.
 *  @param {object} settings DataTables settings object
 *  @param {object} DataTables row object for the row to be modified
 *  @memberof DataTable#oApi
 */
function _fnRowAttributes(settings, row) {
	var tr = row.nTr;
	var data = row._aData;

	if (tr) {
		var id = settings.rowIdFn(data);

		if (id) {
			tr.id = id;
		}

		if (data.DT_RowClass) {
			// Remove any classes added by DT_RowClass before
			var a = data.DT_RowClass.split(' ');
			row.__rowc = row.__rowc ?
				_unique(row.__rowc.concat(a)) :
				a;

			$(tr)
				.removeClass(row.__rowc.join(' '))
				.addClass(data.DT_RowClass);
		}

		if (data.DT_RowAttr) {
			$(tr).attr(data.DT_RowAttr);
		}

		if (data.DT_RowData) {
			$(tr).data(data.DT_RowData);
		}
	}
}


/**
 * Create the HTML header for the table
 *  @param {object} oSettings dataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnBuildHead(settings, side) {
	var classes = settings.oClasses;
	var columns = settings.aoColumns;
	var i, ien, row;
	var target = side === 'header'
		? settings.nTHead
		: settings.nTFoot;
	var titleProp = side === 'header' ? 'sTitle' : side;

	// Footer might be defined
	if (!target) {
		return;
	}

	// If no cells yet and we have content for them, then create
	if (side === 'header' || _pluck(settings.aoColumns, titleProp).join('')) {
		row = $('tr', target);

		// Add a row if needed
		if (!row.length) {
			row = $('<tr/>').appendTo(target)
		}

		// Add the number of cells needed to make up to the number of columns
		if (row.length === 1) {
			var cells = $('td, th', row);

			for (i = cells.length, ien = columns.length; i < ien; i++) {
				$('<th/>')
					.html(columns[i][titleProp] || '')
					.appendTo(row);
			}
		}
	}

	var detected = _fnDetectHeader(settings, target, true);

	if (side === 'header') {
		settings.aoHeader = detected;
	}
	else {
		settings.aoFooter = detected;
	}

	// ARIA role for the rows
	$(target).children('tr').attr('role', 'row');

	// Every cell needs to be passed through the renderer
	$(target).children('tr').children('th, td')
		.each(function () {
			_fnRenderer(settings, side)(
				settings, $(this), classes
			);
		});
}

/**
 * Build a layout structure for a header or footer
 *
 * @param {*} settings DataTables settings
 * @param {*} source Source layout array
 * @param {*} incColumns What columns should be included
 * @returns Layout array
 */
function _fnHeaderLayout(settings, source, incColumns) {
	var row, column, cell;
	var local = [];
	var structure = [];
	var columns = settings.aoColumns;
	var columnCount = columns.length;
	var rowspan, colspan;

	if (!source) {
		return;
	}

	// Default is to work on only visible columns
	if (!incColumns) {
		incColumns = _range(columnCount)
			.filter(function (idx) {
				return columns[idx].bVisible;
			});
	}

	// Make a copy of the master layout array, but with only the columns we want
	for (row = 0; row < source.length; row++) {
		// Remove any columns we haven't selected
		local[row] = source[row].slice().filter(function (cell, i) {
			return incColumns.includes(i);
		});

		// Prep the structure array - it needs an element for each row
		structure.push([]);
	}

	for (row = 0; row < local.length; row++) {
		for (column = 0; column < local[row].length; column++) {
			rowspan = 1;
			colspan = 1;

			// Check to see if there is already a cell (row/colspan) covering our target
			// insert point. If there is, then there is nothing to do.
			if (structure[row][column] === undefined) {
				cell = local[row][column].cell;

				// Expand for rowspan
				while (
					local[row + rowspan] !== undefined &&
					local[row][column].cell == local[row + rowspan][column].cell
				) {
					structure[row + rowspan][column] = null;
					rowspan++;
				}

				// And for colspan
				while (
					local[row][column + colspan] !== undefined &&
					local[row][column].cell == local[row][column + colspan].cell
				) {
					// Which also needs to go over rows
					for (var k = 0; k < rowspan; k++) {
						structure[row + k][column + colspan] = null;
					}

					colspan++;
				}

				var titleSpan = $('span.dt-column-title', cell);

				structure[row][column] = {
					cell: cell,
					colspan: colspan,
					rowspan: rowspan,
					title: titleSpan.length
						? titleSpan.html()
						: $(cell).html()
				};
			}
		}
	}

	return structure;
}


/**
 * Draw the header (or footer) element based on the column visibility states.
 *
 *  @param object oSettings dataTables settings object
 *  @param array aoSource Layout array from _fnDetectHeader
 *  @memberof DataTable#oApi
 */
function _fnDrawHead(settings, source) {
	var layout = _fnHeaderLayout(settings, source);
	var tr, n;

	for (var row = 0; row < source.length; row++) {
		tr = source[row].row;

		// All cells are going to be replaced, so empty out the row
		// Can't use $().empty() as that kills event handlers
		if (tr) {
			while ((n = tr.firstChild)) {
				tr.removeChild(n);
			}
		}

		for (var column = 0; column < layout[row].length; column++) {
			var point = layout[row][column];

			if (point) {
				$(point.cell)
					.appendTo(tr)
					.attr('rowspan', point.rowspan)
					.attr('colspan', point.colspan);
			}
		}
	}
}


/**
 * Insert the required TR nodes into the table for display
 *  @param {object} oSettings dataTables settings object
 *  @param ajaxComplete true after ajax call to complete rendering
 *  @memberof DataTable#oApi
 */
function _fnDraw(oSettings, ajaxComplete) {
	// Allow for state saving and a custom start position
	_fnStart(oSettings);

	/* Provide a pre-callback function which can be used to cancel the draw is false is returned */
	var aPreDraw = _fnCallbackFire(oSettings, 'aoPreDrawCallback', 'preDraw', [oSettings]);
	if (aPreDraw.indexOf(false) !== -1) {
		_fnProcessingDisplay(oSettings, false);
		return;
	}

	var anRows = [];
	var iRowCount = 0;
	var bServerSide = _fnDataSource(oSettings) == 'ssp';
	var aiDisplay = oSettings.aiDisplay;
	var iDisplayStart = oSettings._iDisplayStart;
	var iDisplayEnd = oSettings.fnDisplayEnd();
	var columns = oSettings.aoColumns;
	var body = $(oSettings.nTBody);

	oSettings.bDrawing = true;

	/* Server-side processing draw intercept */
	if (oSettings.deferLoading) {
		oSettings.deferLoading = false;
		oSettings.iDraw++;
		_fnProcessingDisplay(oSettings, false);
	}
	else if (!bServerSide) {
		oSettings.iDraw++;
	}
	else if (!oSettings.bDestroying && !ajaxComplete) {
		// Show loading message for server-side processing
		if (oSettings.iDraw === 0) {
			body.empty().append(_emptyRow(oSettings));
		}

		_fnAjaxUpdate(oSettings);
		return;
	}

	if (aiDisplay.length !== 0) {
		var iStart = bServerSide ? 0 : iDisplayStart;
		var iEnd = bServerSide ? oSettings.aoData.length : iDisplayEnd;

		for (var j = iStart; j < iEnd; j++) {
			var iDataIndex = aiDisplay[j];
			var aoData = oSettings.aoData[iDataIndex];
			if (aoData.nTr === null) {
				_fnCreateTr(oSettings, iDataIndex);
			}

			var nRow = aoData.nTr;

			// Add various classes as needed
			for (var i = 0; i < columns.length; i++) {
				var col = columns[i];
				var td = aoData.anCells[i];

				_addClass(td, _ext.type.className[col.sType]); // auto class
				_addClass(td, oSettings.oClasses.tbody.cell); // all cells
			}

			// Row callback functions - might want to manipulate the row
			// iRowCount and j are not currently documented. Are they at all
			// useful?
			_fnCallbackFire(oSettings, 'aoRowCallback', null,
				[nRow, aoData._aData, iRowCount, j, iDataIndex]);

			anRows.push(nRow);
			iRowCount++;
		}
	}
	else {
		anRows[0] = _emptyRow(oSettings);
	}

	/* Header and footer callbacks */
	_fnCallbackFire(oSettings, 'aoHeaderCallback', 'header', [$(oSettings.nTHead).children('tr')[0],
	_fnGetDataMaster(oSettings), iDisplayStart, iDisplayEnd, aiDisplay]);

	_fnCallbackFire(oSettings, 'aoFooterCallback', 'footer', [$(oSettings.nTFoot).children('tr')[0],
	_fnGetDataMaster(oSettings), iDisplayStart, iDisplayEnd, aiDisplay]);

	// replaceChildren is faster, but only became widespread in 2020,
	// so a fall back in jQuery is provided for older browsers.
	if (body[0].replaceChildren) {
		body[0].replaceChildren.apply(body[0], anRows);
	}
	else {
		body.children().detach();
		body.append($(anRows));
	}

	// Empty table needs a specific class
	$(oSettings.nTableWrapper).toggleClass('dt-empty-footer', $('tr', oSettings.nTFoot).length === 0);

	/* Call all required callback functions for the end of a draw */
	_fnCallbackFire(oSettings, 'aoDrawCallback', 'draw', [oSettings], true);

	/* Draw is complete, sorting and filtering must be as well */
	oSettings.bSorted = false;
	oSettings.bFiltered = false;
	oSettings.bDrawing = false;
}


/**
 * Redraw the table - taking account of the various features which are enabled
 *  @param {object} oSettings dataTables settings object
 *  @param {boolean} [holdPosition] Keep the current paging position. By default
 *    the paging is reset to the first page
 *  @memberof DataTable#oApi
 */
function _fnReDraw(settings, holdPosition, recompute) {
	var
		features = settings.oFeatures,
		sort = features.bSort,
		filter = features.bFilter;

	if (recompute === undefined || recompute === true) {
		// Resolve any column types that are unknown due to addition or invalidation
		_fnColumnTypes(settings);

		if (sort) {
			_fnSort(settings);
		}

		if (filter) {
			_fnFilterComplete(settings, settings.oPreviousSearch);
		}
		else {
			// No filtering, so we want to just use the display master
			settings.aiDisplay = settings.aiDisplayMaster.slice();
		}
	}

	if (holdPosition !== true) {
		settings._iDisplayStart = 0;
	}

	// Let any modules know about the draw hold position state (used by
	// scrolling internally)
	settings._drawHold = holdPosition;

	_fnDraw(settings);

	settings._drawHold = false;
}


/*
 * Table is empty - create a row with an empty message in it
 */
function _emptyRow(settings) {
	var oLang = settings.oLanguage;
	var zero = oLang.sZeroRecords;
	var dataSrc = _fnDataSource(settings);

	if (
		(settings.iDraw < 1 && dataSrc === 'ssp') ||
		(settings.iDraw <= 1 && dataSrc === 'ajax')
	) {
		zero = oLang.sLoadingRecords;
	}
	else if (oLang.sEmptyTable && settings.fnRecordsTotal() === 0) {
		zero = oLang.sEmptyTable;
	}

	return $('<tr/>')
		.append($('<td />', {
			'colSpan': _fnVisbleColumns(settings),
			'class': settings.oClasses.empty.row
		}).html(zero))[0];
}


/**
 * Expand the layout items into an object for the rendering function
 */
function _layoutItems(row, align, items) {
	if (Array.isArray(items)) {
		for (var i = 0; i < items.length; i++) {
			_layoutItems(row, align, items[i]);
		}

		return;
	}

	var rowCell = row[align];

	// If it is an object, then there can be multiple features contained in it
	if ($.isPlainObject(items)) {
		// A feature plugin cannot be named "features" due to this check
		if (items.features) {
			if (items.rowId) {
				row.id = items.rowId;
			}
			if (items.rowClass) {
				row.className = items.rowClass;
			}

			rowCell.id = items.id;
			rowCell.className = items.className;

			_layoutItems(row, align, items.features);
		}
		else {
			Object.keys(items).map(function (key) {
				rowCell.contents.push({
					feature: key,
					opts: items[key]
				});
			});
		}
	}
	else {
		rowCell.contents.push(items);
	}
}

/**
 * Find, or create a layout row
 */
function _layoutGetRow(rows, rowNum, align) {
	var row;

	// Find existing rows
	for (var i = 0; i < rows.length; i++) {
		row = rows[i];

		if (row.rowNum === rowNum) {
			// full is on its own, but start and end share a row
			if (
				(align === 'full' && row.full) ||
				((align === 'start' || align === 'end') && (row.start || row.end))
			) {
				if (!row[align]) {
					row[align] = {
						contents: []
					};
				}

				return row;
			}
		}
	}

	// If we get this far, then there was no match, create a new row
	row = {
		rowNum: rowNum
	};

	row[align] = {
		contents: []
	};

	rows.push(row);

	return row;
}

/**
 * Convert a `layout` object given by a user to the object structure needed
 * for the renderer. This is done twice, once for above and once for below
 * the table. Ordering must also be considered.
 *
 * @param {*} settings DataTables settings object
 * @param {*} layout Layout object to convert
 * @param {string} side `top` or `bottom`
 * @returns Converted array structure - one item for each row.
 */
function _layoutArray(settings, layout, side) {
	var rows = [];

	// Split out into an array
	$.each(layout, function (pos, items) {
		if (items === null) {
			return;
		}

		var parts = pos.match(/^([a-z]+)([0-9]*)([A-Za-z]*)$/);
		var rowNum = parts[2]
			? parts[2] * 1
			: 0;
		var align = parts[3]
			? parts[3].toLowerCase()
			: 'full';

		// Filter out the side we aren't interested in
		if (parts[1] !== side) {
			return;
		}

		// Get or create the row we should attach to
		var row = _layoutGetRow(rows, rowNum, align);

		_layoutItems(row, align, items);
	});

	// Order by item identifier
	rows.sort(function (a, b) {
		var order1 = a.rowNum;
		var order2 = b.rowNum;

		// If both in the same row, then the row with `full` comes first
		if (order1 === order2) {
			var ret = a.full && !b.full ? -1 : 1;

			return side === 'bottom'
				? ret * -1
				: ret;
		}

		return order2 - order1;
	});

	// Invert for below the table
	if (side === 'bottom') {
		rows.reverse();
	}

	for (var row = 0; row < rows.length; row++) {
		delete rows[row].rowNum;

		_layoutResolve(settings, rows[row]);
	}

	return rows;
}


/**
 * Convert the contents of a row's layout object to nodes that can be inserted
 * into the document by a renderer. Execute functions, look up plug-ins, etc.
 *
 * @param {*} settings DataTables settings object
 * @param {*} row Layout object for this row
 */
function _layoutResolve(settings, row) {
	var getFeature = function (feature, opts) {
		if (!_ext.features[feature]) {
			_fnLog(settings, 0, 'Unknown feature: ' + feature);
		}

		return _ext.features[feature].apply(this, [settings, opts]);
	};

	var resolve = function (item) {
		if (!row[item]) {
			return;
		}

		var line = row[item].contents;

		for (var i = 0, ien = line.length; i < ien; i++) {
			if (!line[i]) {
				continue;
			}
			else if (typeof line[i] === 'string') {
				line[i] = getFeature(line[i], null);
			}
			else if ($.isPlainObject(line[i])) {
				// If it's an object, it just has feature and opts properties from
				// the transform in _layoutArray
				line[i] = getFeature(line[i].feature, line[i].opts);
			}
			else if (typeof line[i].node === 'function') {
				line[i] = line[i].node(settings);
			}
			else if (typeof line[i] === 'function') {
				var inst = line[i](settings);

				line[i] = typeof inst.node === 'function' ?
					inst.node() :
					inst;
			}
		}
	};

	resolve('start');
	resolve('end');
	resolve('full');
}


/**
 * Add the options to the page HTML for the table
 *  @param {object} settings DataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnAddOptionsHtml(settings) {
	var classes = settings.classes;
	var table = $(settings.table);

	// Wrapper div around everything DataTables controls
	var insert = $('<div/>')
		.attr({
			id: settings.tableId + '_wrapper',
			'class': classes.container
		})
		.insertBefore(table);

	settings.tableWrapper = insert[0];

	if (settings.dom) {
		// Legacy
		_fnLayoutDom(settings, settings.dom, insert);
	}
	else {
		var top = _layoutArray(settings, settings.layout, 'top');
		var bottom = _layoutArray(settings, settings.layout, 'bottom');
		var renderer = _fnRenderer(settings, 'layout');

		// Everything above - the renderer will actually insert the contents into the document
		top.forEach(function (item) {
			renderer(settings, insert, item);
		});

		// The table - always the center of attention
		renderer(settings, insert, {
			full: {
				table: true,
				contents: [_fnFeatureHtmlTable(settings)]
			}
		});

		// Everything below
		bottom.forEach(function (item) {
			renderer(settings, insert, item);
		});
	}

	// Processing floats on top, so it isn't an inserted feature
	_processingHtml(settings);
}

/**
 * Draw the table with the legacy DOM property
 * @param {*} settings DT settings object
 * @param {*} dom DOM string
 * @param {*} insert Insert point
 */
function _fnLayoutDom(settings, dom, insert) {
	var parts = dom.match(/(".*?")|('.*?')|./g);
	var featureNode, option, newNode, next, attr;

	for (var i = 0; i < parts.length; i++) {
		featureNode = null;
		option = parts[i];

		if (option == '<') {
			// New container div
			newNode = $('<div/>');

			// Check to see if we should append an id and/or a class name to the container
			next = parts[i + 1];

			if (next[0] == "'" || next[0] == '"') {
				attr = next.replace(/['"]/g, '');

				var id = '', className;

				/* The attribute can be in the format of "#id.class", "#id" or "class" This logic
				 * breaks the string into parts and applies them as needed
				 */
				if (attr.indexOf('.') != -1) {
					var split = attr.split('.');

					id = split[0];
					className = split[1];
				}
				else if (attr[0] == "#") {
					id = attr;
				}
				else {
					className = attr;
				}

				newNode
					.attr('id', id.substring(1))
					.addClass(className);

				i++; // Move along the position array
			}

			insert.append(newNode);
			insert = newNode;
		}
		else if (option == '>') {
			// End container div
			insert = insert.parent();
		}
		else if (option == 't') {
			// Table
			featureNode = _fnFeatureHtmlTable(settings);
		}
		else {
			DataTable.ext.feature.forEach(function (feature) {
				if (option == feature.cFeature) {
					featureNode = feature.fnInit(settings);
				}
			});
		}

		// Add to the display
		if (featureNode) {
			insert.append(featureNode);
		}
	}
}


/**
 * Use the DOM source to create up an array of header cells. The idea here is to
 * create a layout grid (array) of rows x columns, which contains a reference
 * to the cell that that point in the grid (regardless of col/rowspan), such that
 * any column / row could be removed and the new grid constructed
 *  @param {node} thead The header/footer element for the table
 *  @returns {array} Calculated layout array
 *  @memberof DataTable#oApi
 */
function _fnDetectHeader(settings, thead, write) {
	var columns = settings.columns;
	var rows = $(thead).children('tr');
	var row, cell;
	var i, k, l, iLen, shifted, column, colspan, rowspan;
	var isHeader = thead && thead.nodeName.toLowerCase() === 'thead';
	var layout = [];
	var unique;
	var shift = function (a, i, j) {
		var k = a[i];
		while (k[j]) {
			j++;
		}
		return j;
	};

	// We know how many rows there are in the layout - so prep it
	for (i = 0, iLen = rows.length; i < iLen; i++) {
		layout.push([]);
	}

	for (i = 0, iLen = rows.length; i < iLen; i++) {
		row = rows[i];
		column = 0;

		// For every cell in the row..
		cell = row.firstChild;
		while (cell) {
			if (
				cell.nodeName.toUpperCase() == 'TD' ||
				cell.nodeName.toUpperCase() == 'TH'
			) {
				var cols = [];

				// Get the col and rowspan attributes from the DOM and sanitise them
				colspan = cell.getAttribute('colspan') * 1;
				rowspan = cell.getAttribute('rowspan') * 1;
				colspan = (!colspan || colspan === 0 || colspan === 1) ? 1 : colspan;
				rowspan = (!rowspan || rowspan === 0 || rowspan === 1) ? 1 : rowspan;

				// There might be colspan cells already in this row, so shift our target
				// accordingly
				shifted = shift(layout, i, column);

				// Cache calculation for unique columns
				unique = colspan === 1 ?
					true :
					false;

				// Perform header setup
				if (write) {
					if (unique) {
						// Allow column options to be set from HTML attributes
						_fnColumnOptions(settings, shifted, $(cell).data());

						// Get the width for the column. This can be defined from the
						// width attribute, style attribute or `columns.width` option
						var columnDef = columns[shifted];
						var width = cell.getAttribute('width') || null;
						var t = cell.style.width.match(/width:\s*(\d+[pxem%]+)/);
						if (t) {
							width = t[1];
						}

						columnDef.sWidthOrig = columnDef.sWidth || width;

						if (isHeader) {
							// Column title handling - can be user set, or read from the DOM
							// This happens before the render, so the original is still in place
							if (columnDef.sTitle !== null && !columnDef.autoTitle) {
								cell.innerHTML = columnDef.sTitle;
							}

							if (!columnDef.sTitle && unique) {
								columnDef.sTitle = _stripHtml(cell.innerHTML);
								columnDef.autoTitle = true;
							}
						}
						else {
							// Footer specific operations
							if (columnDef.footer) {
								cell.innerHTML = columnDef.footer;
							}
						}

						// Fall back to the aria-label attribute on the table header if no ariaTitle is
						// provided.
						if (!columnDef.ariaTitle) {
							columnDef.ariaTitle = $(cell).attr("aria-label") || columnDef.sTitle;
						}

						// Column specific class names
						if (columnDef.className) {
							$(cell).addClass(columnDef.className);
						}
					}

					// Wrap the column title so we can write to it in future
					if ($('span.dt-column-title', cell).length === 0) {
						$('<span>')
							.addClass('dt-column-title')
							.append(cell.childNodes)
							.appendTo(cell);
					}

					if (isHeader && $('span.dt-column-order', cell).length === 0) {
						$('<span>')
							.addClass('dt-column-order')
							.appendTo(cell);
					}
				}

				// If there is col / rowspan, copy the information into the layout grid
				for (l = 0; l < colspan; l++) {
					for (k = 0; k < rowspan; k++) {
						layout[i + k][shifted + l] = {
							cell: cell,
							unique: unique
						};

						layout[i + k].row = row;
					}

					cols.push(shifted + l);
				}

				// Assign an attribute so spanning cells can still be identified
				// as belonging to a column
				cell.setAttribute('data-dt-column', _unique(cols).join(','));
			}

			cell = cell.nextSibling;
		}
	}

	return layout;
}

/**
 * Set the start position for draw
 *  @param {object} oSettings dataTables settings object
 */
function _fnStart(oSettings) {
	var bServerSide = _fnDataSource(oSettings) == 'ssp';
	var iInitDisplayStart = oSettings.iInitDisplayStart;

	// Check and see if we have an initial draw position from state saving
	if (iInitDisplayStart !== undefined && iInitDisplayStart !== -1) {
		oSettings._iDisplayStart = bServerSide ?
			iInitDisplayStart :
			iInitDisplayStart >= oSettings.fnRecordsDisplay() ?
				0 :
				iInitDisplayStart;

		oSettings.iInitDisplayStart = -1;
	}
}

// #endregion

// _buildInclude('core.ajax.js');
// _buildInclude('core.filter.js');

// #region core.init.js

/**
 * Draw the table for the first time, adding all required features
 *  @param {object} settings dataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnInitialise(settings) {
	var deferLoading = settings.deferLoading;
	var dataSrc = _fnDataSource(settings);

	// Ensure that the table data is fully initialised
	if (!settings.bInitialised) {
		setTimeout(function () { _fnInitialise(settings); }, 200);
		return;
	}

	// Build the header / footer for the table
	_fnBuildHead(settings, 'header');
	_fnBuildHead(settings, 'footer');

	_fnDrawHead(settings, settings.header);
	_fnDrawHead(settings, settings.footer);

	// Local data load
	// Check if there is data passing into the constructor
	if (deferLoading || dataSrc == 'dom') {
		// Grab the data from the page
		_fnAddTr(settings, $(settings.nTBody).children('tr'));
	}

	// Filter not yet applied - copy the display master
	settings.display = settings.displayMaster.slice();

	// Enable features
	_fnAddOptionsHtml(settings);
	_fnSortInit(settings);

	_colGroup(settings);

	/* Okay to show that something is going on now */
	_fnProcessingDisplay(settings, true);

	_fnCallbackFire(settings, null, 'preInit', [settings], true);

	// If there is default sorting required - let's do it. The sort function
	// will do the drawing for us. Otherwise we draw the table regardless of the
	// Ajax source - this allows the table to look initialised for Ajax sourcing
	// data (show 'loading' message possibly)
	_fnReDraw(settings);
}

/**
 * Draw the table for the first time, adding all required features
 *  @param {object} settings dataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnInitComplete(settings) {
	if (settings._bInitComplete) {
		return;
	}

	var args = [settings, settings.json];

	settings._bInitComplete = true;

	// Table is fully set up and we have data, so calculate the
	// column widths
	_fnAdjustColumnSizing(settings);

	_fnCallbackFire(settings, null, 'plugin-init', args, true);
	_fnCallbackFire(settings, 'aoInitComplete', 'init', args, true);
}

// #endregion

// _buildInclude('core.length.js');
// _buildInclude('core.page.js');

// #region core.processing.js

/**
 * Generate the node required for the processing node
 *  @param {object} settings DataTables settings object
 */
function _processingHtml ( settings )
{
	var table = settings.nTable;
	var scrolling = settings.oScroll.sX !== '' || settings.oScroll.sY !== '';

	if ( settings.oFeatures.bProcessing ) {
		var n = $('<div/>', {
				'id': settings.sTableId + '_processing',
				'class': settings.oClasses.processing.container,
				'role': 'status'
			} )
			.html( settings.oLanguage.sProcessing )
			.append('<div><div></div><div></div><div></div><div></div></div>');

		// Different positioning depending on if scrolling is enabled or not
		if (scrolling) {
			n.prependTo( $('div.dt-scroll', settings.nTableWrapper) );
		}
		else {
			n.insertBefore( table );
		}

		$(table).on( 'processing.dt.DT', function (e, s, show) {
			n.css( 'display', show ? 'block' : 'none' );
		} );
	}
}


/**
 * Display or hide the processing indicator
 *  @param {object} settings DataTables settings object
 *  @param {bool} show Show the processing indicator (true) or not (false)
 */
function _fnProcessingDisplay ( settings, show )
{
	// Ignore cases when we are still redrawing
	if (settings.drawing && show === false) {
		return;
	}

	_fnCallbackFire( settings, null, 'processing', [settings, show] );
}

/**
 * Show the processing element if an action takes longer than a given time
 *
 * @param {*} settings DataTables settings object
 * @param {*} enable Do (true) or not (false) async processing (local feature enablement)
 * @param {*} run Function to run
 */
function _fnProcessingRun( settings, enable, run ) {
	if (! enable) {
		// Immediate execution, synchronous
		run();
	}
	else {
		_fnProcessingDisplay(settings, true);
		
		// Allow the processing display to show if needed
		setTimeout(function () {
			run();

			_fnProcessingDisplay(settings, false);
		}, 0);
	}
}

// #endregion

// _buildInclude('core.scrolling.js');

// #region core.scrolling.js

/**
 * Add any control elements for the table - specifically scrolling
 *  @param {object} settings dataTables settings object
 *  @returns {node} Node to add to the DOM
 *  @memberof DataTable#oApi
 */
function _fnFeatureHtmlTable ( settings )
{
	var table = $(settings.nTable);

	// Scrolling from here on in
	var scroll = settings.oScroll;

	if ( scroll.sX === '' && scroll.sY === '' ) {
		return settings.nTable;
	}

	var scrollX = scroll.sX;
	var scrollY = scroll.sY;
	var classes = settings.oClasses.scrolling;
	var caption = settings.captionNode;
	var captionSide = caption ? caption._captionSide : null;
	var headerClone = $( table[0].cloneNode(false) );
	var footerClone = $( table[0].cloneNode(false) );
	var footer = table.children('tfoot');
	var _div = '<div/>';
	var size = function ( s ) {
		return !s ? null : _fnStringToCss( s );
	};

	if ( ! footer.length ) {
		footer = null;
	}

	/*
	 * The HTML structure that we want to generate in this function is:
	 *  div - scroller
	 *    div - scroll head
	 *      div - scroll head inner
	 *        table - scroll head table
	 *          thead - thead
	 *    div - scroll body
	 *      table - table (master table)
	 *        thead - thead clone for sizing
	 *        tbody - tbody
	 *    div - scroll foot
	 *      div - scroll foot inner
	 *        table - scroll foot table
	 *          tfoot - tfoot
	 */
	var scroller = $( _div, { 'class': classes.container } )
		.append(
			$(_div, { 'class': classes.header.self } )
				.css( {
					overflow: 'hidden',
					position: 'relative',
					border: 0,
					width: scrollX ? size(scrollX) : '100%'
				} )
				.append(
					$(_div, { 'class': classes.header.inner } )
						.css( {
							'box-sizing': 'content-box',
							width: scroll.sXInner || '100%'
						} )
						.append(
							headerClone
								.removeAttr('id')
								.css( 'margin-left', 0 )
								.append( captionSide === 'top' ? caption : null )
								.append(
									table.children('thead')
								)
						)
				)
		)
		.append(
			$(_div, { 'class': classes.body } )
				.css( {
					position: 'relative',
					overflow: 'auto',
					width: size( scrollX )
				} )
				.append( table )
		);

	if ( footer ) {
		scroller.append(
			$(_div, { 'class': classes.footer.self } )
				.css( {
					overflow: 'hidden',
					border: 0,
					width: scrollX ? size(scrollX) : '100%'
				} )
				.append(
					$(_div, { 'class': classes.footer.inner } )
						.append(
							footerClone
								.removeAttr('id')
								.css( 'margin-left', 0 )
								.append( captionSide === 'bottom' ? caption : null )
								.append(
									table.children('tfoot')
								)
						)
				)
		);
	}

	var children = scroller.children();
	var scrollHead = children[0];
	var scrollBody = children[1];
	var scrollFoot = footer ? children[2] : null;

	// When the body is scrolled, then we also want to scroll the headers
	$(scrollBody).on( 'scroll.DT', function () {
		var scrollLeft = this.scrollLeft;

		scrollHead.scrollLeft = scrollLeft;

		if ( footer ) {
			scrollFoot.scrollLeft = scrollLeft;
		}
	} );

	// When focus is put on the header cells, we might need to scroll the body
	$('th, td', scrollHead).on('focus', function () {
		var scrollLeft = scrollHead.scrollLeft;

		scrollBody.scrollLeft = scrollLeft;

		if ( footer ) {
			scrollBody.scrollLeft = scrollLeft;
		}
	});

	$(scrollBody).css('max-height', scrollY);
	if (! scroll.bCollapse) {
		$(scrollBody).css('height', scrollY);
	}

	settings.nScrollHead = scrollHead;
	settings.nScrollBody = scrollBody;
	settings.nScrollFoot = scrollFoot;

	// On redraw - align columns
	settings.aoDrawCallback.push(_fnScrollDraw);

	return scroller[0];
}



/**
 * Update the header, footer and body tables for resizing - i.e. column
 * alignment.
 *
 * Welcome to the most horrible function DataTables. The process that this
 * function follows is basically:
 *   1. Re-create the table inside the scrolling div
 *   2. Correct colgroup > col values if needed
 *   3. Copy colgroup > col over to header and footer
 *   4. Clean up
 *
 *  @param {object} settings dataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnScrollDraw ( settings )
{
	// Given that this is such a monster function, a lot of variables are use
	// to try and keep the minimised size as small as possible
	var
		scroll         = settings.oScroll,
		barWidth       = scroll.iBarWidth,
		divHeader      = $(settings.nScrollHead),
		divHeaderInner = divHeader.children('div'),
		divHeaderTable = divHeaderInner.children('table'),
		divBodyEl      = settings.nScrollBody,
		divBody        = $(divBodyEl),
		divFooter      = $(settings.nScrollFoot),
		divFooterInner = divFooter.children('div'),
		divFooterTable = divFooterInner.children('table'),
		header         = $(settings.nTHead),
		table          = $(settings.nTable),
		footer         = settings.nTFoot && $('th, td', settings.nTFoot).length ? $(settings.nTFoot) : null,
		browser        = settings.oBrowser,
		headerCopy, footerCopy;

	// If the scrollbar visibility has changed from the last draw, we need to
	// adjust the column sizes as the table width will have changed to account
	// for the scrollbar
	var scrollBarVis = divBodyEl.scrollHeight > divBodyEl.clientHeight;
	
	if ( settings.scrollBarVis !== scrollBarVis && settings.scrollBarVis !== undefined ) {
		settings.scrollBarVis = scrollBarVis;
		_fnAdjustColumnSizing( settings );
		return; // adjust column sizing will call this function again
	}
	else {
		settings.scrollBarVis = scrollBarVis;
	}

	// 1. Re-create the table inside the scrolling div
	// Remove the old minimised thead and tfoot elements in the inner table
	table.children('thead, tfoot').remove();

	// Clone the current header and footer elements and then place it into the inner table
	headerCopy = header.clone().prependTo( table );
	headerCopy.find('th, td').removeAttr('tabindex');
	headerCopy.find('[id]').removeAttr('id');

	if ( footer ) {
		footerCopy = footer.clone().prependTo( table );
		footerCopy.find('[id]').removeAttr('id');
	}

	// 2. Correct colgroup > col values if needed
	// It is possible that the cell sizes are smaller than the content, so we need to
	// correct colgroup>col for such cases. This can happen if the auto width detection
	// uses a cell which has a longer string, but isn't the widest! For example 
	// "Chief Executive Officer (CEO)" is the longest string in the demo, but
	// "Systems Administrator" is actually the widest string since it doesn't collapse.
	// Note the use of translating into a column index to get the `col` element. This
	// is because of Responsive which might remove `col` elements, knocking the alignment
	// of the indexes out.
	if (settings.aiDisplay.length) {
		// Get the column sizes from the first row in the table. This should really be a
		// [].find, but it wasn't supported in Chrome until Sept 2015, and DT has 10 year
		// browser support
		var firstTr = null;

		for (i=0 ; i<settings.aiDisplay.length ; i++) {
			var idx = settings.aiDisplay[i];
			var tr = settings.aoData[idx].nTr;

			if (tr) {
				firstTr = tr;
				break;
			}
		}

		if (firstTr) {
			var colSizes = $(firstTr).children('th, td').map(function (vis) {
				return {
					idx: _fnVisibleToColumnIndex(settings, vis),
					width: $(this).outerWidth()
				}
			});

			// Check against what the colgroup > col is set to and correct if needed
			for (var i=0 ; i<colSizes.length ; i++) {
				var colEl = settings.aoColumns[ colSizes[i].idx ].colEl[0];
				var colWidth = colEl.style.width.replace('px', '');

				if (colWidth !== colSizes[i].width) {
					colEl.style.width = colSizes[i].width + 'px';
				}
			}
		}
	}

	// 3. Copy the colgroup over to the header and footer
	divHeaderTable
		.find('colgroup')
		.remove();

	divHeaderTable.append(settings.colgroup.clone());

	if ( footer ) {
		divFooterTable
			.find('colgroup')
			.remove();

		divFooterTable.append(settings.colgroup.clone());
	}

	// "Hide" the header and footer that we used for the sizing. We need to keep
	// the content of the cell so that the width applied to the header and body
	// both match, but we want to hide it completely.
	$('th, td', headerCopy).each(function () {
		$(this.childNodes).wrapAll('<div class="dt-scroll-sizing">');
	});

	if ( footer ) {
		$('th, td', footerCopy).each(function () {
			$(this.childNodes).wrapAll('<div class="dt-scroll-sizing">');
		});
	}

	// 4. Clean up
	// Figure out if there are scrollbar present - if so then we need a the header and footer to
	// provide a bit more space to allow "overflow" scrolling (i.e. past the scrollbar)
	var isScrolling = Math.floor(table.height()) > divBodyEl.clientHeight || divBody.css('overflow-y') == "scroll";
	var paddingSide = 'padding' + (browser.bScrollbarLeft ? 'Left' : 'Right' );

	// Set the width's of the header and footer tables
	var outerWidth = table.outerWidth();

	divHeaderTable.css('width', _fnStringToCss( outerWidth ));
	divHeaderInner
		.css('width', _fnStringToCss( outerWidth ))
		.css(paddingSide, isScrolling ? barWidth+"px" : "0px");

	if ( footer ) {
		divFooterTable.css('width', _fnStringToCss( outerWidth ));
		divFooterInner
			.css('width', _fnStringToCss( outerWidth ))
			.css(paddingSide, isScrolling ? barWidth+"px" : "0px");
	}

	// Correct DOM ordering for colgroup - comes before the thead
	table.children('colgroup').prependTo(table);

	// Adjust the position of the header in case we loose the y-scrollbar
	divBody.trigger('scroll');

	// If sorting or filtering has occurred, jump the scrolling back to the top
	// only if we aren't holding the position
	if ( (settings.bSorted || settings.bFiltered) && ! settings._drawHold ) {
		divBodyEl.scrollTop = 0;
	}
}

// #endregion

// #region core.sizing.js


/**
 * Calculate the width of columns for the table
 *  @param {object} settings dataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnCalculateColumnWidths ( settings )
{
	// Not interested in doing column width calculation if auto-width is disabled
	if (! settings.oFeatures.bAutoWidth) {
		return;
	}

	var
		table = settings.nTable,
		columns = settings.aoColumns,
		scroll = settings.oScroll,
		scrollY = scroll.sY,
		scrollX = scroll.sX,
		scrollXInner = scroll.sXInner,
		visibleColumns = _fnGetColumns( settings, 'bVisible' ),
		tableWidthAttr = table.getAttribute('width'), // from DOM element
		tableContainer = table.parentNode,
		i, column, columnIdx;
		
	var styleWidth = table.style.width;

	// If there is no width applied as a CSS style or as an attribute, we assume that
	// the width is intended to be 100%, which is usually is in CSS, but it is very
	// difficult to correctly parse the rules to get the final result.
	if ( ! styleWidth && ! tableWidthAttr) {
		table.style.width = '100%';
		styleWidth = '100%';
	}

	if ( styleWidth && styleWidth.indexOf('%') !== -1 ) {
		tableWidthAttr = styleWidth;
	}

	// Let plug-ins know that we are doing a recalc, in case they have changed any of the
	// visible columns their own way (e.g. Responsive uses display:none).
	_fnCallbackFire(
		settings,
		null,
		'column-calc',
		{visible: visibleColumns},
		false
	);

	// Construct a single row, worst case, table with the widest
	// node in the data, assign any user defined widths, then insert it into
	// the DOM and allow the browser to do all the hard work of calculating
	// table widths
	var tmpTable = $(table.cloneNode())
		.css( 'visibility', 'hidden' )
		.removeAttr( 'id' );

	// Clean up the table body
	tmpTable.append('<tbody>')
	var tr = $('<tr/>').appendTo( tmpTable.find('tbody') );

	// Clone the table header and footer - we can't use the header / footer
	// from the cloned table, since if scrolling is active, the table's
	// real header and footer are contained in different table tags
	tmpTable
		.append( $(settings.nTHead).clone() )
		.append( $(settings.nTFoot).clone() );

	// Remove any assigned widths from the footer (from scrolling)
	tmpTable.find('tfoot th, tfoot td').css('width', '');

	// Apply custom sizing to the cloned header
	tmpTable.find('thead th, thead td').each( function () {
		// Get the `width` from the header layout
		var width = _fnColumnsSumWidth( settings, this, true, false );

		if ( width ) {
			// Need to set the width and min-width, otherwise the browser
			// will attempt to collapse the table beyond want might have
			// been specified
			this.style.width = width;
			this.style.minWidth = width;

			// For scrollX we need to force the column width otherwise the
			// browser will collapse it. If this width is smaller than the
			// width the column requires, then it will have no effect
			if ( scrollX ) {
				$( this ).append( $('<div/>').css( {
					width: width,
					margin: 0,
					padding: 0,
					border: 0,
					height: 1
				} ) );
			}
		}
		else {
			this.style.width = '';
		}
	} );

	// Find the widest piece of data for each column and put it into the table
	for ( i=0 ; i<visibleColumns.length ; i++ ) {
		columnIdx = visibleColumns[i];
		column = columns[ columnIdx ];

		var longest = _fnGetMaxLenString(settings, columnIdx);
		var autoClass = _ext.type.className[column.sType];
		var text = longest + column.sContentPadding;
		var insert = longest.indexOf('<') === -1
			? document.createTextNode(text)
			: text
		
		$('<td/>')
			.addClass(autoClass)
			.addClass(column.sClass)
			.append(insert)
			.appendTo(tr);
	}

	// Tidy the temporary table - remove name attributes so there aren't
	// duplicated in the dom (radio elements for example)
	$('[name]', tmpTable).removeAttr('name');

	// Table has been built, attach to the document so we can work with it.
	// A holding element is used, positioned at the top of the container
	// with minimal height, so it has no effect on if the container scrolls
	// or not. Otherwise it might trigger scrolling when it actually isn't
	// needed
	var holder = $('<div/>').css( scrollX || scrollY ?
			{
				position: 'absolute',
				top: 0,
				left: 0,
				height: 1,
				right: 0,
				overflow: 'hidden'
			} :
			{}
		)
		.append( tmpTable )
		.appendTo( tableContainer );

	// When scrolling (X or Y) we want to set the width of the table as 
	// appropriate. However, when not scrolling leave the table width as it
	// is. This results in slightly different, but I think correct behaviour
	if ( scrollX && scrollXInner ) {
		tmpTable.width( scrollXInner );
	}
	else if ( scrollX ) {
		tmpTable.css( 'width', 'auto' );
		tmpTable.removeAttr('width');

		// If there is no width attribute or style, then allow the table to
		// collapse
		if ( tmpTable.width() < tableContainer.clientWidth && tableWidthAttr ) {
			tmpTable.width( tableContainer.clientWidth );
		}
	}
	else if ( scrollY ) {
		tmpTable.width( tableContainer.clientWidth );
	}
	else if ( tableWidthAttr ) {
		tmpTable.width( tableWidthAttr );
	}

	// Get the width of each column in the constructed table
	var total = 0;
	var bodyCells = tmpTable.find('tbody tr').eq(0).children();

	for ( i=0 ; i<visibleColumns.length ; i++ ) {
		// Use getBounding for sub-pixel accuracy, which we then want to round up!
		var bounding = bodyCells[i].getBoundingClientRect().width;

		// Total is tracked to remove any sub-pixel errors as the outerWidth
		// of the table might not equal the total given here
		total += bounding;

		// Width for each column to use
		columns[ visibleColumns[i] ].sWidth = _fnStringToCss( bounding );
	}

	table.style.width = _fnStringToCss( total );

	// Finished with the table - ditch it
	holder.remove();

	// If there is a width attr, we want to attach an event listener which
	// allows the table sizing to automatically adjust when the window is
	// resized. Use the width attr rather than CSS, since we can't know if the
	// CSS is a relative value or absolute - DOM read is always px.
	if ( tableWidthAttr ) {
		table.style.width = _fnStringToCss( tableWidthAttr );
	}

	if ( (tableWidthAttr || scrollX) && ! settings._reszEvt ) {
		var bindResize = function () {
			$(window).on('resize.DT-'+settings.sInstance, DataTable.util.throttle( function () {
				if (! settings.bDestroying) {
					_fnAdjustColumnSizing( settings );
				}
			} ) );
		};

		bindResize();

		settings._reszEvt = true;
	}
}


/**
 * Get the maximum strlen for each data column
 *  @param {object} settings dataTables settings object
 *  @param {int} colIdx column of interest
 *  @returns {string} string of the max length
 *  @memberof DataTable#oApi
 */
function _fnGetMaxLenString( settings, colIdx )
{
	var column = settings.aoColumns[colIdx];

	if (! column.maxLenString) {
		var s, max='', maxLen = -1;
	
		for ( var i=0, ien=settings.aiDisplayMaster.length ; i<ien ; i++ ) {
			var rowIdx = settings.aiDisplayMaster[i];
			var data = _fnGetRowDisplay(settings, rowIdx)[colIdx];

			var cellString = data && typeof data === 'object' && data.nodeType
				? data.innerHTML
				: data+'';

			// Remove id / name attributes from elements so they
			// don't interfere with existing elements
			cellString = cellString
				.replace(/id=".*?"/g, '')
				.replace(/name=".*?"/g, '');

			s = _stripHtml(cellString)
				.replace( /&nbsp;/g, ' ' );
	
			if ( s.length > maxLen ) {
				// We want the HTML in the string, but the length that
				// is important is the stripped string
				max = cellString;
				maxLen = s.length;
			}
		}

		column.maxLenString = max;
	}

	return column.maxLenString;
}


/**
 * Append a CSS unit (only if required) to a string
 *  @param {string} value to css-ify
 *  @returns {string} value with css unit
 *  @memberof DataTable#oApi
 */
function _fnStringToCss( s )
{
	if ( s === null ) {
		return '0px';
	}

	if ( typeof s == 'number' ) {
		return s < 0 ?
			'0px' :
			s+'px';
	}

	// Check it has a unit character already
	return s.match(/\d$/) ?
		s+'px' :
		s;
}

/**
 * Re-insert the `col` elements for current visibility
 *
 * @param {*} settings DT settings
 */
function _colGroup( settings ) {
	var cols = settings.aoColumns;

	settings.colgroup.empty();

	for (i=0 ; i<cols.length ; i++) {
		if (cols[i].bVisible) {
			settings.colgroup.append(cols[i].colEl);
		}
	}
}


// #endregion

// #region core.sort.js

function _fnSortInit(settings) {
	var target = settings.nTHead;
	var headerRows = target.querySelectorAll('tr');
	var legacyTop = settings.bSortCellsTop;
	var notSelector = ':not([data-dt-order="disable"]):not([data-dt-order="icon-only"])';

	// Legacy support for `orderCellsTop`
	if (legacyTop === true) {
		target = headerRows[0];
	}
	else if (legacyTop === false) {
		target = headerRows[headerRows.length - 1];
	}

	_fnSortAttachListener(
		settings,
		target,
		target === settings.nTHead
			? 'tr' + notSelector + ' th' + notSelector + ', tr' + notSelector + ' td' + notSelector
			: 'th' + notSelector + ', td' + notSelector
	);

	// Need to resolve the user input array into our internal structure
	var order = [];
	_fnSortResolve(settings, order, settings.aaSorting);

	settings.aaSorting = order;
}


function _fnSortAttachListener(settings, node, selector, column, callback) {
	_fnBindAction(node, selector, function (e) {
		var run = false;
		var columns = column === undefined
			? _fnColumnsFromHeader(e.target)
			: [column];

		if (columns.length) {
			for (var i = 0, ien = columns.length; i < ien; i++) {
				var ret = _fnSortAdd(settings, columns[i], i, e.shiftKey);

				if (ret !== false) {
					run = true;
				}

				// If the first entry is no sort, then subsequent
				// sort columns are ignored
				if (settings.aaSorting.length === 1 && settings.aaSorting[0][1] === '') {
					break;
				}
			}

			if (run) {
				_fnProcessingRun(settings, true, function () {
					_fnSort(settings);
					_fnSortDisplay(settings, settings.aiDisplay);

					_fnReDraw(settings, false, false);

					if (callback) {
						callback();
					}
				});
			}
		}
	});
}

/**
 * Sort the display array to match the master's order
 * @param {*} settings
 */
function _fnSortDisplay(settings, display) {
	if (display.length < 2) {
		return;
	}

	var master = settings.aiDisplayMaster;
	var masterMap = {};
	var map = {};
	var i;

	// Rather than needing an `indexOf` on master array, we can create a map
	for (i = 0; i < master.length; i++) {
		masterMap[master[i]] = i;
	}

	// And then cache what would be the indexOf fom the display
	for (i = 0; i < display.length; i++) {
		map[display[i]] = masterMap[display[i]];
	}

	display.sort(function (a, b) {
		// Short version of this function is simply `master.indexOf(a) - master.indexOf(b);`
		return map[a] - map[b];
	});
}


function _fnSortResolve(settings, nestedSort, sort) {
	var push = function (a) {
		if ($.isPlainObject(a)) {
			if (a.idx !== undefined) {
				// Index based ordering
				nestedSort.push([a.idx, a.dir]);
			}
			else if (a.name) {
				// Name based ordering
				var cols = _pluck(settings.aoColumns, 'sName');
				var idx = cols.indexOf(a.name);

				if (idx !== -1) {
					nestedSort.push([idx, a.dir]);
				}
			}
		}
		else {
			// Plain column index and direction pair
			nestedSort.push(a);
		}
	};

	if ($.isPlainObject(sort)) {
		// Object
		push(sort);
	}
	else if (sort.length && typeof sort[0] === 'number') {
		// 1D array
		push(sort);
	}
	else if (sort.length) {
		// 2D array
		for (var z = 0; z < sort.length; z++) {
			push(sort[z]); // Object or array
		}
	}
}


function _fnSortFlatten(settings) {
	var
		i, k, kLen,
		aSort = [],
		extSort = DataTable.ext.type.order,
		aoColumns = settings.aoColumns,
		aDataSort, iCol, sType, srcCol,
		fixed = settings.aaSortingFixed,
		fixedObj = $.isPlainObject(fixed),
		nestedSort = [];

	if (!settings.oFeatures.bSort) {
		return aSort;
	}

	// Build the sort array, with pre-fix and post-fix options if they have been
	// specified
	if (Array.isArray(fixed)) {
		_fnSortResolve(settings, nestedSort, fixed);
	}

	if (fixedObj && fixed.pre) {
		_fnSortResolve(settings, nestedSort, fixed.pre);
	}

	_fnSortResolve(settings, nestedSort, settings.aaSorting);

	if (fixedObj && fixed.post) {
		_fnSortResolve(settings, nestedSort, fixed.post);
	}

	for (i = 0; i < nestedSort.length; i++) {
		srcCol = nestedSort[i][0];

		if (aoColumns[srcCol]) {
			aDataSort = aoColumns[srcCol].aDataSort;

			for (k = 0, kLen = aDataSort.length; k < kLen; k++) {
				iCol = aDataSort[k];
				sType = aoColumns[iCol].sType || 'string';

				if (nestedSort[i]._idx === undefined) {
					nestedSort[i]._idx = aoColumns[iCol].asSorting.indexOf(nestedSort[i][1]);
				}

				if (nestedSort[i][1]) {
					aSort.push({
						src: srcCol,
						col: iCol,
						dir: nestedSort[i][1],
						index: nestedSort[i]._idx,
						type: sType,
						formatter: extSort[sType + "-pre"],
						sorter: extSort[sType + "-" + nestedSort[i][1]]
					});
				}
			}
		}
	}

	return aSort;
}

/**
 * Change the order of the table
 *  @param {object} oSettings dataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnSort(oSettings, col, dir) {
	var
		i, ien, iLen,
		aiOrig = [],
		extSort = DataTable.ext.type.order,
		aoData = oSettings.aoData,
		sortCol,
		displayMaster = oSettings.aiDisplayMaster,
		aSort;

	// Allow a specific column to be sorted, which will _not_ alter the display
	// master
	if (col !== undefined) {
		var srcCol = oSettings.aoColumns[col];
		aSort = [{
			src: col,
			col: col,
			dir: dir,
			index: 0,
			type: srcCol.sType,
			formatter: extSort[srcCol.sType + "-pre"],
			sorter: extSort[srcCol.sType + "-" + dir]
		}];
		displayMaster = displayMaster.slice();
	}
	else {
		aSort = _fnSortFlatten(oSettings);
	}

	for (i = 0, ien = aSort.length; i < ien; i++) {
		sortCol = aSort[i];

		// Load the data needed for the sort, for each cell
		_fnSortData(oSettings, sortCol.col);
	}

	/* No sorting required if server-side or no sorting array */
	if (_fnDataSource(oSettings) != 'ssp' && aSort.length !== 0) {
		// Reset the initial positions on each pass so we get a stable sort
		for (i = 0, iLen = displayMaster.length; i < iLen; i++) {
			aiOrig[i] = i;
		}

		// If the first sort is desc, then reverse the array to preserve original
		// order, just in reverse
		if (aSort.length && aSort[0].dir === 'desc' && oSettings.orderDescReverse) {
			aiOrig.reverse();
		}

		/* Do the sort - here we want multi-column sorting based on a given data source (column)
		 * and sorting function (from oSort) in a certain direction. It's reasonably complex to
		 * follow on it's own, but this is what we want (example two column sorting):
		 *  fnLocalSorting = function(a,b){
		 *    var test;
		 *    test = oSort['string-asc']('data11', 'data12');
		 *      if (test !== 0)
		 *        return test;
		 *    test = oSort['numeric-desc']('data21', 'data22');
		 *    if (test !== 0)
		 *      return test;
		 *    return oSort['numeric-asc']( aiOrig[a], aiOrig[b] );
		 *  }
		 * Basically we have a test for each sorting column, if the data in that column is equal,
		 * test the next column. If all columns match, then we use a numeric sort on the row
		 * positions in the original data array to provide a stable sort.
		 */
		displayMaster.sort(function (a, b) {
			var
				x, y, k, test, sort,
				len = aSort.length,
				dataA = aoData[a]._aSortData,
				dataB = aoData[b]._aSortData;

			for (k = 0; k < len; k++) {
				sort = aSort[k];

				// Data, which may have already been through a `-pre` function
				x = dataA[sort.col];
				y = dataB[sort.col];

				if (sort.sorter) {
					// If there is a custom sorter (`-asc` or `-desc`) for this
					// data type, use it
					test = sort.sorter(x, y);

					if (test !== 0) {
						return test;
					}
				}
				else {
					// Otherwise, use generic sorting
					test = x < y ? -1 : x > y ? 1 : 0;

					if (test !== 0) {
						return sort.dir === 'asc' ? test : -test;
					}
				}
			}

			x = aiOrig[a];
			y = aiOrig[b];

			return x < y ? -1 : x > y ? 1 : 0;
		});
	}
	else if (aSort.length === 0) {
		// Apply index order
		displayMaster.sort(function (x, y) {
			return x < y ? -1 : x > y ? 1 : 0;
		});
	}

	if (col === undefined) {
		// Tell the draw function that we have sorted the data
		oSettings.bSorted = true;
		oSettings.sortDetails = aSort;

		_fnCallbackFire(oSettings, null, 'order', [oSettings, aSort]);
	}

	return displayMaster;
}


/**
 * Function to run on user sort request
 *  @param {object} settings dataTables settings object
 *  @param {node} attachTo node to attach the handler to
 *  @param {int} colIdx column sorting index
 *  @param {int} addIndex Counter
 *  @param {boolean} [shift=false] Shift click add
 *  @param {function} [callback] callback function
 *  @memberof DataTable#oApi
 */
function _fnSortAdd(settings, colIdx, addIndex, shift) {
	var col = settings.aoColumns[colIdx];
	var sorting = settings.aaSorting;
	var asSorting = col.asSorting;
	var nextSortIdx;
	var next = function (a, overflow) {
		var idx = a._idx;
		if (idx === undefined) {
			idx = asSorting.indexOf(a[1]);
		}

		return idx + 1 < asSorting.length ?
			idx + 1 :
			overflow ?
				null :
				0;
	};

	if (!col.bSortable) {
		return false;
	}

	// Convert to 2D array if needed
	if (typeof sorting[0] === 'number') {
		sorting = settings.aaSorting = [sorting];
	}

	// If appending the sort then we are multi-column sorting
	if ((shift || addIndex) && settings.oFeatures.bSortMulti) {
		// Are we already doing some kind of sort on this column?
		var sortIdx = _pluck(sorting, '0').indexOf(colIdx);

		if (sortIdx !== -1) {
			// Yes, modify the sort
			nextSortIdx = next(sorting[sortIdx], true);

			if (nextSortIdx === null && sorting.length === 1) {
				nextSortIdx = 0; // can't remove sorting completely
			}

			if (nextSortIdx === null) {
				sorting.splice(sortIdx, 1);
			}
			else {
				sorting[sortIdx][1] = asSorting[nextSortIdx];
				sorting[sortIdx]._idx = nextSortIdx;
			}
		}
		else if (shift) {
			// No sort on this column yet, being added by shift click
			// add it as itself
			sorting.push([colIdx, asSorting[0], 0]);
			sorting[sorting.length - 1]._idx = 0;
		}
		else {
			// No sort on this column yet, being added from a colspan
			// so add with same direction as first column
			sorting.push([colIdx, sorting[0][1], 0]);
			sorting[sorting.length - 1]._idx = 0;
		}
	}
	else if (sorting.length && sorting[0][0] == colIdx) {
		// Single column - already sorting on this column, modify the sort
		nextSortIdx = next(sorting[0]);

		sorting.length = 1;
		sorting[0][1] = asSorting[nextSortIdx];
		sorting[0]._idx = nextSortIdx;
	}
	else {
		// Single column - sort only on this column
		sorting.length = 0;
		sorting.push([colIdx, asSorting[0]]);
		sorting[0]._idx = 0;
	}
}


/**
 * Set the sorting classes on table's body, Note: it is safe to call this function
 * when bSort and bSortClasses are false
 *  @param {object} oSettings dataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnSortingClasses(settings) {
	var oldSort = settings.aLastSort;
	var sortClass = settings.oClasses.order.position;
	var sort = _fnSortFlatten(settings);
	var features = settings.oFeatures;
	var i, ien, colIdx;

	if (features.bSort && features.bSortClasses) {
		// Remove old sorting classes
		for (i = 0, ien = oldSort.length; i < ien; i++) {
			colIdx = oldSort[i].src;

			// Remove column sorting
			$(_pluck(settings.aoData, 'anCells', colIdx))
				.removeClass(sortClass + (i < 2 ? i + 1 : 3));
		}

		// Add new column sorting
		for (i = 0, ien = sort.length; i < ien; i++) {
			colIdx = sort[i].src;

			$(_pluck(settings.aoData, 'anCells', colIdx))
				.addClass(sortClass + (i < 2 ? i + 1 : 3));
		}
	}

	settings.aLastSort = sort;
}


// Get the data to sort a column, be it from cache, fresh (populating the
// cache), or from a sort formatter
function _fnSortData(settings, colIdx) {
	// Custom sorting function - provided by the sort data type
	var column = settings.aoColumns[colIdx];
	var customSort = DataTable.ext.order[column.sSortDataType];
	var customData;

	if (customSort) {
		customData = customSort.call(settings.oInstance, settings, colIdx,
			_fnColumnIndexToVisible(settings, colIdx)
		);
	}

	// Use / populate cache
	var row, cellData;
	var formatter = DataTable.ext.type.order[column.sType + "-pre"];
	var data = settings.aoData;

	for (var rowIdx = 0; rowIdx < data.length; rowIdx++) {
		// Sparse array
		if (!data[rowIdx]) {
			continue;
		}

		row = data[rowIdx];

		if (!row._aSortData) {
			row._aSortData = [];
		}

		if (!row._aSortData[colIdx] || customSort) {
			cellData = customSort ?
				customData[rowIdx] : // If there was a custom sort function, use data from there
				_fnGetCellData(settings, rowIdx, colIdx, 'sort');

			row._aSortData[colIdx] = formatter ?
				formatter(cellData, settings) :
				cellData;
		}
	}
}

// #endregion

// _buildInclude('core.state.js');

// #region core.support.js

/**
 * Log an error message
 *  @param {object} settings dataTables settings object
 *  @param {int} level log error messages, or display them to the user
 *  @param {string} msg error message
 *  @param {int} tn Technical note id to get more information about the error.
 *  @memberof DataTable#oApi
 */
function _fnLog(settings, level, msg, tn) {
	msg = 'DataTables warning: ' +
		(settings ? 'table id=' + settings.sTableId + ' - ' : '') + msg;

	if (tn) {
		msg += '. For more information about this error, please see ' +
			'https://datatables.net/tn/' + tn;
	}

	if (!level) {
		// Backwards compatibility pre 1.10
		var ext = DataTable.ext;
		var type = ext.sErrMode || ext.errMode;

		if (settings) {
			_fnCallbackFire(settings, null, 'dt-error', [settings, tn, msg], true);
		}

		if (type == 'alert') {
			alert(msg);
		}
		else if (type == 'throw') {
			throw new Error(msg);
		}
		else if (typeof type == 'function') {
			type(settings, tn, msg);
		}
	}
	else if (window.console && console.log) {
		console.log(msg);
	}
}

/**
 * See if a property is defined on one object, if so assign it to the other object
 *  @param {object} ret target object
 *  @param {object} src source object
 *  @param {string} name property
 *  @param {string} [mappedName] name to map too - optional, name used if not given
 *  @memberof DataTable#oApi
 */
function _fnMap(ret, src, name, mappedName) {
	if (Array.isArray(name)) {
		$.each(name, function (i, val) {
			if (Array.isArray(val)) {
				_fnMap(ret, src, val[0], val[1]);
			}
			else {
				_fnMap(ret, src, val);
			}
		});

		return;
	}

	if (mappedName === undefined) {
		mappedName = name;
	}

	if (src[name] !== undefined) {
		ret[mappedName] = src[name];
	}
}


/**
 * Extend objects - very similar to jQuery.extend, but deep copy objects, and
 * shallow copy arrays. The reason we need to do this, is that we don't want to
 * deep copy array init values (such as aaSorting) since the dev wouldn't be
 * able to override them, but we do want to deep copy arrays.
 *  @param {object} out Object to extend
 *  @param {object} extender Object from which the properties will be applied to
 *      out
 *  @param {boolean} breakRefs If true, then arrays will be sliced to take an
 *      independent copy with the exception of the `data` or `aaData` parameters
 *      if they are present. This is so you can pass in a collection to
 *      DataTables and have that used as your data source without breaking the
 *      references
 *  @returns {object} out Reference, just for convenience - out === the return.
 *  @memberof DataTable#oApi
 *  @todo This doesn't take account of arrays inside the deep copied objects.
 */
function _fnExtend(out, extender, breakRefs) {
	var val;

	for (var prop in extender) {
		if (Object.prototype.hasOwnProperty.call(extender, prop)) {
			val = extender[prop];

			if ($.isPlainObject(val)) {
				if (!$.isPlainObject(out[prop])) {
					out[prop] = {};
				}
				$.extend(true, out[prop], val);
			}
			else if (breakRefs && prop !== 'data' && prop !== 'aaData' && Array.isArray(val)) {
				out[prop] = val.slice();
			}
			else {
				out[prop] = val;
			}
		}
	}

	return out;
}


/**
 * Bind an event handers to allow a click or return key to activate the callback.
 * This is good for accessibility since a return on the keyboard will have the
 * same effect as a click, if the element has focus.
 *  @param {element} n Element to bind the action to
 *  @param {object|string} selector Selector (for delegated events) or data object
 *   to pass to the triggered function
 *  @param {function} fn Callback function for when the event is triggered
 *  @memberof DataTable#oApi
 */
function _fnBindAction(n, selector, fn) {
	$(n)
		.on('click.DT', selector, function (e) {
			fn(e);
		})
		.on('keypress.DT', selector, function (e) {
			if (e.which === 13) {
				e.preventDefault();
				fn(e);
			}
		})
		.on('selectstart.DT', selector, function () {
			// Don't want a double click resulting in text selection
			return false;
		});
}


/**
 * Register a callback function. Easily allows a callback function to be added to
 * an array store of callback functions that can then all be called together.
 *  @param {object} settings dataTables settings object
 *  @param {string} store Name of the array storage for the callbacks in oSettings
 *  @param {function} fn Function to be called back
 *  @memberof DataTable#oApi
 */
function _fnCallbackReg(settings, store, fn) {
	if (fn) {
		settings[store].push(fn);
	}
}


/**
 * Fire callback functions and trigger events. Note that the loop over the
 * callback array store is done backwards! Further note that you do not want to
 * fire off triggers in time sensitive applications (for example cell creation)
 * as its slow.
 *  @param {object} settings dataTables settings object
 *  @param {string} callbackArr Name of the array storage for the callbacks in
 *      oSettings
 *  @param {string} eventName Name of the jQuery custom event to trigger. If
 *      null no trigger is fired
 *  @param {array} args Array of arguments to pass to the callback function /
 *      trigger
 *  @param {boolean} [bubbles] True if the event should bubble
 *  @memberof DataTable#oApi
 */
function _fnCallbackFire(settings, callbackArr, eventName, args, bubbles) {
	var ret = [];

	if (callbackArr) {
		ret = settings[callbackArr].slice().reverse().map(function (val) {
			return val.apply(settings.instance, args);
		});
	}

	if (eventName !== null) {
		var e = $.Event(eventName + '.dt');
		var table = $(settings.table);

		// Expose the DataTables API on the event object for easy access
		e.dt = settings.api;

		table[bubbles ? 'trigger' : 'triggerHandler'](e, args);

		// If not yet attached to the document, trigger the event
		// on the body directly to sort of simulate the bubble
		if (bubbles && table.parents('body').length === 0) {
			$('body').trigger(e, args);
		}

		ret.push(e.result);
	}

	return ret;
}


function _fnLengthOverflow(settings) {
	var
		start = settings._iDisplayStart,
		end = settings.fnDisplayEnd(),
		len = settings._iDisplayLength;

	/* If we have space to show extra rows (backing up from the end point - then do so */
	if (start >= end) {
		start = end - len;
	}

	// Keep the start record on the current page
	start -= (start % len);

	if (len === -1 || start < 0) {
		start = 0;
	}

	settings._iDisplayStart = start;
}


function _fnRenderer(settings, type) {
	var renderer = settings.renderer;
	var host = DataTable.ext.renderer[type];

	if ($.isPlainObject(renderer) && renderer[type]) {
		// Specific renderer for this type. If available use it, otherwise use
		// the default.
		return host[renderer[type]] || host._;
	}
	else if (typeof renderer === 'string') {
		// Common renderer - if there is one available for this type use it,
		// otherwise use the default
		return host[renderer] || host._;
	}

	// Use the default
	return host._;
}


/**
 * Detect the data source being used for the table. Used to simplify the code
 * a little (ajax) and to make it compress a little smaller.
 *
 *  @param {object} settings dataTables settings object
 *  @returns {string} Data source
 *  @memberof DataTable#oApi
 */
function _fnDataSource(settings) {
	return 'dom';
}

/**
 * Common replacement for language strings
 *
 * @param {*} settings DT settings object
 * @param {*} str String with values to replace
 * @param {*} entries Plural number for _ENTRIES_ - can be undefined
 * @returns String
 */
function _fnMacros(settings, str, entries) {
	// When infinite scrolling, we are always starting at 1. _iDisplayStart is
	// used only internally
	var
		formatter = settings.fnFormatNumber,
		start = settings._iDisplayStart + 1,
		len = settings._iDisplayLength,
		vis = settings.fnRecordsDisplay(),
		max = settings.fnRecordsTotal(),
		all = len === -1;

	return str.
		replace(/_START_/g, formatter.call(settings, start)).
		replace(/_END_/g, formatter.call(settings, settings.fnDisplayEnd())).
		replace(/_MAX_/g, formatter.call(settings, max)).
		replace(/_TOTAL_/g, formatter.call(settings, vis)).
		replace(/_PAGE_/g, formatter.call(settings, all ? 1 : Math.ceil(start / len))).
		replace(/_PAGES_/g, formatter.call(settings, all ? 1 : Math.ceil(vis / len))).
		replace(/_ENTRIES_/g, settings.api.i18n('entries', '', entries)).
		replace(/_ENTRIES-MAX_/g, settings.api.i18n('entries', '', max)).
		replace(/_ENTRIES-TOTAL_/g, settings.api.i18n('entries', '', vis));
}

// #endregion

// #region api.base.js

/**
 * Computed structure of the DataTables API, defined by the options passed to
 * `DataTable.Api.register()` when building the API.
 *
 * The structure is built in order to speed creation and extension of the Api
 * objects since the extensions are effectively pre-parsed.
 *
 * The array is an array of objects with the following structure, where this
 * base array represents the Api prototype base:
 *
 *     [
 *       {
 *         name:      'data'                -- string   - Property name
 *         val:       function () {},       -- function - Api method (or undefined if just an object
 *         methodExt: [ ... ],              -- array    - Array of Api object definitions to extend the method result
 *         propExt:   [ ... ]               -- array    - Array of Api object definitions to extend the property
 *       },
 *       {
 *         name:     'row'
 *         val:       {},
 *         methodExt: [ ... ],
 *         propExt:   [
 *           {
 *             name:      'data'
 *             val:       function () {},
 *             methodExt: [ ... ],
 *             propExt:   [ ... ]
 *           },
 *           ...
 *         ]
 *       }
 *     ]
 *
 * @type {Array}
 * @ignore
 */
var __apiStruct = [];


/**
 * `Array.prototype` reference.
 *
 * @type object
 * @ignore
 */
var __arrayProto = Array.prototype;


/**
 * Abstraction for `context` parameter of the `Api` constructor to allow it to
 * take several different forms for ease of use.
 *
 * Each of the input parameter types will be converted to a DataTables settings
 * object where possible.
 *
 * @param  {string|node|jQuery|object} mixed DataTable identifier. Can be one
 *   of:
 *
 *   * `string` - jQuery selector. Any DataTables' matching the given selector
 *     with be found and used.
 *   * `node` - `TABLE` node which has already been formed into a DataTable.
 *   * `jQuery` - A jQuery object of `TABLE` nodes.
 *   * `object` - DataTables settings object
 *   * `DataTables.Api` - API instance
 * @return {array|null} Matching DataTables settings objects. `null` or
 *   `undefined` is returned if no matching DataTable is found.
 * @ignore
 */
var _toSettings = function (mixed) {
	var idx, jq;
	var settings = DataTable.settings;
	var tables = _pluck(settings, 'nTable');

	if (!mixed) {
		return [];
	}
	else if (mixed.nTable && mixed.oFeatures) {
		// DataTables settings object
		return [mixed];
	}
	else if (mixed.nodeName && mixed.nodeName.toLowerCase() === 'table') {
		// Table node
		idx = tables.indexOf(mixed);
		return idx !== -1 ? [settings[idx]] : null;
	}
	else if (mixed && typeof mixed.settings === 'function') {
		return mixed.settings().toArray();
	}
	else if (typeof mixed === 'string') {
		// jQuery selector
		jq = $(mixed).get();
	}
	else if (mixed instanceof $) {
		// jQuery object (also DataTables instance)
		jq = mixed.get();
	}

	if (jq) {
		return settings.filter(function (v, idx) {
			return jq.includes(tables[idx]);
		});
	}
};

/**
 * DataTables API class - used to control and interface with  one or more
 * DataTables enhanced tables.
 *
 * The API class is heavily based on jQuery, presenting a chainable interface
 * that you can use to interact with tables. Each instance of the API class has
 * a "context" - i.e. the tables that it will operate on. This could be a single
 * table, all tables on a page or a sub-set thereof.
 *
 * Additionally the API is designed to allow you to easily work with the data in
 * the tables, retrieving and manipulating it as required. This is done by
 * presenting the API class as an array like interface. The contents of the
 * array depend upon the actions requested by each method (for example
 * `rows().nodes()` will return an array of nodes, while `rows().data()` will
 * return an array of objects or arrays depending upon your table's
 * configuration). The API object has a number of array like methods (`push`,
 * `pop`, `reverse` etc) as well as additional helper methods (`each`, `pluck`,
 * `unique` etc) to assist your working with the data held in a table.
 *
 * Most methods (those which return an Api instance) are chainable, which means
 * the return from a method call also has all of the methods available that the
 * top level object had. For example, these two calls are equivalent:
 *
 *     // Not chained
 *     api.row.add( {...} );
 *     api.draw();
 *
 *     // Chained
 *     api.row.add( {...} ).draw();
 *
 * @class DataTable.Api
 * @param {array|object|string|jQuery} context DataTable identifier. This is
 *   used to define which DataTables enhanced tables this API will operate on.
 *   Can be one of:
 *
 *   * `string` - jQuery selector. Any DataTables' matching the given selector
 *     with be found and used.
 *   * `node` - `TABLE` node which has already been formed into a DataTable.
 *   * `jQuery` - A jQuery object of `TABLE` nodes.
 *   * `object` - DataTables settings object
 * @param {array} [data] Data to initialise the Api instance with.
 *
 * @example
 *   // Direct initialisation during DataTables construction
 *   var api = $('#example').DataTable();
 *
 * @example
 *   // Initialisation using a DataTables jQuery object
 *   var api = $('#example').dataTable().api();
 *
 * @example
 *   // Initialisation as a constructor
 *   var api = new DataTable.Api( 'table.dataTable' );
 */
_Api = function (context, data) {
	if (!(this instanceof _Api)) {
		return new _Api(context, data);
	}

	var i;
	var settings = [];
	var ctxSettings = function (o) {
		var a = _toSettings(o);
		if (a) {
			settings.push.apply(settings, a);
		}
	};

	if (Array.isArray(context)) {
		for (i = 0; i < context.length; i++) {
			ctxSettings(context[i]);
		}
	}
	else {
		ctxSettings(context);
	}

	// Remove duplicates
	this.context = settings.length > 1
		? _unique(settings)
		: settings;

	// Initial data
	if (data) {
		// Chrome can throw a max stack error if apply is called with
		// too large an array, but apply is faster.
		if (data.length < 10000) {
			this.push.apply(this, data);
		}
		else {
			for (i = 0; i < data.length; i++) {
				this.push(data[i]);
			}
		}
	}

	// selector
	this.selector = {
		rows: null,
		cols: null,
		opts: null
	};

	_Api.extend(this, this, __apiStruct);
};

DataTable.Api = _Api;

// Don't destroy the existing prototype, just extend it. Required for jQuery 2's
// isPlainObject.
$.extend(_Api.prototype, {
	any: function () {
		return this.count() !== 0;
	},

	context: [], // array of table settings objects

	count: function () {
		return this.flatten().length;
	},

	each: function (fn) {
		for (var i = 0, ien = this.length; i < ien; i++) {
			fn.call(this, this[i], i, this);
		}

		return this;
	},

	eq: function (idx) {
		var ctx = this.context;

		return ctx.length > idx ?
			new _Api(ctx[idx], this[idx]) :
			null;
	},

	filter: function (fn) {
		var a = __arrayProto.filter.call(this, fn, this);

		return new _Api(this.context, a);
	},

	flatten: function () {
		var a = [];

		return new _Api(this.context, a.concat.apply(a, this.toArray()));
	},

	get: function (idx) {
		return this[idx];
	},

	join: __arrayProto.join,

	includes: function (find) {
		return this.indexOf(find) === -1 ? false : true;
	},

	indexOf: __arrayProto.indexOf,

	iterator: function (flatten, type, fn, alwaysNew) {
		var
			a = [], ret,
			i, ien, j, jen,
			context = this.context,
			rows, items, item,
			selector = this.selector;

		// Argument shifting
		if (typeof flatten === 'string') {
			alwaysNew = fn;
			fn = type;
			type = flatten;
			flatten = false;
		}

		for (i = 0, ien = context.length; i < ien; i++) {
			var apiInst = new _Api(context[i]);

			if (type === 'table') {
				ret = fn.call(apiInst, context[i], i);

				if (ret !== undefined) {
					a.push(ret);
				}
			}
			else if (type === 'columns' || type === 'rows') {
				// this has same length as context - one entry for each table
				ret = fn.call(apiInst, context[i], this[i], i);

				if (ret !== undefined) {
					a.push(ret);
				}
			}
			else if (type === 'every' || type === 'column' || type === 'column-rows' || type === 'row' || type === 'cell') {
				// columns and rows share the same structure.
				// 'this' is an array of column indexes for each context
				items = this[i];

				if (type === 'column-rows') {
					rows = _selector_row_indexes(context[i], selector.opts);
				}

				for (j = 0, jen = items.length; j < jen; j++) {
					item = items[j];

					if (type === 'cell') {
						ret = fn.call(apiInst, context[i], item.row, item.column, i, j);
					}
					else {
						ret = fn.call(apiInst, context[i], item, i, j, rows);
					}

					if (ret !== undefined) {
						a.push(ret);
					}
				}
			}
		}

		if (a.length || alwaysNew) {
			var api = new _Api(context, flatten ? a.concat.apply([], a) : a);
			var apiSelector = api.selector;
			apiSelector.rows = selector.rows;
			apiSelector.cols = selector.cols;
			apiSelector.opts = selector.opts;
			return api;
		}
		return this;
	},

	lastIndexOf: __arrayProto.lastIndexOf,

	length: 0,

	map: function (fn) {
		var a = __arrayProto.map.call(this, fn, this);

		return new _Api(this.context, a);
	},

	pluck: function (prop) {
		var fn = DataTable.util.get(prop);

		return this.map(function (el) {
			return fn(el);
		});
	},

	pop: __arrayProto.pop,

	push: __arrayProto.push,

	reduce: __arrayProto.reduce,

	reduceRight: __arrayProto.reduceRight,

	reverse: __arrayProto.reverse,

	// Object with rows, columns and opts
	selector: null,

	shift: __arrayProto.shift,

	slice: function () {
		return new _Api(this.context, this);
	},

	sort: __arrayProto.sort,

	splice: __arrayProto.splice,

	toArray: function () {
		return __arrayProto.slice.call(this);
	},

	to$: function () {
		return $(this);
	},

	toJQuery: function () {
		return $(this);
	},

	unique: function () {
		return new _Api(this.context, _unique(this.toArray()));
	},

	unshift: __arrayProto.unshift
});


function _api_scope(scope, fn, struc) {
	return function () {
		var ret = fn.apply(scope || this, arguments);

		// Method extension
		_Api.extend(ret, ret, struc.methodExt);
		return ret;
	};
}

function _api_find(src, name) {
	for (var i = 0, ien = src.length; i < ien; i++) {
		if (src[i].name === name) {
			return src[i];
		}
	}
	return null;
}

window.__apiStruct = __apiStruct;

_Api.extend = function (scope, obj, ext) {
	// Only extend API instances and static properties of the API
	if (!ext.length || !obj || (!(obj instanceof _Api) && !obj.__dt_wrapper)) {
		return;
	}

	var i, ien, struct;

	for (i = 0, ien = ext.length; i < ien; i++) {
		struct = ext[i];

		if (struct.name === '__proto__') {
			continue;
		}

		// Value
		obj[struct.name] = struct.type === 'function' ?
			_api_scope(scope, struct.val, struct) :
			struct.type === 'object' ?
				{} :
				struct.val;

		obj[struct.name].__dt_wrapper = true;

		// Property extension
		_Api.extend(scope, obj[struct.name], struct.propExt);
	}
};

//     [
//       {
//         name:      'data'                -- string   - Property name
//         val:       function () {},       -- function - Api method (or undefined if just an object
//         methodExt: [ ... ],              -- array    - Array of Api object definitions to extend the method result
//         propExt:   [ ... ]               -- array    - Array of Api object definitions to extend the property
//       },
//       {
//         name:     'row'
//         val:       {},
//         methodExt: [ ... ],
//         propExt:   [
//           {
//             name:      'data'
//             val:       function () {},
//             methodExt: [ ... ],
//             propExt:   [ ... ]
//           },
//           ...
//         ]
//       }
//     ]


_Api.register = _api_register = function (name, val) {
	if (Array.isArray(name)) {
		for (var j = 0, jen = name.length; j < jen; j++) {
			_Api.register(name[j], val);
		}
		return;
	}

	var
		i, ien,
		heir = name.split('.'),
		struct = __apiStruct,
		key, method;

	for (i = 0, ien = heir.length; i < ien; i++) {
		method = heir[i].indexOf('()') !== -1;
		key = method ?
			heir[i].replace('()', '') :
			heir[i];

		var src = _api_find(struct, key);
		if (!src) {
			src = {
				name: key,
				val: {},
				methodExt: [],
				propExt: [],
				type: 'object'
			};
			struct.push(src);
		}

		if (i === ien - 1) {
			src.val = val;
			src.type = typeof val === 'function' ?
				'function' :
				$.isPlainObject(val) ?
					'object' :
					'other';
		}
		else {
			struct = method ?
				src.methodExt :
				src.propExt;
		}
	}
};

_Api.registerPlural = _api_registerPlural = function (pluralName, singularName, val) {
	_Api.register(pluralName, val);

	_Api.register(singularName, function () {
		var ret = val.apply(this, arguments);

		if (ret === this) {
			// Returned item is the API instance that was passed in, return it
			return this;
		}
		else if (ret instanceof _Api) {
			// New API instance returned, want the value from the first item
			// in the returned array for the singular result.
			return ret.length ?
				Array.isArray(ret[0]) ?
					new _Api(ret.context, ret[0]) : // Array results are 'enhanced'
					ret[0] :
				undefined;
		}

		// Non-API return - just fire it back
		return ret;
	});
};
// #endregion

// _buildInclude('api.table.js');
// _buildInclude('api.draw.js');
// _buildInclude('api.page.js');
// _buildInclude('api.ajax.js');
// _buildInclude('api.selectors.js');
// _buildInclude('api.rows.js');
// _buildInclude('api.row.details.js');
// _buildInclude('api.columns.js');
// _buildInclude('api.cells.js');
// _buildInclude('api.order.js');
// _buildInclude('api.processing.js');
// _buildInclude('api.search.js');
// _buildInclude('api.state.js');
// _buildInclude('api.static.js');
// _buildInclude('api.core.js');

/**
 * Version string for plug-ins to check compatibility. Allowed format is
 * `a.b.c-d` where: a:int, b:int, c:int, d:string(dev|beta|alpha). `d` is used
 * only for non-release builds. See https://semver.org/ for more information.
 *  @member
 *  @type string
 *  @default Version number
 */
DataTable.version = "2.1.6";

/**
 * Private data store, containing all of the settings objects that are
 * created for the tables on a given page.
 *
 * Note that the `DataTable.settings` object is aliased to
 * `jQuery.fn.dataTableExt` through which it may be accessed and
 * manipulated, or `jQuery.fn.dataTable.settings`.
 *  @member
 *  @type array
 *  @default []
 *  @private
 */
DataTable.settings = [];

/**
 * Object models container, for the various models that DataTables has
 * available to it. These models define the objects that are used to hold
 * the active state and configuration of the table.
 *  @namespace
 */
DataTable.models = {};
// _buildInclude('model.search.js');
// _buildInclude('model.row.js');
// _buildInclude('model.column.js');

// #region model.defaults.js

/*
 * Developer note: The properties of the object below are given in Hungarian
 * notation, that was used as the interface for DataTables prior to v1.10, however
 * from v1.10 onwards the primary interface is camel case. In order to avoid
 * breaking backwards compatibility utterly with this change, the Hungarian
 * version is still, internally the primary interface, but is is not documented
 * - hence the @name tags in each doc comment. This allows a Javascript function
 * to create a map from Hungarian notation to camel case (going the other direction
 * would require each property to be listed, which would add around 3K to the size
 * of DataTables, while this method is about a 0.5K hit).
 *
 * Ultimately this does pave the way for Hungarian notation to be dropped
 * completely, but that is a massive amount of work and will break current
 * installs (therefore is on-hold until v2).
 */

/**
 * Initialisation options that can be given to DataTables at initialisation
 * time.
 *  @namespace
 */
DataTable.defaults = {
	/**
	 * An array of data to use for the table, passed in at initialisation which
	 * will be used in preference to any data which is already in the DOM. This is
	 * particularly useful for constructing tables purely in Javascript, for
	 * example with a custom Ajax call.
	 */
	"data": null,


	/**
	 * If ordering is enabled, then DataTables will perform a first pass sort on
	 * initialisation. You can define which column(s) the sort is performed
	 * upon, and the sorting direction, with this variable. The `sorting` array
	 * should contain an array for each column to be sorted initially containing
	 * the column's index and a direction string ('asc' or 'desc').
	 */
	"order": [[0, 'asc']],


	/**
	 * This parameter is basically identical to the `sorting` parameter, but
	 * cannot be overridden by user interaction with the table. What this means
	 * is that you could have a column (visible or hidden) which the sorting
	 * will always be forced on first - any sorting after that (from the user)
	 * will then be performed as required. This can be useful for grouping rows
	 * together.
	 */
	"orderFixed": [],


	/**
	 * DataTables can be instructed to load data to display in the table from a
	 * Ajax source. This option defines how that Ajax call is made and where to.
	 *
	 * The `ajax` property has three different modes of operation, depending on
	 * how it is defined. These are:
	 *
	 * * `string` - Set the URL from where the data should be loaded from.
	 * * `object` - Define properties for `jQuery.ajax`.
	 * * `function` - Custom data get function
	 *
	 * `string`
	 * --------
	 *
	 * As a string, the `ajax` property simply defines the URL from which
	 * DataTables will load data.
	 *
	 * `object`
	 * --------
	 *
	 * As an object, the parameters in the object are passed to
	 * [jQuery.ajax](https://api.jquery.com/jQuery.ajax/) allowing fine control
	 * of the Ajax request. DataTables has a number of default parameters which
	 * you can override using this option. Please refer to the jQuery
	 * documentation for a full description of the options available, although
	 * the following parameters provide additional options in DataTables or
	 * require special consideration:
	 *
	 * * `data` - As with jQuery, `data` can be provided as an object, but it
	 *   can also be used as a function to manipulate the data DataTables sends
	 *   to the server. The function takes a single parameter, an object of
	 *   parameters with the values that DataTables has readied for sending. An
	 *   object may be returned which will be merged into the DataTables
	 *   defaults, or you can add the items to the object that was passed in and
	 *   not return anything from the function. This supersedes `fnServerParams`
	 *   from DataTables 1.9-.
	 *
	 * * `dataSrc` - By default DataTables will look for the property `data` (or
	 *   `aaData` for compatibility with DataTables 1.9-) when obtaining data
	 *   from an Ajax source or for server-side processing - this parameter
	 *   allows that property to be changed. You can use Javascript dotted
	 *   object notation to get a data source for multiple levels of nesting, or
	 *   it my be used as a function. As a function it takes a single parameter,
	 *   the JSON returned from the server, which can be manipulated as
	 *   required, with the returned value being that used by DataTables as the
	 *   data source for the table.
	 *
	 * * `success` - Should not be overridden it is used internally in
	 *   DataTables. To manipulate / transform the data returned by the server
	 *   use `ajax.dataSrc`, or use `ajax` as a function (see below).
	 *
	 * `function`
	 * ----------
	 *
	 * As a function, making the Ajax call is left up to yourself allowing
	 * complete control of the Ajax request. Indeed, if desired, a method other
	 * than Ajax could be used to obtain the required data, such as Web storage
	 * or an AIR database.
	 *
	 * The function is given four parameters and no return is required. The
	 * parameters are:
	 *
	 * 1. _object_ - Data to send to the server
	 * 2. _function_ - Callback function that must be executed when the required
	 *    data has been obtained. That data should be passed into the callback
	 *    as the only parameter
	 * 3. _object_ - DataTables settings object for the table
	 */
	"ajax": null,


	/**
	 * This parameter allows you to readily specify the entries in the length drop
	 * down menu that DataTables shows when pagination is enabled. It can be
	 * either a 1D array of options which will be used for both the displayed
	 * option and the value, or a 2D array which will use the array in the first
	 * position as the value, and the array in the second position as the
	 * displayed options (useful for language strings such as 'All').
	 *
	 * Note that the `pageLength` property will be automatically set to the
	 * first value given in this array, unless `pageLength` is also provided.
	 */
	"lengthMenu": [10, 25, 50, 100],


	/**
	 * The `columns` option in the initialisation parameter allows you to define
	 * details about the way individual columns behave. For a full list of
	 * column options that can be set, please see
	 * {@link DataTable.defaults.column}. Note that if you use `columns` to
	 * define your columns, you must have an entry in the array for every single
	 * column that you have in your table (these can be null if you don't which
	 * to specify any options).
	 */
	"columns": null,

	/**
	 * Very similar to `columns`, `columnDefs` allows you to target a specific
	 * column, multiple columns, or all columns, using the `targets` property of
	 * each object in the array. This allows great flexibility when creating
	 * tables, as the `columnDefs` arrays can be of any length, targeting the
	 * columns you specifically want. `columnDefs` may use any of the column
	 * options available: {@link DataTable.defaults.column}, but it _must_
	 * have `targets` defined in each object in the array. Values in the `targets`
	 * array may be:
	 *   <ul>
	 *     <li>a string - class name will be matched on the TH for the column</li>
	 *     <li>0 or a positive integer - column index counting from the left</li>
	 *     <li>a negative integer - column index counting from the right</li>
	 *     <li>the string "_all" - all columns (i.e. assign a default)</li>
	 *   </ul>
	 */
	"columnDefs": null,


	/**
	 * Basically the same as `search`, this parameter defines the individual column
	 * filtering state at initialisation time. The array must be of the same size
	 * as the number of columns, and each element be an object with the parameters
	 * `search` and `escapeRegex` (the latter is optional). 'null' is also
	 * accepted and the default will be used.
	 */
	"searchCols": [],


	/**
	 * Enable or disable automatic column width calculation. This can be disabled
	 * as an optimisation (it takes some time to calculate the widths) if the
	 * tables widths are passed in using `columns`.
	 */
	"autoWidth": true,


	/**
	 * Deferred rendering can provide DataTables with a huge speed boost when you
	 * are using an Ajax or JS data source for the table. This option, when set to
	 * true, will cause DataTables to defer the creation of the table elements for
	 * each row until they are needed for a draw - saving a significant amount of
	 * time.
	 */
	"deferRender": true,


	/**
	 * Replace a DataTable which matches the given selector and replace it with
	 * one which has the properties of the new initialisation object passed. If no
	 * table matches the selector, then the new DataTable will be constructed as
	 * per normal.
	 */
	"destroy": false,


	/**
	 * Enable or disable filtering of data. Filtering in DataTables is "smart" in
	 * that it allows the end user to input multiple words (space separated) and
	 * will match a row containing those words, even if not in the order that was
	 * specified (this allow matching across multiple columns). Note that if you
	 * wish to use filtering in DataTables this must remain 'true' - to remove the
	 * default filtering input box and retain filtering abilities, please use
	 * {@link DataTable.defaults.dom}.
	 */
	"searching": true,

	/**
	 * Used only for compatiblity with DT1
	 * @deprecated
	 */
	"info": true,

	/**
	 * Used only for compatiblity with DT1
	 * @deprecated
	 */
	"lengthChange": true,

	/**
	 * Enable or disable pagination.
	 */
	"paging": true,


	/**
	 * Enable or disable the display of a 'processing' indicator when the table is
	 * being processed (e.g. a sort). This is particularly useful for tables with
	 * large amounts of data where it can take a noticeable amount of time to sort
	 * the entries.
	 */
	"processing": false,


	/**
	 * Retrieve the DataTables object for the given selector. Note that if the
	 * table has already been initialised, this parameter will cause DataTables
	 * to simply return the object that has already been set up - it will not take
	 * account of any changes you might have made to the initialisation object
	 * passed to DataTables (setting this parameter to true is an acknowledgement
	 * that you understand this). `destroy` can be used to reinitialise a table if
	 * you need.
	 */
	"retrieve": false,


	/**
	 * When vertical (y) scrolling is enabled, DataTables will force the height of
	 * the table's viewport to the given height at all times (useful for layout).
	 * However, this can look odd when filtering data down to a small data set,
	 * and the footer is left "floating" further down. This parameter (when
	 * enabled) will cause DataTables to collapse the table's viewport down when
	 * the result set will fit within the given Y height.
	 */
	"scrollCollapse": false,


	/**
	 * Configure DataTables to use server-side processing. Note that the
	 * `ajax` parameter must also be given in order to give DataTables a
	 * source to obtain the required data for each draw.
	 */
	"serverSide": false,


	/**
	 * Enable or disable sorting of columns. Sorting of individual columns can be
	 * disabled by the `sortable` option for each column.
	 */
	"ordering": true,


	/**
	 * Enable or display DataTables' ability to sort multiple columns at the
	 * same time (activated by shift-click by the user).
	 */
	"orderMulti": true,


	/**
	 * Allows control over whether DataTables should use the top (true) unique
	 * cell that is found for a single column, or the bottom (false - default).
	 * This is useful when using complex headers.
	 */
	"orderCellsTo": null,


	/**
	 * Enable or disable the addition of the classes `sorting\_1`, `sorting\_2` and
	 * `sorting\_3` to the columns which are currently being sorted on. This is
	 * presented as a feature switch as it can increase processing time (while
	 * classes are removed and added) so for large data sets you might want to
	 * turn this off.
	 */
	"orderClasses": true,


	/**
	 * Enable or disable state saving. When enabled HTML5 `localStorage` will be
	 * used to save table display information such as pagination information,
	 * display length, filtering and sorting. As such when the end user reloads
	 * the page the display display will match what thy had previously set up.
	 */
	"stateSave": false,


	/**
	 * This function is called when a TR element is created (and all TD child
	 * elements have been inserted), or registered if using a DOM source, allowing
	 * manipulation of the TR element (adding classes etc).
	 */
	"createdRow": null,


	/**
	 * This function is called on every 'draw' event, and allows you to
	 * dynamically modify any aspect you want about the created DOM.
	 */
	"drawCallback": null,


	/**
	 * Identical to fnHeaderCallback() but for the table footer this function
	 * allows you to modify the table footer on every 'draw' event.
	 */
	"footerCallback": null,


	/**
	 * When rendering large numbers in the information element for the table
	 * (i.e. "Showing 1 to 10 of 57 entries") DataTables will render large numbers
	 * to have a comma separator for the 'thousands' units (e.g. 1 million is
	 * rendered as "1,000,000") to help readability for the end user. This
	 * function will override the default method DataTables uses.
	 */
	"formatNumber": function (toFormat) {
		return toFormat.toString().replace(
			/\B(?=(\d{3})+(?!\d))/g,
			this.oLanguage.sThousands
		);
	},


	/**
	 * This function is called on every 'draw' event, and allows you to
	 * dynamically modify the header row. This can be used to calculate and
	 * display useful information about the table.
	 */
	"headerCallback": null,


	/**
	 * The information element can be used to convey information about the current
	 * state of the table. Although the internationalisation options presented by
	 * DataTables are quite capable of dealing with most customisations, there may
	 * be times where you wish to customise the string further. This callback
	 * allows you to do exactly that.
	 */
	"infoCallback": null,


	/**
	 * Called when the table has been initialised. Normally DataTables will
	 * initialise sequentially and there will be no need for this function,
	 * however, this does not hold true when using external language information
	 * since that is obtained using an async XHR call.
	 */
	"initComplete": null,


	/**
	 * Called at the very start of each table draw and can be used to cancel the
	 * draw by returning false, any other return (including undefined) results in
	 * the full draw occurring).
	 */
	"preDrawCallback": null,


	/**
	 * This function allows you to 'post process' each row after it have been
	 * generated for each table draw, but before it is rendered on screen. This
	 * function might be used for setting the row class name etc.
	 */
	"rowCallback": null,


	/**
	 * Load the table state. With this function you can define from where, and how, the
	 * state of a table is loaded. By default DataTables will load from `localStorage`
	 * but you might wish to use a server-side database or cookies.
	 */
	"stateLoadCallback": function (settings) {
		try {
			return JSON.parse(
				(settings.iStateDuration === -1 ? sessionStorage : localStorage).getItem(
					'DataTables_' + settings.sInstance + '_' + location.pathname
				)
			);
		} catch (e) {
			return {};
		}
	},


	/**
	 * Callback which allows modification of the saved state prior to loading that state.
	 * This callback is called when the table is loading state from the stored data, but
	 * prior to the settings object being modified by the saved state. Note that for
	 * plug-in authors, you should use the `stateLoadParams` event to load parameters for
	 * a plug-in.
	 */
	"stateLoadParams": null,


	/**
	 * Callback that is called when the state has been loaded from the state saving method
	 * and the DataTables settings object has been modified as a result of the loaded state.
	 */
	"stateLoaded": null,


	/**
	 * Save the table state. This function allows you to define where and how the state
	 * information for the table is stored By default DataTables will use `localStorage`
	 * but you might wish to use a server-side database or cookies.
	 */
	"stateSaveCallback": function (settings, data) {
		try {
			(settings.iStateDuration === -1 ? sessionStorage : localStorage).setItem(
				'DataTables_' + settings.sInstance + '_' + location.pathname,
				JSON.stringify(data)
			);
		} catch (e) {
			// noop
		}
	},


	/**
	 * Callback which allows modification of the state to be saved. Called when the table
	 * has changed state a new state save is required. This method allows modification of
	 * the state saving object prior to actually doing the save, including addition or
	 * other state properties or modification. Note that for plug-in authors, you should
	 * use the `stateSaveParams` event to save parameters for a plug-in.
	 */
	"stateSaveParams": null,


	/**
	 * Duration for which the saved state information is considered valid. After this period
	 * has elapsed the state will be returned to the default.
	 * Value is given in seconds.
	 */
	"stateDuration": 7200,


	/**
	 * Number of rows to display on a single page when using pagination. If
	 * feature enabled (`lengthChange`) then the end user will be able to override
	 * this to a custom setting using a pop-up menu.
	 */
	"pageLength": 10,


	/**
	 * Define the starting point for data display when using DataTables with
	 * pagination. Note that this parameter is the number of records, rather than
	 * the page number, so if you have 10 records per page and want to start on
	 * the third page, it should be "20".
	 */
	"displayStart": 0,


	/**
	 * By default DataTables allows keyboard navigation of the table (sorting, paging,
	 * and filtering) by adding a `tabindex` attribute to the required elements. This
	 * allows you to tab through the controls and press the enter key to activate them.
	 * The tabindex is default 0, meaning that the tab follows the flow of the document.
	 * You can overrule this using this parameter if you wish. Use a value of -1 to
	 * disable built-in keyboard navigation.
	 */
	"tabIndex": 0,


	/**
	 * Classes that DataTables assigns to the various components and features
	 * that it adds to the HTML table. This allows classes to be configured
	 * during initialisation in addition to through the static
	 * {@link DataTable.ext.oStdClasses} object).
	 */
	"classes": {},


	/**
	 * All strings that DataTables uses in the user interface that it creates
	 * are defined in this object, allowing you to modified them individually or
	 * completely replace them all as required.
	 */
	"language": {
		/**
		 * Strings that are used for WAI-ARIA labels and controls only (these are not
		 * actually visible on the page, but will be read by screenreaders, and thus
		 * must be internationalised as well).
		 */
		"aria": {
			/**
			 * ARIA label that is added to the table headers when the column may be sorted
			 */
			"orderable": ": Activate to sort",

			/**
			 * ARIA label that is added to the table headers when the column is currently being sorted
			 */
			"orderableReverse": ": Activate to invert sorting",

			/**
			 * ARIA label that is added to the table headers when the column is currently being 
			 * sorted and next step is to remove sorting
			 */
			"orderableRemove": ": Activate to remove sorting",

			paginate: {
				first: 'First',
				last: 'Last',
				next: 'Next',
				previous: 'Previous',
				number: ''
			}
		},

		/**
		 * Pagination string used by DataTables for the built-in pagination
		 * control types.
		 */
		"paginate": {
			/**
			 * Label and character for first page button («)
			 */
			"first": "\u00AB",

			/**
			 * Last page button (»)
			 */
			"last": "\u00BB",

			/**
			 * Next page button (›)
			 */
			"next": "\u203A",

			/**
			 * Previous page button (‹)
			 */
			"previous": "\u2039",
		},

		/**
		 * Plural object for the data type the table is showing
		 */
		entries: {
			_: "entries",
			1: "entry"
		},

		/**
		 * This string is shown in preference to `zeroRecords` when the table is
		 * empty of data (regardless of filtering). Note that this is an optional
		 * parameter - if it is not given, the value of `zeroRecords` will be used
		 * instead (either the default or given value).
		 */
		"emptyTable": "No data available in table",


		/**
		 * This string gives information to the end user about the information
		 * that is current on display on the page. The following tokens can be
		 * used in the string and will be dynamically replaced as the table
		 * display updates. This tokens can be placed anywhere in the string, or
		 * removed as needed by the language requires:
		 *
		 * * `\_START\_` - Display index of the first record on the current page
		 * * `\_END\_` - Display index of the last record on the current page
		 * * `\_TOTAL\_` - Number of records in the table after filtering
		 * * `\_MAX\_` - Number of records in the table without filtering
		 * * `\_PAGE\_` - Current page number
		 * * `\_PAGES\_` - Total number of pages of data in the table
		 */
		"info": "Showing _START_ to _END_ of _TOTAL_ _ENTRIES-TOTAL_",


		/**
		 * Display information string for when the table is empty. Typically the
		 * format of this string should match `info`.
		 */
		"infoEmpty": "Showing 0 to 0 of 0 _ENTRIES-TOTAL_",


		/**
		 * When a user filters the information in a table, this string is appended
		 * to the information (`info`) to give an idea of how strong the filtering
		 * is. The variable _MAX_ is dynamically updated.
		 */
		"infoFiltered": "(filtered from _MAX_ total _ENTRIES-MAX_)",


		/**
		 * If can be useful to append extra information to the info string at times,
		 * and this variable does exactly that. This information will be appended to
		 * the `info` (`infoEmpty` and `infoFiltered` in whatever combination they are
		 * being used) at all times.
		 */
		"infoPostFix": "",


		/**
		 * This decimal place operator is a little different from the other
		 * language options since DataTables doesn't output floating point
		 * numbers, so it won't ever use this for display of a number. Rather,
		 * what this parameter does is modify the sort methods of the table so
		 * that numbers which are in a format which has a character other than
		 * a period (`.`) as a decimal place will be sorted numerically.
		 *
		 * Note that numbers with different decimal places cannot be shown in
		 * the same table and still be sortable, the table must be consistent.
		 * However, multiple different tables on the page can use different
		 * decimal place characters.
		 */
		"decimal": "",


		/**
		 * DataTables has a build in number formatter (`formatNumber`) which is
		 * used to format large numbers that are used in the table information.
		 * By default a comma is used, but this can be trivially changed to any
		 * character you wish with this parameter.
		 */
		"thousands": ",",


		/**
		 * Detail the action that will be taken when the drop down menu for the
		 * pagination length option is changed. The '_MENU_' variable is replaced
		 * with a default select list of 10, 25, 50 and 100, and can be replaced
		 * with a custom select box if required.
		 */
		"lengthMenu": "_MENU_ _ENTRIES_ per page",


		/**
		 * When using Ajax sourced data and during the first draw when DataTables is
		 * gathering the data, this message is shown in an empty row in the table to
		 * indicate to the end user the the data is being loaded. Note that this
		 * parameter is not used when loading data by server-side processing, just
		 * Ajax sourced data with client-side processing.
		 */
		"loadingRecords": "Loading...",


		/**
		 * Text which is displayed when the table is processing a user action
		 * (usually a sort command or similar).
		 */
		"processing": "",


		/**
		 * Details the actions that will be taken when the user types into the
		 * filtering input text box. The variable "_INPUT_", if used in the string,
		 * is replaced with the HTML text box for the filtering input allowing
		 * control over where it appears in the string. If "_INPUT_" is not given
		 * then the input box is appended to the string automatically.
		 */
		"search": "Search:",


		/**
		 * Assign a `placeholder` attribute to the search `input` element
		 *  @type string
		 *  @default 
		 *
		 *  @dtopt Language
		 *  @name DataTable.defaults.language.searchPlaceholder
		 */
		"searchPlaceholder": "",


		/**
		 * All of the language information can be stored in a file on the
		 * server-side, which DataTables will look up if this parameter is passed.
		 * It must store the URL of the language file, which is in a JSON format,
		 * and the object has the same properties as the oLanguage object in the
		 * initialiser object (i.e. the above parameters). Please refer to one of
		 * the example language files to see how this works in action.
		 */
		"url": "",


		/**
		 * Text shown inside the table records when the is no information to be
		 * displayed after filtering. `emptyTable` is shown when there is simply no
		 * information in the table at all (regardless of filtering).
		 */
		"zeroRecords": "No matching records found"
	},


	/** The initial data order is reversed when `desc` ordering */
	orderDescReverse: true,


	/**
	 * This parameter allows you to have define the global filtering state at
	 * initialisation time. As an object the `search` parameter must be
	 * defined, but all other parameters are optional. When `regex` is true,
	 * the search string will be treated as a regular expression, when false
	 * (default) it will be treated as a straight string. When `smart`
	 * DataTables will use it's smart filtering methods (to word match at
	 * any point in the data), when false this will not be done.
	 */
	"search": $.extend({}, DataTable.models.oSearch),


	/**
	 * Table and control layout. This replaces the legacy `dom` option.
	 */
	layout: {
		topStart: 'pageLength',
		topEnd: 'search',
		bottomStart: 'info',
		bottomEnd: 'paging'
	},


	/**
	 * Legacy DOM layout option
	 */
	"dom": null,


	/**
	 * Search delay option. This will throttle full table searches that use the
	 * DataTables provided search input element (it does not effect calls to
	 * `dt-api search()`, providing a delay before the search is made.
	 */
	"searchDelay": null,


	/**
	 * DataTables features six different built-in options for the buttons to
	 * display for pagination control:
	 *
	 * * `numbers` - Page number buttons only
	 * * `simple` - 'Previous' and 'Next' buttons only
	 * * 'simple_numbers` - 'Previous' and 'Next' buttons, plus page numbers
	 * * `full` - 'First', 'Previous', 'Next' and 'Last' buttons
	 * * `full_numbers` - 'First', 'Previous', 'Next' and 'Last' buttons, plus page numbers
	 * * `first_last_numbers` - 'First' and 'Last' buttons, plus page numbers
	 */
	"pagingType": "",


	/**
	 * Enable horizontal scrolling. When a table is too wide to fit into a
	 * certain layout, or you have a large number of columns in the table, you
	 * can enable x-scrolling to show the table in a viewport, which can be
	 * scrolled. This property can be `true` which will allow the table to
	 * scroll horizontally when needed, or any CSS unit, or a number (in which
	 * case it will be treated as a pixel measurement). Setting as simply `true`
	 * is recommended.
	 */
	"scrollX": "",


	/**
	 * This property can be used to force a DataTable to use more width than it
	 * might otherwise do when x-scrolling is enabled. For example if you have a
	 * table which requires to be well spaced, this parameter is useful for
	 * "over-sizing" the table, and thus forcing scrolling. This property can by
	 * any CSS unit, or a number (in which case it will be treated as a pixel
	 * measurement).
	 */
	"scrollXInner": "",


	/**
	 * Enable vertical scrolling. Vertical scrolling will constrain the DataTable
	 * to the given height, and enable scrolling for any data which overflows the
	 * current viewport. This can be used as an alternative to paging to display
	 * a lot of data in a small area (although paging and scrolling can both be
	 * enabled at the same time). This property can be any CSS unit, or a number
	 * (in which case it will be treated as a pixel measurement).
	 */
	"scrollY": "",


	/**
	 * __Deprecated__ The functionality provided by this parameter has now been
	 * superseded by that provided through `ajax`, which should be used instead.
	 *
	 * Set the HTTP method that is used to make the Ajax call for server-side
	 * processing or Ajax sourced data.
	 */
	"serverMethod": "GET",


	/**
	 * DataTables makes use of renderers when displaying HTML elements for
	 * a table. These renderers can be added or modified by plug-ins to
	 * generate suitable mark-up for a site. For example the Bootstrap
	 * integration plug-in for DataTables uses a paging button renderer to
	 * display pagination buttons in the mark-up required by Bootstrap.
	 *
	 * For further information about the renderers available see
	 * DataTable.ext.renderer
	 */
	"renderer": null,


	/**
	 * Set the data property name that DataTables should use to get a row's id
	 * to set as the `id` property in the node.
	 */
	"rowId": "DT_RowId",


	/**
	 * Caption value
	 */
	"caption": null,


	/**
	 * For server-side processing - use the data from the DOM for the first draw
	 */
	deferLoading: null
};

// #endregion

// #region model.defaults.columns.js

/*
 * Developer note - See note in model.defaults.js about the use of Hungarian
 * notation and camel case.
 */

/**
 * Column options that can be given to DataTables at initialisation time.
 *  @namespace
 */
DataTable.defaults.column = {
	/**
	 * Define which column(s) an order will occur on for this column. This
	 * allows a column's ordering to take multiple columns into account when
	 * doing a sort or use the data from a different column. For example first
	 * name / last name columns make sense to do a multi-column sort over the
	 * two columns.
	 */
	"orderData": null,
	"dataSort": -1,

	ariaTitle: '',


	/**
	 * You can control the default ordering direction, and even alter the
	 * behaviour of the sort handler (i.e. only allow ascending ordering etc)
	 * using this parameter.
	 */
	"orderSequence": ['asc', 'desc', ''],


	/**
	 * Enable or disable filtering on the data in this column.
	 */
	"searchable": true,


	/**
	 * Enable or disable ordering on this column.
	 */
	"orderable": true,


	/**
	 * Enable or disable the display of this column.
	 */
	"visible": true,


	/**
	 * Developer definable function that is called whenever a cell is created (Ajax source,
	 * etc) or processed for input (DOM source). This can be used as a compliment to mRender
	 * allowing you to modify the DOM element (add background colour for example) when the
	 * element is available.
	 */
	"createdCell": null,


	/**
	 * This property can be used to read data from any data source property,
	 * including deeply nested objects / properties. `data` can be given in a
	 * number of different ways which effect its behaviour:
	 *
	 * * `integer` - treated as an array index for the data source. This is the
	 *   default that DataTables uses (incrementally increased for each column).
	 * * `string` - read an object property from the data source. There are
	 *   three 'special' options that can be used in the string to alter how
	 *   DataTables reads the data from the source object:
	 *    * `.` - Dotted Javascript notation. Just as you use a `.` in
	 *      Javascript to read from nested objects, so to can the options
	 *      specified in `data`. For example: `browser.version` or
	 *      `browser.name`. If your object parameter name contains a period, use
	 *      `\\` to escape it - i.e. `first\\.name`.
	 *    * `[]` - Array notation. DataTables can automatically combine data
	 *      from and array source, joining the data with the characters provided
	 *      between the two brackets. For example: `name[, ]` would provide a
	 *      comma-space separated list from the source array. If no characters
	 *      are provided between the brackets, the original array source is
	 *      returned.
	 *    * `()` - Function notation. Adding `()` to the end of a parameter will
	 *      execute a function of the name given. For example: `browser()` for a
	 *      simple function on the data source, `browser.version()` for a
	 *      function in a nested property or even `browser().version` to get an
	 *      object property if the function called returns an object. Note that
	 *      function notation is recommended for use in `render` rather than
	 *      `data` as it is much simpler to use as a renderer.
	 * * `null` - use the original data source for the row rather than plucking
	 *   data directly from it. This action has effects on two other
	 *   initialisation options:
	 *    * `defaultContent` - When null is given as the `data` option and
	 *      `defaultContent` is specified for the column, the value defined by
	 *      `defaultContent` will be used for the cell.
	 *    * `render` - When null is used for the `data` option and the `render`
	 *      option is specified for the column, the whole data source for the
	 *      row is used for the renderer.
	 * * `function` - the function given will be executed whenever DataTables
	 *   needs to set or get the data for a cell in the column. The function
	 *   takes three parameters:
	 *    * Parameters:
	 *      * `{array|object}` The data source for the row
	 *      * `{string}` The type call data requested - this will be 'set' when
	 *        setting data or 'filter', 'display', 'type', 'sort' or undefined
	 *        when gathering data. Note that when `undefined` is given for the
	 *        type DataTables expects to get the raw data for the object back<
	 *      * `{*}` Data to set when the second parameter is 'set'.
	 *    * Return:
	 *      * The return value from the function is not required when 'set' is
	 *        the type of call, but otherwise the return is what will be used
	 *        for the data requested.
	 *
	 * Note that `data` is a getter and setter option. If you just require
	 * formatting of data for output, you will likely want to use `render` which
	 * is simply a getter and thus simpler to use.
	 *
	 * Note that prior to DataTables 1.9.2 `data` was called `mDataProp`. The
	 * name change reflects the flexibility of this property and is consistent
	 * with the naming of mRender. If 'mDataProp' is given, then it will still
	 * be used by DataTables, as it automatically maps the old name to the new
	 * if required.
	 */
	"data": null,


	/**
	 * This property is the rendering partner to `data` and it is suggested that
	 * when you want to manipulate data for display (including filtering,
	 * sorting etc) without altering the underlying data for the table, use this
	 * property. `render` can be considered to be the the read only companion to
	 * `data` which is read / write (then as such more complex). Like `data`
	 * this option can be given in a number of different ways to effect its
	 * behaviour:
	 *
	 * * `integer` - treated as an array index for the data source. This is the
	 *   default that DataTables uses (incrementally increased for each column).
	 * * `string` - read an object property from the data source. There are
	 *   three 'special' options that can be used in the string to alter how
	 *   DataTables reads the data from the source object:
	 *    * `.` - Dotted Javascript notation. Just as you use a `.` in
	 *      Javascript to read from nested objects, so to can the options
	 *      specified in `data`. For example: `browser.version` or
	 *      `browser.name`. If your object parameter name contains a period, use
	 *      `\\` to escape it - i.e. `first\\.name`.
	 *    * `[]` - Array notation. DataTables can automatically combine data
	 *      from and array source, joining the data with the characters provided
	 *      between the two brackets. For example: `name[, ]` would provide a
	 *      comma-space separated list from the source array. If no characters
	 *      are provided between the brackets, the original array source is
	 *      returned.
	 *    * `()` - Function notation. Adding `()` to the end of a parameter will
	 *      execute a function of the name given. For example: `browser()` for a
	 *      simple function on the data source, `browser.version()` for a
	 *      function in a nested property or even `browser().version` to get an
	 *      object property if the function called returns an object.
	 * * `object` - use different data for the different data types requested by
	 *   DataTables ('filter', 'display', 'type' or 'sort'). The property names
	 *   of the object is the data type the property refers to and the value can
	 *   defined using an integer, string or function using the same rules as
	 *   `render` normally does. Note that an `_` option _must_ be specified.
	 *   This is the default value to use if you haven't specified a value for
	 *   the data type requested by DataTables.
	 * * `function` - the function given will be executed whenever DataTables
	 *   needs to set or get the data for a cell in the column. The function
	 *   takes three parameters:
	 *    * Parameters:
	 *      * {array|object} The data source for the row (based on `data`)
	 *      * {string} The type call data requested - this will be 'filter',
	 *        'display', 'type' or 'sort'.
	 *      * {array|object} The full data source for the row (not based on
	 *        `data`)
	 *    * Return:
	 *      * The return value from the function is what will be used for the
	 *        data requested.
	 */
	"render": null,

	/**
	 * Change the cell type created for the column - either TD cells or TH cells. This
	 * can be useful as TH cells have semantic meaning in the table body, allowing them
	 * to act as a header for a row (you may wish to add scope='row' to the TH elements).
	 */
	"cellType": "td",


	/**
	 * Class to give to each cell in this column.
	 */
	"class": "",

	/**
	 * When DataTables calculates the column widths to assign to each column,
	 * it finds the longest string in each column and then constructs a
	 * temporary table and reads the widths from that. The problem with this
	 * is that "mmm" is much wider then "iiii", but the latter is a longer
	 * string - thus the calculation can go wrong (doing it properly and putting
	 * it into an DOM object and measuring that is horribly(!) slow). Thus as
	 * a "work around" we provide this option. It will append its value to the
	 * text that is found to be the longest string for the column - i.e. padding.
	 * Generally you shouldn't need this!
	 */
	"contentPadding": "",


	/**
	 * Allows a default value to be given for a column's data, and will be used
	 * whenever a null data source is encountered (this can be because `data`
	 * is set to null, or because the data source itself is null).
	 */
	"defaultContent": null,


	/**
	 * This parameter is only used in DataTables' server-side processing. It can
	 * be exceptionally useful to know what columns are being displayed on the
	 * client side, and to map these to database fields. When defined, the names
	 * also allow DataTables to reorder information from the server if it comes
	 * back in an unexpected order (i.e. if you switch your columns around on the
	 * client-side, your server-side code does not also need updating).
	 */
	"name": "",


	/**
	 * Defines a data source type for the ordering which can be used to read
	 * real-time information from the table (updating the internally cached
	 * version) prior to ordering. This allows ordering to occur on user
	 * editable elements such as form inputs.
	 */
	"orderDataType": "std",


	/**
	 * The title of this column.
	 */
	"title": null,

	/**
	 * The type allows you to specify how the data for this column will be
	 * ordered. Four types (string, numeric, date and html (which will strip
	 * HTML tags before ordering)) are currently available. Note that only date
	 * formats understood by Javascript's Date() object will be accepted as type
	 * date. For example: "Mar 26, 2008 5:03 PM". May take the values: 'string',
	 * 'numeric', 'date' or 'html' (by default). Further types can be adding
	 * through plug-ins.
	 */
	"type": null,

	/**
	 * Defining the width of the column, this parameter may take any CSS value
	 * (3em, 20px etc). DataTables applies 'smart' widths to columns which have not
	 * been given a specific width through this interface ensuring that the table
	 * remains readable.
	 */
	"width": null
};

// #endregion

// #region model.settings.js

/**
 * DataTables settings object - this holds all the information needed for a
 * given table, including configuration, data and current application of the
 * table options. DataTables does not have a single instance for each DataTable
 * with the settings attached to that instance, but rather instances of the
 * DataTable "class" are created on-the-fly as needed (typically by a
 * $().dataTable() call) and the settings object is then applied to that
 * instance.
 *
 * Note that this object is related to {@link DataTable.defaults} but this
 * one is the internal data store for DataTables's cache of columns. It should
 * NOT be manipulated outside of DataTables. Any configuration should be done
 * through the initialisation options.
 */
DataTable.models.oSettings = {
	/**
	 * Primary features of DataTables and their enablement state.
	 */
	"features": {
		/**
		 * Flag to say if DataTables should automatically try to calculate the
		 * optimum table and columns widths (true) or not (false).
		 * Note that this parameter will be set by the initialisation routine. To
		 * set a default use {@link DataTable.defaults}.
		 */
		"autoWidth": null,

		/**
		 * Delay the creation of TR and TD elements until they are actually
		 * needed by a driven page draw. This can give a significant speed
		 * increase for Ajax source and Javascript source data, but makes no
		 * difference at all for DOM and server-side processing tables.
		 * Note that this parameter will be set by the initialisation routine. To
		 * set a default use {@link DataTable.defaults}.
		 */
		"deferRender": null,

		/**
		 * Enable filtering on the table or not. Note that if this is disabled
		 * then there is no filtering at all on the table, including fnFilter.
		 * To just remove the filtering input use sDom and remove the 'f' option.
		 * Note that this parameter will be set by the initialisation routine. To
		 * set a default use {@link DataTable.defaults}.
		 */
		"searching": null,

		/**
		 * Used only for compatiblity with DT1
		 * @deprecated
		 */
		"info": true,

		/**
		 * Used only for compatiblity with DT1
		 * @deprecated
		 */
		"lengthChange": true,

		/**
		 * Pagination enabled or not. Note that if this is disabled then length
		 * changing must also be disabled.
		 * Note that this parameter will be set by the initialisation routine. To
		 * set a default use {@link DataTable.defaults}.
		 */
		"paging": null,

		/**
		 * Processing indicator enable flag whenever DataTables is enacting a
		 * user request - typically an Ajax request for server-side processing.
		 * Note that this parameter will be set by the initialisation routine. To
		 * set a default use {@link DataTable.defaults}.
		 */
		"processing": null,

		/**
		 * Server-side processing enabled flag - when enabled DataTables will
		 * get all data from the server for every draw - there is no filtering,
		 * sorting or paging done on the client-side.
		 * Note that this parameter will be set by the initialisation routine. To
		 * set a default use {@link DataTable.defaults}.
		 */
		"serverSide": null,

		/**
		 * Sorting enablement flag.
		 * Note that this parameter will be set by the initialisation routine. To
		 * set a default use {@link DataTable.defaults}.
		 */
		"ordering": null,

		/**
		 * Multi-column sorting
		 * Note that this parameter will be set by the initialisation routine. To
		 * set a default use {@link DataTable.defaults}.
		 */
		"orderMulti": null,

		/**
		 * Apply a class to the columns which are being sorted to provide a
		 * visual highlight or not. This can slow things down when enabled since
		 * there is a lot of DOM interaction.
		 * Note that this parameter will be set by the initialisation routine. To
		 * set a default use {@link DataTable.defaults}.
		 */
		"orderClasses": null,

		/**
		 * State saving enablement flag.
		 * Note that this parameter will be set by the initialisation routine. To
		 * set a default use {@link DataTable.defaults}.
		 */
		"stateSave": null
	},


	/**
	 * Scrolling settings for a table.
	 */
	"scroll": {
		/**
		 * When the table is shorter in height than sScrollY, collapse the
		 * table container down to the height of the table (when true).
		 * Note that this parameter will be set by the initialisation routine. To
		 * set a default use {@link DataTable.defaults}.
		 */
		"scrollCollapse": null,

		/**
		 * Width of the scrollbar for the web-browser's platform. Calculated
		 * during table initialisation.
		 */
		"barWidth": 0,

		/**
		 * Viewport width for horizontal scrolling. Horizontal scrolling is
		 * disabled if an empty string.
		 * Note that this parameter will be set by the initialisation routine. To
		 * set a default use {@link DataTable.defaults}.
		 */
		"scrollX": null,

		/**
		 * Width to expand the table to when using x-scrolling. Typically you
		 * should not need to use this.
		 * Note that this parameter will be set by the initialisation routine. To
		 * set a default use {@link DataTable.defaults}.
		 *  @deprecated
		 */
		"scrollXInner": null,

		/**
		 * Viewport height for vertical scrolling. Vertical scrolling is disabled
		 * if an empty string.
		 * Note that this parameter will be set by the initialisation routine. To
		 * set a default use {@link DataTable.defaults}.
		 */
		"scrollY": null
	},

	/**
	 * Language information for the table.
	 */
	"language": {
		/**
		 * Information callback function. See
		 * {@link DataTable.defaults.fnInfoCallback}
		 */
		"infoCallback": null
	},

	/**
	 * Browser support parameters
	 */
	"browser": {
		/**
		 * Determine if the vertical scrollbar is on the right or left of the
		 * scrolling container - needed for rtl language layout, although not
		 * all browsers move the scrollbar (Safari).
		 */
		"scrollbarLeft": false,

		/**
		 * Browser scrollbar width
		 */
		"barWidth": 0
	},


	"ajax": null,


	/**
	 * Array referencing the nodes which are used for the features. The
	 * parameters of this object match what is allowed by sDom - i.e.
	 *   <ul>
	 *     <li>'l' - Length changing</li>
	 *     <li>'f' - Filtering input</li>
	 *     <li>'t' - The table!</li>
	 *     <li>'i' - Information</li>
	 *     <li>'p' - Pagination</li>
	 *     <li>'r' - pRocessing</li>
	 *   </ul>
	 */
	"features": [],

	/**
	 * Store data information - see {@link DataTable.models.oRow} for detailed
	 * information.
	 */
	"data": [],

	/**
	 * Array of indexes which are in the current display (after filtering etc)
	 */
	"display": [],

	/**
	 * Array of indexes for display - no filtering
	 */
	"displayMaster": [],

	/**
	 * Map of row ids to data indexes
	 */
	"ids": {},

	/**
	 * Store information about each column that is in use
	 */
	"columns": [],

	/**
	 * Store information about the table's header
	 */
	"header": [],

	/**
	 * Store information about the table's footer
	 */
	"footer": [],

	/**
	 * Store the applied global search information in case we want to force a
	 * research or compare the old search to a new one.
	 * Note that this parameter will be set by the initialisation routine. To
	 * set a default use {@link DataTable.defaults}.
	 */
	"previousSearch": {},

	/**
	 * Store for named searches
	 */
	searchFixed: {},

	/**
	 * Store the applied search for each column - see
	 * {@link DataTable.models.oSearch} for the format that is used for the
	 * filtering information for each column.
	 */
	"preSearchCols": [],

	/**
	 * Sorting that is applied to the table. Note that the inner arrays are
	 * used in the following manner:
	 * <ul>
	 *   <li>Index 0 - column number</li>
	 *   <li>Index 1 - current sorting direction</li>
	 * </ul>
	 * Note that this parameter will be set by the initialisation routine. To
	 * set a default use {@link DataTable.defaults}.
	 */
	"sorting": null,

	/**
	 * Sorting that is always applied to the table (i.e. prefixed in front of
	 * aaSorting).
	 * Note that this parameter will be set by the initialisation routine. To
	 * set a default use {@link DataTable.defaults}.
	 */
	"sortingFixed": [],

	/**
	 * If restoring a table - we should restore its width
	 */
	"destroyWidth": 0,

	/**
	 * Callback functions array for every time a row is inserted (i.e. on a draw).
	 */
	"rowCallback": [],

	/**
	 * Callback functions for the header on each draw.
	 */
	"headerCallback": [],

	/**
	 * Callback function for the footer on each draw.
	 */
	"footerCallback": [],

	/**
	 * Array of callback functions for draw callback functions
	 */
	"drawCallback": [],

	/**
	 * Array of callback functions for row created function
	 */
	"rowCreatedCallback": [],

	/**
	 * Callback functions for just before the table is redrawn. A return of
	 * false will be used to cancel the draw.
	 */
	"preDrawCallback": [],

	/**
	 * Callback functions for when the table has been initialised.
	 */
	"initComplete": [],


	/**
	 * Callbacks for modifying the settings to be stored for state saving, prior to
	 * saving state.
	 */
	"stateSaveParams": [],

	/**
	 * Callbacks for modifying the settings that have been stored for state saving
	 * prior to using the stored values to restore the state.
	 */
	"stateLoadParams": [],

	/**
	 * Callbacks for operating on the settings object once the saved state has been
	 * loaded
	 */
	"stateLoaded": [],

	/**
	 * Cache the table ID for quick access
	 */
	"tableId": "",

	/**
	 * The TABLE node for the main table
	 */
	"table": null,

	/**
	 * Permanent ref to the thead element
	 */
	"tHead": null,

	/**
	 * Permanent ref to the tfoot element - if it exists
	 */
	"tFoot": null,

	/**
	 * Permanent ref to the tbody element
	 */
	"tBody": null,

	/**
	 * Cache the wrapper node (contains all DataTables controlled elements)
	 */
	"tableWrapper": null,

	/**
	 * Indicate if all required information has been read in
	 */
	"initialised": false,

	/**
	 * Information about open rows. Each object in the array has the parameters
	 * 'nTr' and 'nParent'
	 */
	"openRows": [],

	/**
	 * Dictate the positioning of DataTables' control elements - see
	 * {@link DataTable.model.oInit.sDom}.
	 * Note that this parameter will be set by the initialisation routine. To
	 * set a default use {@link DataTable.defaults}.
	 */
	"dom": null,

	/**
	 * Search delay (in mS)
	 */
	"searchDelay": null,

	/**
	 * Which type of pagination should be used.
	 * Note that this parameter will be set by the initialisation routine. To
	 * set a default use {@link DataTable.defaults}.
	 */
	"paginationType": "two_button",

	/**
	 * Number of paging controls on the page. Only used for backwards compatibility
	 */
	pagingControls: 0,

	/**
	 * The state duration (for `stateSave`) in seconds.
	 * Note that this parameter will be set by the initialisation routine. To
	 * set a default use {@link DataTable.defaults}.
	 */
	"stateDuration": 0,

	/**
	 * Array of callback functions for state saving. Each array element is an
	 * object with the following parameters:
	 *   <ul>
	 *     <li>function:fn - function to call. Takes two parameters, oSettings
	 *       and the JSON string to save that has been thus far created. Returns
	 *       a JSON string to be inserted into a json object
	 *       (i.e. '"param": [ 0, 1, 2]')</li>
	 *     <li>string:sName - name of callback</li>
	 *   </ul>
	 */
	"stateSave": [],

	/**
	 * Array of callback functions for state loading. Each array element is an
	 * object with the following parameters:
	 *   <ul>
	 *     <li>function:fn - function to call. Takes two parameters, oSettings
	 *       and the object stored. May return false to cancel state loading</li>
	 *     <li>string:sName - name of callback</li>
	 *   </ul>
	 */
	"stateLoad": [],

	/**
	 * State that was saved. Useful for back reference
	 */
	"savedState": null,

	/**
	 * State that was loaded. Useful for back reference
	 */
	"loadedState": null,

	/**
	 * Note if draw should be blocked while getting data
	 */
	"ajaxDataGet": true,

	/**
	 * The last jQuery XHR object that was used for server-side data gathering.
	 * This can be used for working with the XHR information in one of the
	 * callbacks
	 */
	"jqXHR": null,

	/**
	 * JSON returned from the server in the last Ajax request
	 */
	"json": undefined,

	/**
	 * Data submitted as part of the last Ajax request
	 */
	"ajaxData": undefined,

	/**
	 * Send the XHR HTTP method - GET or POST (could be PUT or DELETE if
	 * required).
	 * Note that this parameter will be set by the initialisation routine. To
	 * set a default use {@link DataTable.defaults}.
	 */
	"serverMethod": null,

	/**
	 * Format numbers for display.
	 * Note that this parameter will be set by the initialisation routine. To
	 * set a default use {@link DataTable.defaults}.
	 */
	"formatNumber": null,

	/**
	 * List of options that can be used for the user selectable length menu.
	 * Note that this parameter will be set by the initialisation routine. To
	 * set a default use {@link DataTable.defaults}.
	 */
	"lengthMenu": null,

	/**
	 * Counter for the draws that the table does. Also used as a tracker for
	 * server-side processing
	 */
	"draw": 0,

	/**
	 * Indicate if a redraw is being done - useful for Ajax
	 */
	"drawing": false,

	/**
	 * Draw index (iDraw) of the last error when parsing the returned data
	 */
	"drawError": -1,

	/**
	 * Paging display length
	 */
	"pageLength": 10,

	/**
	 * Paging start point - aiDisplay index
	 */
	"_displayStart": 0,

	/**
	 * Server-side processing - number of records in the result set
	 * (i.e. before filtering), Use fnRecordsTotal rather than
	 * this property to get the value of the number of records, regardless of
	 * the server-side processing setting.
	 */
	"_recordsTotal": 0,

	/**
	 * Server-side processing - number of records in the current display set
	 * (i.e. after filtering). Use fnRecordsDisplay rather than
	 * this property to get the value of the number of records, regardless of
	 * the server-side processing setting.
	 */
	"_recordsDisplay": 0,

	/**
	 * The classes to use for the table
	 */
	"classes": {},

	/**
	 * Flag attached to the settings object so you can check in the draw
	 * callback if filtering has been done in the draw. Deprecated in favour of
	 * events.
	 *  @deprecated
	 */
	"filtered": false,

	/**
	 * Flag attached to the settings object so you can check in the draw
	 * callback if sorting has been done in the draw. Deprecated in favour of
	 * events.
	 *  @deprecated
	 */
	"sorted": false,

	/**
	 * Indicate that if multiple rows are in the header and there is more than
	 * one unique cell per column, if the top one (true) or bottom one (false)
	 * should be used for sorting / title by DataTables.
	 * Note that this parameter will be set by the initialisation routine. To
	 * set a default use {@link DataTable.defaults}.
	 */
	"sortCellsTop": null,

	/**
	 * Initialisation object that is used for the table
	 */
	"init": null,

	/**
	 * Destroy callback functions - for plug-ins to attach themselves to the
	 * destroy so they can clean up markup and events.
	 */
	"destroyCallback": [],


	/**
	 * Get the number of records in the current record set, before filtering
	 */
	"recordsTotal": function () {
		return _fnDataSource(this) == 'ssp' ?
			this._iRecordsTotal * 1 :
			this.aiDisplayMaster.length;
	},

	/**
	 * Get the number of records in the current record set, after filtering
	 */
	"recordsDisplay": function () {
		return _fnDataSource(this) == 'ssp' ?
			this._iRecordsDisplay * 1 :
			this.aiDisplay.length;
	},

	/**
	 * Get the display end point - aiDisplay index
	 */
	"displayEnd": function () {
		var
			len = this._iDisplayLength,
			start = this._iDisplayStart,
			calc = start + len,
			records = this.aiDisplay.length,
			features = this.oFeatures,
			paginate = features.bPaginate;

		if (features.bServerSide) {
			return paginate === false || len === -1 ?
				start + records :
				Math.min(start + len, this._iRecordsDisplay);
		}
		else {
			return !paginate || calc > records || len === -1 ?
				records :
				calc;
		}
	},

	/**
	 * The DataTables object for this table
	 */
	"instance": null,

	/**
	 * Unique identifier for each instance of the DataTables object. If there
	 * is an ID on the table node, then it takes that value, otherwise an
	 * incrementing internal counter is used.
	 */
	"instanceId": null,

	/**
	 * tabindex attribute value that is added to DataTables control elements, allowing
	 * keyboard navigation of the table and its controls.
	 */
	"tabIndex": 0,

	/**
	 * DIV container for the footer scrolling table if scrolling
	 */
	"scrollHead": null,

	/**
	 * DIV container for the footer scrolling table if scrolling
	 */
	"scrollFoot": null,

	/**
	 * Last applied sort
	 */
	"lastSort": [],

	/**
	 * Stored plug-in instances
	 */
	"plugins": {},

	/**
	 * Function used to get a row's id from the row's data
	 */
	"rowIdFn": null,

	/**
	 * Data location where to store a row's id
	 */
	"rowId": null,

	caption: '',

	captionNode: null,

	colgroup: null,

	/** Delay loading of data */
	deferLoading: null,

	/** Allow auto type detection */
	typeDetect: true
};
// #endregion

/**
 * Extension object for DataTables that is used to provide all extension
 * options.
 *
 * Note that the `DataTable.ext` object is available through
 * `jQuery.fn.dataTable.ext` where it may be accessed and manipulated. It is
 * also aliased to `jQuery.fn.dataTableExt` for historic reasons.
 *  @namespace
 *  @extends DataTable.models.ext
 */
// _buildInclude('ext.paging.js');
// _buildInclude('ext.filter.js');
// _buildInclude('ext.helpers.js');
// _buildInclude('ext.types.js');
// _buildInclude('ext.sorting.js');
// _buildInclude('ext.renderer.js');

// _buildInclude('features.api.js');
// _buildInclude('features.div.js');
// _buildInclude('features.info.js');
// _buildInclude('features.search.js');
// _buildInclude('features.page.js');
// _buildInclude('features.pageLength.js');

// jQuery access
$.fn.dataTable = DataTable;

// Provide access to the host jQuery object (circular reference)
DataTable.$ = $;

// Legacy aliases
$.fn.dataTableSettings = DataTable.settings;
$.fn.dataTableExt = DataTable.ext;

// With a capital `D` we return a DataTables API instance rather than a
// jQuery object
$.fn.DataTable = function (opts) {
	return $(this).dataTable(opts).api();
};

// All properties that are available to $.fn.dataTable should also be
// available on $.fn.DataTable
$.each(DataTable, function (prop, val) {
	$.fn.DataTable[prop] = val;
});
// #endregion

export default DataTable;
