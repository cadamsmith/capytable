/*! DataTables 2.1.6
 * © SpryMedia Ltd - datatables.net/license
 */

// import jQuery from 'jquery';

// DataTables code uses $ internally, but we want to be able to
// reassign $ with the `use` method, so it is a regular var.
// var $ = jQuery;

// #region DataTable
var DataTable = function (selector, options) {
	// When creating with `new`, create a new DataTable, returning the API instance
	if (this instanceof DataTable) {
		return $(selector).DataTable(options);
	}
	else {
		// Argument switching
		options = selector;
	}

	var _that = this;
	var emptyInit = options === undefined;
	var len = this.length;

	if (emptyInit) {
		options = {};
	}

	// Method to get DT API instance from jQuery object
	this.api = function () {
		return new _Api(this);
	};

	this.each(function () {
		// For each initialisation we want to give it a clean initialisation
		// object that can be bashed around
		var o = {};
		var oInit = len > 1 ? // optimisation for single table case
			_fnExtend(o, options, true) :
			options;


		var i = 0, iLen;
		var sId = this.getAttribute('id');
		var defaults = DataTable.defaults;
		var $this = $(this);


		/* Sanity check */
		if (this.nodeName.toLowerCase() != 'table') {
			_fnLog(null, 0, 'Non-table node initialisation (' + this.nodeName + ')', 2);
			return;
		}

		$(this).trigger('options.dt', oInit);

		/* Check to see if we are re-initialising a table */
		var allSettings = DataTable.settings;
		for (i = 0, iLen = allSettings.length; i < iLen; i++) {
			var s = allSettings[i];

			/* Base check on table node */
			if (s.tableElement == this ||
				(s.tHeadElement && s.tHeadElement.parentNode == this) ||
				(s.tFootElement && s.tFootElement.parentNode == this)) {
				if (emptyInit) {
					return s.instance;
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

		/* Ensure the table has an ID - required for accessibility */
		if (sId === null || sId === "") {
			sId = "DataTables_Table_" + (DataTable.ext._unique++);
			this.id = sId;
		}

		/* Create the settings object for this table and set some of the default parameters */
		var oSettings = $.extend(true, {}, DataTable.models.oSettings, {
			instanceId: sId,
			"tableId": sId,
			colgroup: $('<colgroup>').prependTo(this)
		});
		oSettings.tableElement = this;

		allSettings.push(oSettings);

		// Make a single API instance available for internal handling
		oSettings.api = new _Api(oSettings);

		// Need to add the instance after the instance after the settings object has been added
		// to the settings array, so we can self reference the table instance if more than one
		oSettings.instance = (_that.length === 1) ? _that : $this.dataTable();

		// Apply the defaults and init options to make a single init object will all
		// options defined from defaults and instance options.
		oInit = _fnExtend(defaults, oInit);


		// Map the initialisation options onto the settings object
		_fnMap(oSettings.features, oInit, [
			"paging",
			"searching",
			"ordering",
		]);
		_fnMap(oSettings, oInit, [
			"order",
			"lengthMenu",
			"rowId",
			"search",
		]);

		oSettings._displayLength = oSettings.lengthMenu[0];

		oSettings.getRowId = _fnGetObjectDataFn(oInit.rowId);

		var oClasses = DataTable.ext.classes;

		$this.addClass(oClasses.table);

		if (oSettings.initDisplayStart === undefined) {
			/* Display start point, taking into account the save saving */
			oSettings.initDisplayStart = 0;
			oSettings._displayStart = 0;
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
		_fnApplyColumnDefs(columnsInit, function (iCol, oDef) {
			_fnColumnOptions(oSettings, iCol);
		});

		// Do a first pass on the sorting classes (allows any size changes to be taken into
		// account, and also will apply sorting disabled classes if disabled
		_fnSortingClasses(oSettings);

		_fnCallbackReg(oSettings, 'drawCallbacks', function () {
			_fnSortingClasses(oSettings);
		});


		/*
			* Table HTML init
			* Cache the header, body and footer as required, creating them if needed
			*/

		if (thead.length === 0) {
			thead = $('<thead/>').appendTo($this);
		}
		oSettings.tHeadElement = thead[0];
		$('tr', thead).addClass(oClasses.thead.row);

		var tbody = $this.children('tbody');
		if (tbody.length === 0) {
			tbody = $('<tbody/>').insertAfter(thead);
		}
		oSettings.tBodyElement = tbody[0];

		var tfoot = $this.children('tfoot');
		if (tfoot.length === 0) {
			// If we are a scrolling table, and no footer has been given, then we need to create
			// a tfoot element for the caption element to be appended to
			tfoot = $('<tfoot/>').appendTo($this);
		}
		oSettings.tFootElement = tfoot[0];
		$('tr', tfoot).addClass(oClasses.tfoot.row);

		// Copy the data index array
		oSettings.display = oSettings.displayMaster.slice();

		// Initialisation complete - table can be drawn
		oSettings.initialized = true;

		// Language definitions
		var language = oSettings.language;
		$.extend(true, language, oInit.language);

		_fnCallbackFire(oSettings, null, 'i18n', [oSettings], true);
		_fnInitialise(oSettings);
	});
	_that = null;
	return this;
}
// #endregion

// #region ext.js

/**
 * DataTables extensions
 * 
 * This namespace acts as a collection area for plug-ins that can be used to
 * extend DataTables capabilities. Indeed many of the build in methods
 * use this method to provide their own capabilities (sorting methods for
 * example).
 *
 * Note that this namespace is aliased to `jQuery.fn.dataTableExt` for legacy
 * reasons
 *
 *  @namespace
 */
DataTable.ext = _ext = {
	/**
	 * Element class names
	 *
	 *  @type object
	 *  @default {}
	 */
	classes: {},


	/**
	 * Error reporting.
	 * 
	 * How should DataTables report an error. Can take the value 'alert',
	 * 'throw', 'none' or a function.
	 *
	 *  @type string|function
	 *  @default alert
	 */
	errMode: "alert",


	/**
	 * Legacy so v1 plug-ins don't throw js errors on load
	 */
	feature: [],

	/**
	 * Feature plug-ins.
	 * 
	 * This is an object of callbacks which provide the features for DataTables
	 * to be initialised via the `layout` option.
	 */
	features: {},


	/**
	 * Row searching.
	 * 
	 * This method of searching is complimentary to the default type based
	 * searching, and a lot more comprehensive as it allows you complete control
	 * over the searching logic. Each element in this array is a function
	 * (parameters described below) that is called for every row in the table,
	 * and your logic decides if it should be included in the searching data set
	 * or not.
	 *
	 * Searching functions have the following input parameters:
	 *
	 * 1. `{object}` DataTables settings object: see
	 *    {@link DataTable.models.oSettings}
	 * 2. `{array|object}` Data for the row to be processed (same as the
	 *    original format that was passed in as the data source, or an array
	 *    from a DOM data source
	 * 3. `{int}` Row index ({@link DataTable.models.oSettings.data}), which
	 *    can be useful to retrieve the `TR` element if you need DOM interaction.
	 *
	 * And the following return is expected:
	 *
	 * * {boolean} Include the row in the searched result set (true) or not
	 *   (false)
	 *
	 * Note that as with the main search ability in DataTables, technically this
	 * is "filtering", since it is subtractive. However, for consistency in
	 * naming we call it searching here.
	 *
	 *  @type array
	 *  @default []
	 *
	 *  @example
	 *    // The following example shows custom search being applied to the
	 *    // fourth column (i.e. the data[3] index) based on two input values
	 *    // from the end-user, matching the data in a certain range.
	 *    $.fn.dataTable.ext.search.push(
	 *      function( settings, data, dataIndex ) {
	 *        var min = document.getElementById('min').value * 1;
	 *        var max = document.getElementById('max').value * 1;
	 *        var version = data[3] == "-" ? 0 : data[3]*1;
	 *
	 *        if ( min == "" && max == "" ) {
	 *          return true;
	 *        }
	 *        else if ( min == "" && version < max ) {
	 *          return true;
	 *        }
	 *        else if ( min < version && "" == max ) {
	 *          return true;
	 *        }
	 *        else if ( min < version && version < max ) {
	 *          return true;
	 *        }
	 *        return false;
	 *      }
	 *    );
	 */
	search: [],


	/**
	 * Selector extensions
	 *
	 * The `selector` option can be used to extend the options available for the
	 * selector modifier options (`selector-modifier` object data type) that
	 * each of the three built in selector types offer (row, column and cell +
	 * their plural counterparts). For example the Select extension uses this
	 * mechanism to provide an option to select only rows, columns and cells
	 * that have been marked as selected by the end user (`{selected: true}`),
	 * which can be used in conjunction with the existing built in selector
	 * options.
	 *
	 * Each property is an array to which functions can be pushed. The functions
	 * take three attributes:
	 *
	 * * Settings object for the host table
	 * * Options object (`selector-modifier` object type)
	 * * Array of selected item indexes
	 *
	 * The return is an array of the resulting item indexes after the custom
	 * selector has been applied.
	 *
	 *  @type object
	 */
	selector: {
		cell: [],
		column: [],
		row: []
	},


	/**
	 * Legacy configuration options. Enable and disable legacy options that
	 * are available in DataTables.
	 *
	 *  @type object
	 */
	legacy: {
		/**
		 * Enable / disable DataTables 1.9 compatible server-side processing
		 * requests
		 *
		 *  @type boolean
		 *  @default null
		 */
		ajax: null
	},


	/**
	 * Pagination plug-in methods.
	 * 
	 * Each entry in this object is a function and defines which buttons should
	 * be shown by the pagination rendering method that is used for the table:
	 * {@link DataTable.ext.renderer.pageButton}. The renderer addresses how the
	 * buttons are displayed in the document, while the functions here tell it
	 * what buttons to display. This is done by returning an array of button
	 * descriptions (what each button will do).
	 *
	 * Pagination types (the four built in options and any additional plug-in
	 * options defined here) can be used through the `paginationType`
	 * initialisation parameter.
	 *
	 * The functions defined take two parameters:
	 *
	 * 1. `{int} page` The current page index
	 * 2. `{int} pages` The number of pages in the table
	 *
	 * Each function is expected to return an array where each element of the
	 * array can be one of:
	 *
	 * * `first` - Jump to first page when activated
	 * * `last` - Jump to last page when activated
	 * * `previous` - Show previous page when activated
	 * * `next` - Show next page when activated
	 * * `{int}` - Show page of the index given
	 * * `{array}` - A nested array containing the above elements to add a
	 *   containing 'DIV' element (might be useful for styling).
	 *
	 * Note that DataTables v1.9- used this object slightly differently whereby
	 * an object with two functions would be defined for each plug-in. That
	 * ability is still supported by DataTables 1.10+ to provide backwards
	 * compatibility, but this option of use is now decremented and no longer
	 * documented in DataTables 1.10+.
	 *
	 *  @type object
	 *  @default {}
	 *
	 *  @example
	 *    // Show previous, next and current page buttons only
	 *    $.fn.dataTableExt.oPagination.current = function ( page, pages ) {
	 *      return [ 'previous', page, 'next' ];
	 *    };
	 */
	pager: {},


	renderer: {
		pageButton: {},
		header: {}
	},


	/**
	 * Ordering plug-ins - custom data source
	 * 
	 * The extension options for ordering of data available here is complimentary
	 * to the default type based ordering that DataTables typically uses. It
	 * allows much greater control over the the data that is being used to
	 * order a column, but is necessarily therefore more complex.
	 * 
	 * This type of ordering is useful if you want to do ordering based on data
	 * live from the DOM (for example the contents of an 'input' element) rather
	 * than just the static string that DataTables knows of.
	 * 
	 * The way these plug-ins work is that you create an array of the values you
	 * wish to be ordering for the column in question and then return that
	 * array. The data in the array much be in the index order of the rows in
	 * the table (not the currently ordering order!). Which order data gathering
	 * function is run here depends on the `dt-init columns.orderDataType`
	 * parameter that is used for the column (if any).
	 *
	 * The functions defined take two parameters:
	 *
	 * 1. `{object}` DataTables settings object: see
	 *    {@link DataTable.models.oSettings}
	 * 2. `{int}` Target column index
	 *
	 * Each function is expected to return an array:
	 *
	 * * `{array}` Data for the column to be ordering upon
	 *
	 *  @type array
	 *
	 *  @example
	 *    // Ordering using `input` node values
	 *    $.fn.dataTable.ext.order['dom-text'] = function  ( settings, col )
	 *    {
	 *      return this.api().column( col, {order:'index'} ).nodes().map( function ( td, i ) {
	 *        return $('input', td).val();
	 *      } );
	 *    }
	 */
	order: {},


	/**
	 * Type based plug-ins.
	 *
	 * Each column in DataTables has a type assigned to it, either by automatic
	 * detection or by direct assignment using the `type` option for the column.
	 * The type of a column will effect how it is ordering and search (plug-ins
	 * can also make use of the column type if required).
	 *
	 * @namespace
	 */
	type: {
		/**
		 * Automatic column class assignment
		 */
		className: {},

		/**
		 * Type detection functions.
		 *
		 * The functions defined in this object are used to automatically detect
		 * a column's type, making initialisation of DataTables super easy, even
		 * when complex data is in the table.
		 *
		 * The functions defined take two parameters:
		 *
		 *  1. `{*}` Data from the column cell to be analysed
		 *  2. `{settings}` DataTables settings object. This can be used to
		 *     perform context specific type detection - for example detection
		 *     based on language settings such as using a comma for a decimal
		 *     place. Generally speaking the options from the settings will not
		 *     be required
		 *
		 * Each function is expected to return:
		 *
		 * * `{string|null}` Data type detected, or null if unknown (and thus
		 *   pass it on to the other type detection functions.
		 *
		 *  @type array
		 *
		 *  @example
		 *    // Currency type detection plug-in:
		 *    $.fn.dataTable.ext.type.detect.push(
		 *      function ( data, settings ) {
		 *        // Check the numeric part
		 *        if ( ! data.substring(1).match(/[0-9]/) ) {
		 *          return null;
		 *        }
		 *
		 *        // Check prefixed by currency
		 *        if ( data.charAt(0) == '$' || data.charAt(0) == '&pound;' ) {
		 *          return 'currency';
		 *        }
		 *        return null;
		 *      }
		 *    );
		 */
		detect: [],

		/**
		 * Automatic renderer assignment
		 */
		render: {},


		/**
		 * Type based search formatting.
		 *
		 * The type based searching functions can be used to pre-format the
		 * data to be search on. For example, it can be used to strip HTML
		 * tags or to de-format telephone numbers for numeric only searching.
		 *
		 * Note that is a search is not defined for a column of a given type,
		 * no search formatting will be performed.
		 * 
		 * Pre-processing of searching data plug-ins - When you assign the sType
		 * for a column (or have it automatically detected for you by DataTables
		 * or a type detection plug-in), you will typically be using this for
		 * custom sorting, but it can also be used to provide custom searching
		 * by allowing you to pre-processing the data and returning the data in
		 * the format that should be searched upon. This is done by adding
		 * functions this object with a parameter name which matches the sType
		 * for that target column. This is the corollary of <i>afnSortData</i>
		 * for searching data.
		 *
		 * The functions defined take a single parameter:
		 *
		 *  1. `{*}` Data from the column cell to be prepared for searching
		 *
		 * Each function is expected to return:
		 *
		 * * `{string|null}` Formatted string that will be used for the searching.
		 *
		 *  @type object
		 *  @default {}
		 *
		 *  @example
		 *    $.fn.dataTable.ext.type.search['title-numeric'] = function ( d ) {
		 *      return d.replace(/\n/g," ").replace( /<.*?>/g, "" );
		 *    }
		 */
		search: {},


		/**
		 * Type based ordering.
		 *
		 * The column type tells DataTables what ordering to apply to the table
		 * when a column is sorted upon. The order for each type that is defined,
		 * is defined by the functions available in this object.
		 *
		 * Each ordering option can be described by three properties added to
		 * this object:
		 *
		 * * `{type}-pre` - Pre-formatting function
		 * * `{type}-asc` - Ascending order function
		 * * `{type}-desc` - Descending order function
		 *
		 * All three can be used together, only `{type}-pre` or only
		 * `{type}-asc` and `{type}-desc` together. It is generally recommended
		 * that only `{type}-pre` is used, as this provides the optimal
		 * implementation in terms of speed, although the others are provided
		 * for compatibility with existing Javascript sort functions.
		 *
		 * `{type}-pre`: Functions defined take a single parameter:
		 *
		 *  1. `{*}` Data from the column cell to be prepared for ordering
		 *
		 * And return:
		 *
		 * * `{*}` Data to be sorted upon
		 *
		 * `{type}-asc` and `{type}-desc`: Functions are typical Javascript sort
		 * functions, taking two parameters:
		 *
		 *  1. `{*}` Data to compare to the second parameter
		 *  2. `{*}` Data to compare to the first parameter
		 *
		 * And returning:
		 *
		 * * `{*}` Ordering match: <0 if first parameter should be sorted lower
		 *   than the second parameter, ===0 if the two parameters are equal and
		 *   >0 if the first parameter should be sorted height than the second
		 *   parameter.
		 * 
		 *  @type object
		 *  @default {}
		 *
		 *  @example
		 *    // Numeric ordering of formatted numbers with a pre-formatter
		 *    $.extend( $.fn.dataTable.ext.type.order, {
		 *      "string-pre": function(x) {
		 *        a = (a === "-" || a === "") ? 0 : a.replace( /[^\d\-\.]/g, "" );
		 *        return parseFloat( a );
		 *      }
		 *    } );
		 *
		 *  @example
		 *    // Case-sensitive string ordering, with no pre-formatting method
		 *    $.extend( $.fn.dataTable.ext.order, {
		 *      "string-case-asc": function(x,y) {
		 *        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
		 *      },
		 *      "string-case-desc": function(x,y) {
		 *        return ((x < y) ? 1 : ((x > y) ? -1 : 0));
		 *      }
		 *    } );
		 */
		order: {}
	},

	/**
	 * Unique DataTables instance counter
	 *
	 * @type int
	 * @private
	 */
	_unique: 0,
};


//
// Backwards compatibility. Alias to pre 1.10 Hungarian notation counter parts
//
$.extend(_ext, {
	afnFiltering: _ext.search,
	aTypes: _ext.type.detect,
	ofnSearch: _ext.type.search,
	oSort: _ext.type.order,
	afnSortData: _ext.order,
	oStdClasses: _ext.classes,
	oPagination: _ext.pager
});


// #endregion
// #region ext.classes.js

$.extend(DataTable.ext.classes, {
	container: 'dt-container',
	empty: {
		row: 'dt-empty'
	},
	info: {
		container: 'dt-info'
	},
	layout: {
		row: 'dt-layout-row',
		cell: 'dt-layout-cell',
		tableRow: 'dt-layout-table',
		tableCell: '',
		start: 'dt-layout-start',
		end: 'dt-layout-end',
		full: 'dt-layout-full'
	},
	length: {
		container: 'dt-length',
		select: 'dt-input'
	},
	order: {
		canAsc: 'dt-orderable-asc',
		canDesc: 'dt-orderable-desc',
		isAsc: 'dt-ordering-asc',
		isDesc: 'dt-ordering-desc',
		none: 'dt-orderable-none',
		position: 'sorting_'
	},
	processing: {
		container: 'dt-processing'
	},
	scrolling: {
		body: 'dt-scroll-body',
		container: 'dt-scroll',
		footer: {
			self: 'dt-scroll-foot',
			inner: 'dt-scroll-footInner'
		},
		header: {
			self: 'dt-scroll-head',
			inner: 'dt-scroll-headInner'
		}
	},
	search: {
		container: 'dt-search',
		input: 'dt-input'
	},
	table: 'dataTable',
	tbody: {
		cell: '',
		row: ''
	},
	thead: {
		cell: '',
		row: ''
	},
	tfoot: {
		cell: '',
		row: ''
	},
	paging: {
		active: 'current',
		button: 'dt-paging-button',
		container: 'dt-paging',
		disabled: 'disabled',
		nav: ''
	}
});

// #endregion

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

var _re_new_lines = /[\r\n\u2028]/g;
var _re_html = /<([^>]*>)/g;
var _max_str_len = Math.pow(2, 28);

// Escape regular expression special characters
var _re_escape_regex = new RegExp('(\\' + ['/', '.', '*', '+', '?', '|', '(', ')', '[', ']', '{', '}', '\\', '$', '^', '-'].join('|\\') + ')', 'g');

var _empty = function (d) {
	return !d || d === true || d === '-' ? true : false;
};


var _intVal = function (s) {
	var integer = parseInt(s, 10);
	return !isNaN(integer) && isFinite(s) ? integer : null;
};

var _pluck = function (a, prop, prop2) {
	var out = [];
	var i = 0, ien = a.length;

	// Could have the test in the loop for slightly smaller code, but speed
	// is essential here
	if (prop2 !== undefined) {
		for (; i < ien; i++) {
			if (a[i] && a[i][prop]) {
				out.push(a[i][prop][prop2]);
			}
		}
	}
	else {
		for (; i < ien; i++) {
			if (a[i]) {
				out.push(a[i][prop]);
			}
		}
	}

	return out;
};

var _range = function (len, start) {
	var out = [];
	var end;

	if (start === undefined) {
		start = 0;
		end = len;
	}
	else {
		end = start;
		start = len;
	}

	for (var i = start; i < end; i++) {
		out.push(i);
	}

	return out;
};

// Replaceable function in api.util
var _stripHtml = function (input) {
	if (!input || typeof input !== 'string') {
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

// Remove diacritics from a string by decomposing it and then removing
// non-ascii characters
var _normalize = function (str) {
	if (typeof str !== 'string') {
		return str;
	}

	// It is faster to just run `normalize` than it is to check if
	// we need to with a regex!
	var res = str.normalize("NFD");

	// Equally, here we check if a regex is needed or not
	return res.length !== str.length
		? res.replace(/[\u0300-\u036f]/g, "")
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
var _areAllUnique = function (src) {
	if (src.length < 2) {
		return true;
	}

	var sorted = src.slice().sort();
	var last = sorted[0];

	for (var i = 1, ien = sorted.length; i < ien; i++) {
		if (sorted[i] === last) {
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
var _unique = function (src) {
	if (Array.from && Set) {
		return Array.from(new Set(src));
	}

	if (_areAllUnique(src)) {
		return src.slice();
	}

	// A faster unique method is to use object keys to identify used values,
	// but this doesn't work with arrays or objects, which we must also
	// consider. See jsperf.app/compare-array-unique-versions/4 for more
	// information.
	var
		out = [],
		val,
		i, ien = src.length,
		j, k = 0;

	again: for (i = 0; i < ien; i++) {
		val = src[i];

		for (j = 0; j < k; j++) {
			if (out[j] === val) {
				continue again;
			}
		}

		out.push(val);
		k++;
	}

	return out;
};

// Surprisingly this is faster than [].concat.apply
// https://jsperf.com/flatten-an-array-loop-vs-reduce/2
var _flatten = function (out, val) {
	if (Array.isArray(val)) {
		for (var i = 0; i < val.length; i++) {
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

/**
* When rendering large numbers in the information element for the table
* (i.e. "Showing 1 to 10 of 57 entries") DataTables will render large numbers
* to have a comma separator for the 'thousands' units (e.g. 1 million is
* rendered as "1,000,000") to help readability for the end user. This
* function will override the default method DataTables uses.
*/
function _formatNumber(toFormat) {
	return toFormat.toString().replace(
		/\B(?=(\d{3})+(?!\d))/g,
		","
	);
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
	 * Throttle the calls to a function. Arguments and context are maintained
	 * for the throttled function.
	 *
	 * @param {function} fn Function to be called
	 * @param {integer} freq Call frequency in mS
	 * @return {function} Wrapped function
	 */
	throttle: function (fn) {
		var
			frequency = 200,
			last,
			timer;

		return function () {
			var
				that = this,
				now = +new Date(),
				args = arguments;

			if (last && now < last + frequency) {
				clearTimeout(timer);

				timer = setTimeout(function () {
					last = undefined;
					fn.apply(that, args);
				}, frequency);
			}
			else {
				last = now;
				fn.apply(that, args);
			}
		};
	},

	/**
	 * Escape a string such that it can be used in a regular expression
	 *
	 *  @param {string} val string to escape
	 *  @returns {string} escaped string
	 */
	escapeRegex: function (val) {
		return val.replace(_re_escape_regex, '\\$1');
	},

	/**
	 * Create a function that will write to a nested object or array
	 * @param {*} source JSON notation string
	 * @returns Write function
	 */
	set: function (source) {
		if ($.isPlainObject(source)) {
			/* Unlike get, only the underscore (global) option is used for for
			 * setting data since we don't know the type here. This is why an object
			 * option is not documented for `mData` (which is read/write), but it is
			 * for `mRender` which is read only.
			 */
			return DataTable.util.set(source._);
		}
		else if (source === null) {
			// Nothing to do when the data source is null
			return function () { };
		}
		else if (typeof source === 'function') {
			return function (data, val, meta) {
				source(data, 'set', val, meta);
			};
		}
		else if (
			typeof source === 'string' && (source.indexOf('.') !== -1 ||
				source.indexOf('[') !== -1 || source.indexOf('(') !== -1)
		) {
			// Like the get, we need to get data from a nested object
			var setData = function (data, val, src) {
				var a = _fnSplitObjNotation(src), b;
				var aLast = a[a.length - 1];
				var arrayNotation, funcNotation, o, innerSrc;

				for (var i = 0, iLen = a.length - 1; i < iLen; i++) {
					// Protect against prototype pollution
					if (a[i] === '__proto__' || a[i] === 'constructor') {
						throw new Error('Cannot set prototype values');
					}

					// Check if we are dealing with an array notation request
					arrayNotation = a[i].match(__reArray);
					funcNotation = a[i].match(__reFn);

					if (arrayNotation) {
						a[i] = a[i].replace(__reArray, '');
						data[a[i]] = [];

						// Get the remainder of the nested object to set so we can recurse
						b = a.slice();
						b.splice(0, i + 1);
						innerSrc = b.join('.');

						// Traverse each entry in the array setting the properties requested
						if (Array.isArray(val)) {
							for (var j = 0, jLen = val.length; j < jLen; j++) {
								o = {};
								setData(o, val[j], innerSrc);
								data[a[i]].push(o);
							}
						}
						else {
							// We've been asked to save data to an array, but it
							// isn't array data to be saved. Best that can be done
							// is to just save the value.
							data[a[i]] = val;
						}

						// The inner call to setData has already traversed through the remainder
						// of the source and has set the data, thus we can exit here
						return;
					}
					else if (funcNotation) {
						// Function call
						a[i] = a[i].replace(__reFn, '');
						data = data[a[i]](val);
					}

					// If the nested object doesn't currently exist - since we are
					// trying to set the value - create it
					if (data[a[i]] === null || data[a[i]] === undefined) {
						data[a[i]] = {};
					}
					data = data[a[i]];
				}

				// Last item in the input - i.e, the actual set
				if (aLast.match(__reFn)) {
					// Function call
					data = data[aLast.replace(__reFn, '')](val);
				}
				else {
					// If array notation is used, we just want to strip it and use the property name
					// and assign the value. If it isn't used, then we get the result we want anyway
					data[aLast.replace(__reArray, '')] = val;
				}
			};

			return function (data, val) { // meta is also passed in, but not used
				return setData(data, val, source);
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
	get: function (source) {
		if ($.isPlainObject(source)) {
			// Build an object of get functions, and wrap them in a single call
			var o = {};
			$.each(source, function (key, val) {
				if (val) {
					o[key] = DataTable.util.get(val);
				}
			});

			return function (data, type, row, meta) {
				var t = o[type] || o._;
				return t !== undefined ?
					t(data, type, row, meta) :
					data;
			};
		}
		else if (source === null) {
			// Give an empty string for rendering / sorting etc
			return function (data) { // type, row and meta also passed, but not used
				return data;
			};
		}
		else if (typeof source === 'function') {
			return function (data, type, row, meta) {
				return source(data, type, row, meta);
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

				if (src !== "") {
					var a = _fnSplitObjNotation(src);

					for (var i = 0, iLen = a.length; i < iLen; i++) {
						// Check if we are dealing with special notation
						arrayNotation = a[i].match(__reArray);
						funcNotation = a[i].match(__reFn);

						if (arrayNotation) {
							// Array notation
							a[i] = a[i].replace(__reArray, '');

							// Condition allows simply [] to be passed in
							if (a[i] !== "") {
								data = data[a[i]];
							}
							out = [];

							// Get the remainder of the nested object to get
							a.splice(0, i + 1);
							innerSrc = a.join('.');

							// Traverse each entry in the array getting the properties requested
							if (Array.isArray(data)) {
								for (var j = 0, jLen = data.length; j < jLen; j++) {
									out.push(fetchData(data[j], type, innerSrc));
								}
							}

							// If a string is given in between the array notation indicators, that
							// is used to join the strings together, otherwise an array is returned
							var join = arrayNotation[0].substring(1, arrayNotation[0].length - 1);
							data = (join === "") ? out : out.join(join);

							// The inner call to fetchData has already traversed through the remainder
							// of the source requested, so we exit from the loop
							break;
						}
						else if (funcNotation) {
							// Function call
							a[i] = a[i].replace(__reFn, '');
							data = data[a[i]]();
							continue;
						}

						if (data === null || data[a[i]] === null) {
							return null;
						}
						else if (data === undefined || data[a[i]] === undefined) {
							return undefined;
						}

						data = data[a[i]];
					}
				}

				return data;
			};

			return function (data, type) { // row and meta also passed, but not used
				return fetchData(data, type, source);
			};
		}
		else {
			// Array or flat object mapping
			return function (data) { // row and meta also passed, but not used
				return data[source];
			};
		}
	}
};

// #endregion
// #region core.columns.js

/**
 * Add a column to the list used for the table with default values
 *  @param {object} oSettings dataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnAddColumn(oSettings) {
	// Add column to columns array
	var oDefaults = DataTable.defaults.column;
	var iCol = oSettings.columns.length;
	var oCol = $.extend({}, DataTable.models.oColumn, oDefaults, {
		data: iCol,
		idx: iCol,
		colEl: $('<col>').attr('data-dt-column', iCol)
	});
	oSettings.columns.push(oCol);
}


/**
 * Apply options for a column
 *  @param {object} oSettings dataTables settings object
 *  @param {int} iCol column index to consider
 *  @param {object} oOptions object with sType, bVisible and searchable etc
 *  @memberof DataTable#oApi
 */
function _fnColumnOptions(oSettings, iCol) {
	var oCol = oSettings.columns[iCol];

	/* Cache the data get and set functions for speed */
	var mDataSrc = oCol.data;
	var mData = _fnGetObjectDataFn(mDataSrc);

	oCol._render = null;
	oCol._setter = null;

	oCol.getData = function (rowData, type, meta) {
		var innerData = mData(rowData, type, undefined, meta);

		return oCol._render && type ?
			oCol._render(innerData, type, rowData, meta) :
			innerData;
	};

	/* Feature sorting overrides column specific when off */
	if (!oSettings.features.ordering) {
		oCol.orderable = false;
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

	_fnCallbackFire(settings, null, 'column-sizing', [settings]);
}

/**
 * Apply column sizes
 *
 * @param {*} settings DataTables settings object
 */
function _fnColumnSizes(settings) {
	var cols = settings.columns;

	for (var i = 0; i < cols.length; i++) {
		var width = _fnColumnsSumWidth(settings, [i], false);

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
	var aiVis = oSettings.columns.map((_, i) => i);

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
	var aiVis = oSettings.columns.map((_, i) => i);
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
	var layout = settings.header;
	var vis = 0;

	if (layout.length) {
		for (var i = 0, ien = layout[0].length; i < ien; i++) {
			if ($(layout[0][i].cell).css('display') !== 'none') {
				vis++;
			}
		}
	}

	return vis;
}

/**
 * Take the column definitions and static columns arrays and calculate how
 * they relate to column indexes. The callback function will then apply the
 * definition found for a column to a suitable configuration object.
 *  @param {object} oSettings dataTables settings object
 *  @param {array} aoCols The columns array that defines columns individually
 *  @param {function} fn Callback function - takes two parameters, the calculated
 *    column index and the definition for that column.
 *  @memberof DataTable#oApi
 */
function _fnApplyColumnDefs(aoCols, fn) {
	// Statically defined columns array
	if (aoCols) {
		for (let i = 0; i < aoCols.length; i++) {
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
function _fnColumnsSumWidth(settings, targets, original) {
	if (!Array.isArray(targets)) {
		targets = _fnColumnsFromHeader(targets);
	}

	var sum = 0;
	var unit;
	var columns = settings.columns;

	for (var i = 0, ien = targets.length; i < ien; i++) {
		var column = columns[targets[i]];
		var definedWidth = original ?
			column.originalWidth :
			column.width;

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
 *  @returns {int} >=0 if successful (index of new data entry), -1 if failed
 *  @memberof DataTable#oApi
 */
function _fnAddData(settings, dataIn, tr, tds) {
	/* Create the object for storing information about this new row */
	var rowIdx = settings.data.length;
	var rowModel = $.extend(true, {}, DataTable.models.oRow, {
		idx: rowIdx
	});

	rowModel._aData = dataIn;
	settings.data.push(rowModel);

	/* Add to the display array */
	settings.displayMaster.push(rowIdx);

	/* Create the DOM information, or register it if already present */
	if (tr) {
		_fnCreateTr(settings, rowIdx, tr, tds);
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
function _fnAddTr(settings, trs) {
	return trs.map(function (el) {
		const row = _fnGetRowElements(settings, el);
		return _fnAddData(settings, row.data, el, row.cells);
	});
}


/**
 * Get the data for a given cell from the internal cache, taking into account data mapping
 *  @param {object} settings dataTables settings object
 *  @param {int} rowIdx data row id
 *  @param {int} colIdx Column index
 *  @param {string} type data get type ('display', 'type' 'filter|search' 'sort|order')
 *  @returns {*} Cell data
 *  @memberof DataTable#oApi
 */
function _fnGetCellData(settings, rowIdx, colIdx, type) {
	if (type === 'search') {
		type = 'filter';
	}
	else if (type === 'order') {
		type = 'sort';
	}

	var row = settings.data[rowIdx];

	if (!row) {
		return undefined;
	}

	var draw = settings.drawCounter;
	var col = settings.columns[colIdx];
	var rowData = row._aData;
	var cellData = col.getData(rowData, type, {
		settings: settings,
		row: rowIdx,
		col: colIdx
	});

	// Allow for a node being returned for non-display types
	if (type !== 'display' && cellData && typeof cellData === 'object' && cellData.nodeName) {
		cellData = cellData.innerHTML;
	}

	if (cellData === undefined) {
		if (settings.drawError != draw) {
			_fnLog(settings, 0, "Requested unknown parameter " +
				(typeof col.data == 'function' ? '{function}' : "'" + col.data + "'") +
				" for row " + rowIdx + ", column " + colIdx, 4);
			settings.drawError = draw;
		}
		return null;
	}

	// When the data source is null and a specific data type is requested (i.e.
	// not the original data), we can use default column data
	if (typeof cellData === 'function') {
		// If the data source is a function, then we run it and use the return,
		// executing in the scope of the data object (for instances)
		return cellData.call(rowData);
	}

	if (cellData === null && type === 'display') {
		return '';
	}

	if (type === 'filter') {
		var fomatters = DataTable.ext.type.search;

		cellData = fomatters['string'](cellData);
	}

	return cellData;
}

/**
 * Write a value to a cell
 * @param {*} td Cell
 * @param {*} val Value
 */
function _fnWriteCell(td, val) {
	if (val && typeof val === 'object' && val.nodeName) {
		td.innerHTML = '';
		td.appendChild(val);
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
function _fnSplitObjNotation(str) {
	var parts = str.match(/(\\.|[^.])+/g) || [''];

	return parts.map(function (s) {
		return s.replace(/\\\./g, '.');
	});
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
function _fnGetRowElements(settings, row) {
	var
		tds = [],
		td = row.firstChild,
		name, col, i = 0, contents,
		columns = settings.columns,
		objectRead = settings._rowReadObject;

	// Allow the data object to be passed in, or construct
	var d = objectRead ? {} : [];

	// Read data from a cell and store into the data object
	var cellProcess = function (cell) {
		col = columns[i];
		contents = (cell.innerHTML).trim();

		// Depending on the `data` option for the columns the data can
		// be read to either an object or an array.
		if (objectRead) {
			if (!col._setter) {
				// Cache the setter function
				col._setter = _fnSetObjectDataFn(col.data);
			}
			col._setter(d, contents);
		}
		else {
			d[i] = contents;
		}

		i++;
	};

	if (td) {
		// `tr` element was passed in
		while (td) {
			name = td.nodeName.toUpperCase();

			if (name == "TD" || name == "TH") {
				cellProcess(td);
				tds.push(td);
			}

			td = td.nextSibling;
		}
	}
	else {
		// Existing row object passed in
		tds = row.anCells;

		for (var j = 0, jen = tds.length; j < jen; j++) {
			cellProcess(tds[j]);
		}
	}

	// Read the ID from the DOM if present
	var rowNode = row.firstChild ? row : row.nTr;

	if (rowNode) {
		var id = rowNode.getAttribute('id');

		if (id) {
			_fnSetObjectDataFn(settings.rowId)(d, id);
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
	let rowModal = settings.data[rowIdx];
	let columns = settings.columns;

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
function _fnCreateTr(oSettings, iRow, nTr, anTds) {
	var
		row = oSettings.data[iRow],
		cells = [],
		nTd;

	if (row.nTr !== null) {
		return;
	}

	row.nTr = nTr;
	row.anCells = cells;

	/* Use a private property on the node to allow reserve mapping from the node
	 * to the data array for fast look up
	 */
	nTr._DT_RowIndex = iRow;

	/* Special parameters can be given by the data source to be used on the row */
	_fnRowAttributes(oSettings, row);

	/* Process each column */
	for (let i = 0; i < oSettings.columns.length; i++) {
		nTd = anTds[i];

		if (!nTd) {
			_fnLog(oSettings, 0, 'Incorrect column count', 18);
		}

		nTd._DT_CellIndex = {
			row: iRow,
			column: i
		};

		cells.push(nTd);
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

	if (!tr) {
		return;
	}

	var data = row._aData;
	var id = settings.getRowId(data);

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


/**
 * Create the HTML header for the table
 *  @param {object} oSettings dataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnBuildHead(settings, side) {
	var classes = DataTable.ext.classes;
	var columns = settings.columns;
	var row;
	var target = side === 'header'
		? settings.tHeadElement
		: settings.tFootElement;
	var titleProp = side === 'header' ? 'title' : side;

	// Footer might be defined
	if (!target) {
		return;
	}

	// If no cells yet and we have content for them, then create
	if (side === 'header' || _pluck(settings.columns, titleProp).join('')) {
		row = $('tr', target);

		// Add a row if needed
		if (!row.length) {
			row = $('<tr/>').appendTo(target)
		}

		// Add the number of cells needed to make up to the number of columns
		if (row.length === 1) {
			var cells = $('td, th', row);

			for (let i = cells.length; i < columns.length; i++) {
				$('<th/>')
					.html(columns[i][titleProp] || '')
					.appendTo(row);
			}
		}
	}

	var detected = _fnDetectHeader(settings, target, true);

	if (side === 'header') {
		settings.header = detected;
	}
	else {
		settings.footer = detected;
	}

	// ARIA role for the rows
	$(target).children('tr').attr('role', 'row');

	// Every cell needs to be passed through the renderer
	$(target).children('tr').children('th, td')
		.each(function () {
			_fnRenderer(side)(settings, $(this), classes);
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
function _fnHeaderLayout(settings, source) {
	var cell;
	var local = [];
	var structure = [];
	var columns = settings.columns;
	var columnCount = columns.length;
	var rowspan, colspan;

	if (!source) {
		return;
	}

	// Default is to work on only visible columns
	var incColumns = _range(columnCount);

	// Make a copy of the master layout array, but with only the columns we want
	for (let row = 0; row < source.length; row++) {
		// Remove any columns we haven't selected
		local[row] = source[row].slice().filter(function (cell, i) {
			return incColumns.includes(i);
		});

		// Prep the structure array - it needs an element for each row
		structure.push([]);
	}

	for (let row = 0; row < local.length; row++) {
		for (let column = 0; column < local[row].length; column++) {
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
 *  @memberof DataTable#oApi
 */
function _fnDraw(oSettings) {
	// Allow for state saving and a custom start position
	_fnStart(oSettings);

	/* Provide a pre-callback function which can be used to cancel the draw is false is returned */

	var anRows = [];
	var iRowCount = 0;
	var display = oSettings.display;
	var iDisplayStart = oSettings._displayStart;
	var iDisplayEnd = oSettings.displayEnd();
	var columns = oSettings.columns;
	var body = $(oSettings.tBodyElement);

	oSettings.drawing = true;

	/* Server-side processing draw intercept */
	oSettings.drawCounter++;

	if (display.length !== 0) {
		var iStart = iDisplayStart;
		var iEnd = iDisplayEnd;

		for (var j = iStart; j < iEnd; j++) {
			var iDataIndex = display[j];
			var data = oSettings.data[iDataIndex];

			var nRow = data.nTr;

			// Add various classes as needed
			for (var i = 0; i < columns.length; i++) {
				var col = columns[i];
				var td = data.anCells[i];

				_addClass(td, _ext.type.className['string']); // auto class
			}

			anRows.push(nRow);
			iRowCount++;
		}
	}
	else {
		anRows[0] = _emptyRow(oSettings);
	}

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
	$(oSettings.wrapperElement).toggleClass('dt-empty-footer', $('tr', oSettings.tFootElement).length === 0);

	/* Call all required callback functions for the end of a draw */
	_fnCallbackFire(oSettings, 'drawCallbacks', 'draw', [oSettings], true);

	oSettings.drawing = false;
}


/**
 * Redraw the table - taking account of the various features which are enabled
 *  @param {object} oSettings dataTables settings object
 *  @param {boolean} [holdPosition] Keep the current paging position. By default
 *    the paging is reset to the first page
 *  @memberof DataTable#oApi
 */
function _fnReDraw(settings, recompute) {
	var features = settings.features,
		sort = features.ordering,
		filter = features.searching;

	if (recompute === undefined || recompute === true) {

		if (sort) {
			_fnSort(settings);
		}

		if (filter) {
			_fnFilterComplete(settings, settings.searchText);
		}
		else {
			// No filtering, so we want to just use the display master
			settings.display = settings.displayMaster.slice();
		}
	}

	settings._displayStart = 0;

	_fnDraw(settings);
}

/*
 * Table is empty - create a row with an empty message in it
 */
function _emptyRow(settings) {
	var oLang = settings.language;
	var zero = oLang.sZeroRecords;

	if (oLang.sEmptyTable && settings.total() === 0) {
		zero = oLang.sEmptyTable;
	}

	return $('<tr/>')
		.append($('<td />', {
			'colSpan': _fnVisbleColumns(settings),
			'class': 'dt-empty'
		}).html(zero))[0];
}

/**
 * Add the options to the page HTML for the table
 *  @param {object} settings DataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnAddOptionsHtml(settings) {
	var table = settings.tableElement;

	// Wrapper div around everything DataTables controls
	var insert = document.createElement('div');
	insert.id = settings.tableId + '_wrapper';
	insert.className = 'dt-container';
	table.parentNode.insertBefore(insert, table);

	settings.wrapperElement = insert;

	var getFeature = function (feature, opts) {
		if (!_ext.features[feature]) {
			_fnLog(settings, 0, 'Unknown feature: ' + feature);
		}

		return _ext.features[feature].apply(this, [settings, opts]);
	};

	//var top = _layoutArray(settings, 'top');
	var top = {
		start: {
			contents: [ getFeature('pageLength', null), ]
		},
		end: {
			contents: [ getFeature('search', null) ]
		}
	};

	var bottom = {
		start: {
			contents: [ getFeature('info', null), ]
		},
		end: {
			contents: [ getFeature('paging', null) ]
		}
	};
	var renderer = _fnRenderer('layout');

	// Everything above - the renderer will actually insert the contents into the document
	renderer(settings, insert, top);

	// The table - always the center of attention
	renderer(settings, insert, {
		full: {
			table: true,
			contents: [settings.tableElement]
		}
	});

	// Everything below
	renderer(settings, insert, bottom);
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
	var k, l, shifted, column, colspan, rowspan;
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
	for (let i = 0; i < rows.length; i++) {
		layout.push([]);
	}

	for (let i = 0; i < rows.length; i++) {
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
				unique = colspan === 1;

				// Perform header setup
				if (write) {
					if (unique) {
						// Allow column options to be set from HTML attributes
						_fnColumnOptions(settings, shifted);

						// Get the width for the column. This can be defined from the
						// width attribute, style attribute or `columns.width` option
						var columnDef = columns[shifted];
						var width = cell.getAttribute('width') || null;
						var t = cell.style.width.match(/width:\s*(\d+[pxem%]+)/);
						if (t) {
							width = t[1];
						}

						columnDef.originalWidth = columnDef.width || width;

						if (isHeader) {
							// Column title handling - can be user set, or read from the DOM
							// This happens before the render, so the original is still in place
							if (columnDef.title !== null && !columnDef.autoTitle) {
								cell.innerHTML = columnDef.title;
							}

							if (!columnDef.title && unique) {
								columnDef.title = _stripHtml(cell.innerHTML);
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
							columnDef.ariaTitle = $(cell).attr("aria-label") || columnDef.title;
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
	var initDisplayStart = oSettings.initDisplayStart;

	// Check and see if we have an initial draw position from state saving
	if (initDisplayStart !== undefined && initDisplayStart !== -1) {
		oSettings._displayStart = initDisplayStart >= oSettings.totalDisplayed()
			? 0
			: initDisplayStart;

		oSettings.initDisplayStart = -1;
	}
}


// #endregion
// #region core.filter.js

/**
 * Filter the table using both the global filter and column based filtering
 *  @param {object} settings dataTables settings object
 *  @param {string} search filter string
 *  @memberof DataTable#oApi
 */
function _fnFilterComplete(settings, searchText) {
	// Check if any of the rows were invalidated
	_fnFilterData(settings);

	// Start from the full data set
	settings.display = settings.displayMaster.slice();

	// Global filter first
	_fnFilter(settings.display, settings, searchText);

	_fnCallbackFire(settings, null, 'search', [settings]);
}

/**
 * Filter the data table based on user input and draw the table
 */
function _fnFilter(searchRows, settings, input) {
	if (input === '') {
		return;
	}

	var matched = [];

	// Search term can be a function, regex or string - if a string we apply our
	// smart filtering regex (assuming the options require that)
	var rpSearch = _fnFilterCreateSearch(input);

	// Then for each row, does the test pass. If not, lop the row from the array
	for (let i = 0; i < searchRows.length; i++) {
		var row = settings.data[searchRows[i]];
		var data = row._sFilterRow;

		if (rpSearch && rpSearch.test(data)) {
			matched.push(searchRows[i]);
		}
	}

	// Mutate the searchRows array
	searchRows.length = matched.length;

	for (let i = 0; i < matched.length; i++) {
		searchRows[i] = matched[i];
	}
}


/**
 * Build a regular expression object suitable for searching a table
 *  @param {string} sSearch string to search for
 *  @returns {RegExp} constructed object
 *  @memberof DataTable#oApi
 */
function _fnFilterCreateSearch(search) {
	var not = [];

	if (typeof search !== 'string') {
		search = search.toString();
	}

	// Remove diacritics if normalize is set up to do so
	search = _normalize(search);

	search = _fnEscapeRegex(search);

	/* For smart filtering we want to allow the search to work regardless of
	 * word order. We also want double quoted text to be preserved, so word
	 * order is important - a la google. And a negative look around for
	 * finding rows which don't contain a given string.
	 * 
	 * So this is the sort of thing we want to generate:
	 * 
	 * ^(?=.*?\bone\b)(?=.*?\btwo three\b)(?=.*?\bfour\b).*$
	 */
	var parts = search.match(/!?["\u201C][^"\u201D]+["\u201D]|[^ ]+/g) || [''];
	var a = parts.map(function (word) {
		var negative = false;
		var m;

		// Determine if it is a "does not include"
		if (word.charAt(0) === '!') {
			negative = true;
			word = word.substring(1);
		}

		// Strip the quotes from around matched phrases
		if (word.charAt(0) === '"') {
			m = word.match(/^"(.*)"$/);
			word = m ? m[1] : word;
		}
		else if (word.charAt(0) === '\u201C') {
			// Smart quote match (iPhone users)
			m = word.match(/^\u201C(.*)\u201D$/);
			word = m ? m[1] : word;
		}

		// For our "not" case, we need to modify the string that is
		// allowed to match at the end of the expression.
		if (negative) {
			if (word.length > 1) {
				not.push('(?!' + word + ')');
			}

			word = '';
		}

		return word.replace(/"/g, '');
	});

	var match = not.length
		? not.join('')
		: '';

	var boundary = '';

	search = '^(?=.*?' + boundary + a.join(')(?=.*?' + boundary) + ')(' + match + '.)*$';

	return new RegExp(search, 'i');
}


/**
 * Escape a string such that it can be used in a regular expression
 *  @param {string} sVal string to escape
 *  @returns {string} escaped string
 *  @memberof DataTable#oApi
 */
var _fnEscapeRegex = DataTable.util.escapeRegex;

var __filter_div = $('<div>')[0];
var __filter_div_textContent = __filter_div.textContent !== undefined;

// Update the filtering data for each row if needed (by invalidation or first run)
function _fnFilterData(settings) {
	var columns = settings.columns;
	var data = settings.data;
	var column;
	var filterData, cellData, row;
	var wasInvalidated = false;

	for (var rowIdx = 0; rowIdx < data.length; rowIdx++) {
		if (!data[rowIdx]) {
			continue;
		}

		row = data[rowIdx];

		if (!row._aFilterData) {
			filterData = [];

			for (let j = 0; j < columns.length; j++) {
				column = columns[j];

				if (column.searchable) {
					cellData = _fnGetCellData(settings, rowIdx, j, 'filter');

					// Search in DataTables is string based
					if (cellData === null) {
						cellData = '';
					}

					if (typeof cellData !== 'string' && cellData.toString) {
						cellData = cellData.toString();
					}
				}
				else {
					cellData = '';
				}

				// If it looks like there is an HTML entity in the string,
				// attempt to decode it so sorting works as expected. Note that
				// we could use a single line of jQuery to do this, but the DOM
				// method used here is much faster https://jsperf.com/html-decode
				if (cellData.indexOf && cellData.indexOf('&') !== -1) {
					__filter_div.innerHTML = cellData;
					cellData = __filter_div_textContent ?
						__filter_div.textContent :
						__filter_div.innerText;
				}

				if (cellData.replace) {
					cellData = cellData.replace(/[\r\n\u2028]/g, '');
				}

				filterData.push(cellData);
			}

			row._aFilterData = filterData;
			row._sFilterRow = filterData.join('  ');
			wasInvalidated = true;
		}
	}

	return wasInvalidated;
}

// #endregion
// #region core.init.js

/**
 * Draw the table for the first time, adding all required features
 *  @param {object} settings dataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnInitialise(settings) {
	// Ensure that the table data is fully initialised
	if (!settings.initialized) {
		setTimeout(function () { _fnInitialise(settings); }, 200);
		return;
	}

	// Build the header / footer for the table
	_fnBuildHead(settings, 'header');
	_fnBuildHead(settings, 'footer');

	// Then draw the header / footer
	_fnDrawHead(settings, settings.header);
	_fnDrawHead(settings, settings.footer);

	// Grab the data from the page
	const rows = [...settings.tBodyElement.querySelectorAll(':scope > tr')];
	_fnAddTr(settings, rows);

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

	_fnInitComplete(settings);
	_fnProcessingDisplay(settings, false);
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

	settings._bInitComplete = true;

	// Table is fully set up and we have data, so calculate the
	// column widths
	_fnAdjustColumnSizing(settings);
}

// #endregion
// #region core.length.js

function _fnLengthChange(settings, val) {
	var len = parseInt(val, 10);
	settings._displayLength = len;

	_fnLengthOverflow(settings);

	// Fire length change event
	_fnCallbackFire(settings, null, 'length', [settings, len]);
}

// #endregion
// #region core.page.js

/**
 * Alter the display settings to change the page
 *  @param {object} settings DataTables settings object
 *  @param {string|int} action Paging action to take: "first", "previous",
 *    "next" or "last" or page number to jump to (integer)
 *  @param [bool] redraw Automatically draw the update or not
 *  @returns {bool} true page has changed, false - no change
 *  @memberof DataTable#oApi
 */
function _fnPageChange(settings, action) {
	var
		start = settings._displayStart,
		len = settings._displayLength,
		records = settings.totalDisplayed();

	if (records === 0 || len === -1) {
		start = 0;
	}
	else if (typeof action === "number") {
		start = action * len;

		if (start > records) {
			start = 0;
		}
	}
	else if (action == "first") {
		start = 0;
	}
	else if (action == "previous") {
		start = len >= 0 ?
			start - len :
			0;

		if (start < 0) {
			start = 0;
		}
	}
	else if (action == "next") {
		if (start + len < records) {
			start += len;
		}
	}
	else if (action == "last") {
		start = Math.floor((records - 1) / len) * len;
	}
	else if (action === 'ellipsis') {
		return;
	}
	else {
		_fnLog(settings, 0, "Unknown paging action: " + action, 5);
	}

	var changed = settings._displayStart !== start;
	settings._displayStart = start;

	_fnCallbackFire(settings, null, changed ? 'page' : 'page-nc', [settings]);

	if (changed) {
		_fnDraw(settings);
	}

	return changed;
}

// #endregion
// #region core.processing.js


/**
 * Display or hide the processing indicator
 *  @param {object} settings DataTables settings object
 *  @param {bool} show Show the processing indicator (true) or not (false)
 */
function _fnProcessingDisplay(settings, show) {
	// Ignore cases when we are still redrawing
	if (settings.drawing && show === false) {
		return;
	}

	_fnCallbackFire(settings, null, 'processing', [settings, show]);
}

/**
 * Show the processing element if an action takes longer than a given time
 *
 * @param {*} settings DataTables settings object
 * @param {*} enable Do (true) or not (false) async processing (local feature enablement)
 * @param {*} run Function to run
 */
function _fnProcessingRun(settings, enable, run) {
	if (!enable) {
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
// #region core.sizing.js

/**
 * Calculate the width of columns for the table
 *  @param {object} settings dataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnCalculateColumnWidths(settings) {
	var
		table = settings.tableElement,
		columns = settings.columns,
		visibleColumns = _range(columns.length),
		tableWidthAttr = table.getAttribute('width'), // from DOM element
		tableContainer = table.parentNode,
		columnIdx;

	var styleWidth = table.style.width;

	// If there is no width applied as a CSS style or as an attribute, we assume that
	// the width is intended to be 100%, which is usually is in CSS, but it is very
	// difficult to correctly parse the rules to get the final result.
	if (!styleWidth && !tableWidthAttr) {
		table.style.width = '100%';
		styleWidth = '100%';
	}

	if (styleWidth && styleWidth.indexOf('%') !== -1) {
		tableWidthAttr = styleWidth;
	}

	// Construct a single row, worst case, table with the widest
	// node in the data, assign any user defined widths, then insert it into
	// the DOM and allow the browser to do all the hard work of calculating
	// table widths
	var tmpTable = $(table.cloneNode())
		.css('visibility', 'hidden')
		.removeAttr('id');

	// Clean up the table body
	tmpTable.append('<tbody>')
	var tr = $('<tr/>').appendTo(tmpTable.find('tbody'));

	// Clone the table header and footer - we can't use the header / footer
	// from the cloned table, since if scrolling is active, the table's
	// real header and footer are contained in different table tags
	tmpTable
		.append($(settings.tHeadElement).clone())
		.append($(settings.tFootElement).clone());

	// Remove any assigned widths from the footer (from scrolling)
	tmpTable.find('tfoot th, tfoot td').css('width', '');

	// Apply custom sizing to the cloned header
	tmpTable.find('thead th, thead td').each(function () {
		// Get the `width` from the header layout
		var width = _fnColumnsSumWidth(settings, this, true);

		if (width) {
			// Need to set the width and min-width, otherwise the browser
			// will attempt to collapse the table beyond want might have
			// been specified
			this.style.width = width;
			this.style.minWidth = width;
		}
		else {
			this.style.width = '';
		}
	});

	// Find the widest piece of data for each column and put it into the table
	for (let i = 0; i < visibleColumns.length; i++) {
		columnIdx = visibleColumns[i];

		var longest = _fnGetMaxLenString(settings, columnIdx);
		var autoClass = _ext.type.className['string'];
		var text = longest;
		var insert = longest.indexOf('<') === -1
			? document.createTextNode(text)
			: text

		$('<td/>')
			.addClass(autoClass)
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
	var holder = $('<div/>').css({})
		.append(tmpTable)
		.appendTo(tableContainer);

	// When scrolling (X or Y) we want to set the width of the table as 
	// appropriate. However, when not scrolling leave the table width as it
	// is. This results in slightly different, but I think correct behaviour
	if (tableWidthAttr) {
		tmpTable.width(tableWidthAttr);
	}

	// Get the width of each column in the constructed table
	var total = 0;
	var bodyCells = tmpTable.find('tbody tr').eq(0).children();

	for (let i = 0; i < visibleColumns.length; i++) {
		// Use getBounding for sub-pixel accuracy, which we then want to round up!
		var bounding = bodyCells[i].getBoundingClientRect().width;

		// Total is tracked to remove any sub-pixel errors as the outerWidth
		// of the table might not equal the total given here
		total += bounding;

		// Width for each column to use
		columns[visibleColumns[i]].width = _fnStringToCss(bounding);
	}

	table.style.width = _fnStringToCss(total);

	// Finished with the table - ditch it
	holder.remove();

	// If there is a width attr, we want to attach an event listener which
	// allows the table sizing to automatically adjust when the window is
	// resized. Use the width attr rather than CSS, since we can't know if the
	// CSS is a relative value or absolute - DOM read is always px.
	if (tableWidthAttr) {
		table.style.width = _fnStringToCss(tableWidthAttr);
	}

	if ((tableWidthAttr) && !settings._reszEvt) {
		var bindResize = function () {
			$(window).on('resize.DT-' + settings.instanceId, DataTable.util.throttle(function () {
				if (!settings.bDestroying) {
					_fnAdjustColumnSizing(settings);
				}
			}));
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
function _fnGetMaxLenString(settings, colIdx) {
	var column = settings.columns[colIdx];

	if (!column.maxLenString) {
		var s, max = '', maxLen = -1;

		for (var i = 0, ien = settings.displayMaster.length; i < ien; i++) {
			var rowIdx = settings.displayMaster[i];
			var data = _fnGetRowDisplay(settings, rowIdx)[colIdx];

			var cellString = data && typeof data === 'object' && data.nodeType
				? data.innerHTML
				: data + '';

			// Remove id / name attributes from elements so they
			// don't interfere with existing elements
			cellString = cellString
				.replace(/id=".*?"/g, '')
				.replace(/name=".*?"/g, '');

			s = _stripHtml(cellString)
				.replace(/&nbsp;/g, ' ');

			if (s.length > maxLen) {
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
function _fnStringToCss(s) {
	if (s === null) {
		return '0px';
	}

	if (typeof s == 'number') {
		return s < 0 ?
			'0px' :
			s + 'px';
	}

	// Check it has a unit character already
	return s.match(/\d$/) ?
		s + 'px' :
		s;
}

/**
 * Re-insert the `col` elements for current visibility
 *
 * @param {*} settings DT settings
 */
function _colGroup(settings) {
	var cols = settings.columns;

	settings.colgroup.empty();

	for (let i = 0; i < cols.length; i++) {
		settings.colgroup.append(cols[i].colEl);
	}
}
// #endregion
// #region core.sort.js

function _fnSortInit(settings) {
	var target = settings.tHeadElement;
	var notSelector = ':not([data-dt-order="disable"]):not([data-dt-order="icon-only"])';

	var selector = 'tr' + notSelector
		+ ' th' + notSelector
		+ ', tr' + notSelector
		+ ' td' + notSelector;

	_fnSortAttachListener(settings, target, selector);

	// Need to resolve the user input array into our internal structure
	var order = [];
	_fnSortResolve(order, settings.order);

	settings.order = order;
}


function _fnSortAttachListener(settings, node, selector) {
	_fnBindAction(node, selector, function (e) {
		var run = false;
		var columns = _fnColumnsFromHeader(e.target);

		if (columns.length) {
			for (var i = 0, ien = columns.length; i < ien; i++) {
				var ret = _fnSortAdd(settings, columns[i]);

				if (ret !== false) {
					run = true;
				}

				// If the first entry is no sort, then subsequent
				// sort columns are ignored
				if (settings.order.length === 1 && settings.order[0][1] === '') {
					break;
				}
			}

			if (run) {
				_fnProcessingRun(settings, true, function () {
					_fnSort(settings);
					_fnSortDisplay(settings, settings.display);

					_fnReDraw(settings, false);
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

	var master = settings.displayMaster;
	var masterMap = {};
	var map = {};

	// Rather than needing an `indexOf` on master array, we can create a map
	for (let i = 0; i < master.length; i++) {
		masterMap[master[i]] = i;
	}

	// And then cache what would be the indexOf fom the display
	for (let i = 0; i < display.length; i++) {
		map[display[i]] = masterMap[display[i]];
	}

	display.sort(function (a, b) {
		// Short version of this function is simply `master.indexOf(a) - master.indexOf(b);`
		return map[a] - map[b];
	});
}


function _fnSortResolve(nestedSort, sort) {
	if (sort.length) {
		// 2D array
		for (var z = 0; z < sort.length; z++) {
			nestedSort.push(sort[z]);
		}
	}
}


function _fnSortFlatten(settings) {
	var
		aSort = [],
		extSort = DataTable.ext.type.order,
		columns = settings.columns,
		iCol, sType, srcCol,
		nestedSort = [];

	if (!settings.features.ordering) {
		return aSort;
	}

	// Build the sort array, with pre-fix and post-fix options if they have been
	// specified

	_fnSortResolve(nestedSort, settings.order);

	for (let i = 0; i < nestedSort.length; i++) {
		srcCol = nestedSort[i][0];

		if (columns[srcCol]) {
			iCol = columns[srcCol].idx;
			sType = 'string';

			if (nestedSort[i]._idx === undefined) {
				nestedSort[i]._idx = columns[iCol].orderSequence.indexOf(nestedSort[i][1]);
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

	return aSort;
}

/**
 * Change the order of the table
 *  @param {object} oSettings dataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnSort(oSettings, col, dir) {
	var
		aiOrig = [],
		extSort = DataTable.ext.type.order,
		data = oSettings.data,
		sortCol,
		displayMaster = oSettings.displayMaster,
		aSort;

	// Allow a specific column to be sorted, which will _not_ alter the display
	// master
	if (col !== undefined) {
		aSort = [{
			src: col,
			col: col,
			dir: dir,
			index: 0,
			type: 'string',
			formatter: extSort["string-pre"],
			sorter: extSort["string-" + dir]
		}];
		displayMaster = displayMaster.slice();
	}
	else {
		aSort = _fnSortFlatten(oSettings);
	}

	for (let i = 0; i < aSort.length; i++) {
		sortCol = aSort[i];

		// Load the data needed for the sort, for each cell
		_fnSortData(oSettings, sortCol.col);
	}

	/* No sorting required if server-side or no sorting array */
	if (aSort.length !== 0) {
		// Reset the initial positions on each pass so we get a stable sort
		for (let i = 0; i < displayMaster.length; i++) {
			aiOrig[i] = i;
		}

		// If the first sort is desc, then reverse the array to preserve original
		// order, just in reverse
		if (aSort.length && aSort[0].dir === 'desc') {
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
				x, y, test, sort,
				dataA = data[a]._aSortData,
				dataB = data[b]._aSortData;

			for (let k = 0; k < aSort.length; k++) {
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

	if (col === undefined) {
		// Tell the draw function that we have sorted the data
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
function _fnSortAdd(settings, colIdx) {
	var col = settings.columns[colIdx];
	var sorting = settings.order;
	var orderSequence = col.orderSequence;
	var nextSortIdx;
	var next = function (a, overflow) {
		var idx = a._idx;
		if (idx === undefined) {
			idx = orderSequence.indexOf(a[1]);
		}

		return idx + 1 < orderSequence.length ?
			idx + 1 :
			overflow ?
				null :
				0;
	};

	if (!col.orderable) {
		return false;
	}

	// Convert to 2D array if needed
	if (typeof sorting[0] === 'number') {
		sorting = settings.order = [sorting];
	}

	// If appending the sort then we are multi-column sorting
	if (sorting.length && sorting[0][0] == colIdx) {
		// Single column - already sorting on this column, modify the sort
		nextSortIdx = next(sorting[0]);

		sorting.length = 1;
		sorting[0][1] = orderSequence[nextSortIdx];
		sorting[0]._idx = nextSortIdx;
	}
	else {
		// Single column - sort only on this column
		sorting.length = 0;
		sorting.push([colIdx, orderSequence[0]]);
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
	var oldSort = settings.lastSort;
	var sortClass = DataTable.ext.classes.order.position;
	var sort = _fnSortFlatten(settings);
	var features = settings.features;
	var colIdx;

	if (features.ordering) {
		// Remove old sorting classes
		for (let i = 0; i < oldSort.length; i++) {
			colIdx = oldSort[i].src;

			// Remove column sorting
			$(_pluck(settings.data, 'anCells', colIdx))
				.removeClass(sortClass + (i < 2 ? i + 1 : 3));
		}

		// Add new column sorting
		for (let i = 0; i < sort.length; i++) {
			colIdx = sort[i].src;

			$(_pluck(settings.data, 'anCells', colIdx))
				.addClass(sortClass + (i < 2 ? i + 1 : 3));
		}
	}

	settings.lastSort = sort;
}


// Get the data to sort a column, be it from cache, fresh (populating the
// cache), or from a sort formatter
function _fnSortData(settings, colIdx) {
	// Use / populate cache
	var row, cellData;
	var formatter = DataTable.ext.type.order["string-pre"];
	var data = settings.data;

	for (var rowIdx = 0; rowIdx < data.length; rowIdx++) {
		// Sparse array
		if (!data[rowIdx]) {
			continue;
		}

		row = data[rowIdx];

		if (!row._aSortData) {
			row._aSortData = [];
		}

		if (!row._aSortData[colIdx]) {
			cellData = _fnGetCellData(settings, rowIdx, colIdx, 'sort');

			row._aSortData[colIdx] = formatter ?
				formatter(cellData, settings) :
				cellData;
		}
	}
}


// #endregion
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
		(settings ? 'table id=' + settings.tableId + ' - ' : '') + msg;

	if (tn) {
		msg += '. For more information about this error, please see ' +
			'https://datatables.net/tn/' + tn;
	}

	if (!level) {
		var type = DataTable.ext.errMode;

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
		var table = $(settings.tableElement);

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
		start = settings._displayStart,
		end = settings.displayEnd(),
		len = settings._displayLength;

	/* If we have space to show extra rows (backing up from the end point - then do so */
	if (start >= end) {
		start = end - len;
	}

	// Keep the start record on the current page
	start -= (start % len);

	if (len === -1 || start < 0) {
		start = 0;
	}

	settings._displayStart = start;
}


function _fnRenderer(type) {
	var host = DataTable.ext.renderer[type];

	// Use the default
	return host._;
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
	// When infinite scrolling, we are always starting at 1. _displayStart is
	// used only internally
	var
		formatter = _formatNumber,
		start = settings._displayStart + 1,
		len = settings._displayLength,
		vis = settings.totalDisplayed(),
		max = settings.total(),
		all = len === -1;

	return str.
		replace(/_START_/g, formatter.call(settings, start)).
		replace(/_END_/g, formatter.call(settings, settings.displayEnd())).
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
	var tables = _pluck(settings, 'tableElement');

	if (!mixed) {
		return [];
	}
	else if (mixed.tableElement && mixed.features) {
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

	var
		i, ien,
		struct;

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
// #region api.selectors.js

var _selector_run = function (selector, selectFn, settings, opts) {
	var
		type = 'column',
		out = [], res,
		a, i, ien, j, jen,
		selectorType = typeof selector;

	// Can't just check for isArray here, as an API or jQuery instance might be
	// given with their array like look
	if (!selector || selectorType === 'string' || selectorType === 'function' || selector.length === undefined) {
		selector = [selector];
	}

	for (i = 0, ien = selector.length; i < ien; i++) {
		// Only split on simple strings - complex expressions will be jQuery selectors
		a = selector[i] && selector[i].split && !selector[i].match(/[[(:]/) ?
			selector[i].split(',') :
			[selector[i]];

		for (j = 0, jen = a.length; j < jen; j++) {
			res = selectFn(typeof a[j] === 'string' ? (a[j]).trim() : a[j]);

			// Remove empty items
			res = res.filter(function (item) {
				return item !== null && item !== undefined;
			});

			if (res && res.length) {
				out = out.concat(res);
			}
		}
	}

	// selector extensions
	var ext = _ext.selector[type];
	if (ext.length) {
		for (i = 0, ien = ext.length; i < ien; i++) {
			out = ext[i](settings, opts, out);
		}
	}

	return _unique(out);
};


var _selector_opts = function (opts) {
	if (!opts) {
		opts = {};
	}

	// Backwards compatibility for 1.9- which used the terminology filter rather
	// than search
	if (opts.filter && opts.search === undefined) {
		opts.search = opts.filter;
	}

	return $.extend({
		search: 'none',
		order: 'current',
		page: 'all'
	}, opts);
};

var _selector_row_indexes = function (settings, opts) {
	var
		i, ien, tmp, a = [],
		displayFiltered = settings.display,
		displayMaster = settings.displayMaster;

	var
		search = opts.search,  // none, applied, removed
		order = opts.order,   // applied, current, index (original - compatibility with 1.9)
		page = opts.page;    // all, current

	if (page == 'current') {
		// Current page implies that order=current and filter=applied, since it is
		// fairly senseless otherwise, regardless of what order and search actually
		// are
		for (i = settings._displayStart, ien = settings.displayEnd(); i < ien; i++) {
			a.push(displayFiltered[i]);
		}
	}
	else if (order == 'current' || order == 'applied') {
		if (search == 'none') {
			a = displayMaster.slice();
		}
		else if (search == 'applied') {
			a = displayFiltered.slice();
		}
		else if (search == 'removed') {
			// O(n+m) solution by creating a hash map
			var displayFilteredMap = {};

			for (i = 0, ien = displayFiltered.length; i < ien; i++) {
				displayFilteredMap[displayFiltered[i]] = null;
			}

			displayMaster.forEach(function (item) {
				if (!Object.prototype.hasOwnProperty.call(displayFilteredMap, item)) {
					a.push(item);
				}
			});
		}
	}
	else if (order == 'index' || order == 'original') {
		for (i = 0, ien = settings.data.length; i < ien; i++) {
			if (!settings.data[i]) {
				continue;
			}

			if (search == 'none') {
				a.push(i);
			}
			else { // applied | removed
				tmp = displayFiltered.indexOf(i);

				if ((tmp === -1 && search == 'removed') ||
					(tmp >= 0 && search == 'applied')) {
					a.push(i);
				}
			}
		}
	}
	else if (typeof order === 'number') {
		// Order the rows by the given column
		var ordered = _fnSort(settings, order, 'asc');

		if (search === 'none') {
			a = ordered;
		}
		else { // applied | removed
			for (i = 0; i < ordered.length; i++) {
				tmp = displayFiltered.indexOf(ordered[i]);

				if ((tmp === -1 && search == 'removed') ||
					(tmp >= 0 && search == 'applied')) {
					a.push(ordered[i]);
				}
			}
		}
	}

	return a;
};

// #endregion
// #region api.columns.js


/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * Columns
 *
 * {integer}           - column index (>=0 count from left, <0 count from right)
 * "{integer}:visIdx"  - visible column index (i.e. translate to column index)  (>=0 count from left, <0 count from right)
 * "{integer}:visible" - alias for {integer}:visIdx  (>=0 count from left, <0 count from right)
 * "{string}:name"     - column name
 * "{string}"          - jQuery selector on column header nodes
 *
 */

// can be an array of these items, comma separated list, or an array of comma
// separated lists

var __re_column_selector = /^([^:]+)?:(name|title|visIdx|visible)$/;


// r1 and r2 are redundant - but it means that the parameters match for the
// iterator callback in columns().data()
var __columnData = function (settings, column, rows) {
	var a = [];
	for (var row = 0, ien = rows.length; row < ien; row++) {
		a.push(_fnGetCellData(settings, rows[row], column));
	}
	return a;
};


var __column_header = function (settings, column) {
	var header = settings.header;
	var target = header.length - 1;

	return header[target][column].cell;
};

var __column_selector = function (settings, selector, opts) {
	var
		columns = settings.columns,
		titles = _pluck(columns, 'title'),
		cells = DataTable.util.get('[].[].cell')(settings.header),
		nodes = _unique(_flatten([], cells));

	var run = function (s) {
		var selInt = _intVal(s);

		// Selector - all
		if (s === '') {
			return _range(columns.length);
		}

		// Selector - index
		if (selInt !== null) {
			return [selInt >= 0 ?
				selInt : // Count from left
				columns.length + selInt // Count from right (+ because its a negative value)
			];
		}

		// Selector = function
		if (typeof s === 'function') {
			var rows = _selector_row_indexes(settings, opts);

			return columns.map(function (col, idx) {
				return s(
					idx,
					__columnData(settings, idx, rows),
					__column_header(settings, idx)
				) ? idx : null;
			});
		}

		// jQuery or string selector
		var match = typeof s === 'string' ?
			s.match(__re_column_selector) :
			'';

		if (match) {
			switch (match[2]) {
				case 'visIdx':
				case 'visible':
					// Selector is a column index
					if (match[1] && match[1].match(/^\d+$/)) {
						var idx = parseInt(match[1], 10);

						// Visible index given, convert to column index
						if (idx < 0) {
							// Counting from the right
							var visColumns = _range(columns.length);
							return [visColumns[visColumns.length + idx]];
						}
						// Counting from the left
						return [_fnVisibleToColumnIndex(settings, idx)];
					}

					return columns.map(function (col, idx) {
						// Selector
						if (match[1]) {
							return $(nodes[idx]).filter(match[1]).length > 0 ? idx : null;
						}

						// `:visible` on its own
						return idx;
					});

				case 'title':
					// match by column title
					return titles.map(function (title, i) {
						return title === match[1] ? i : null;
					});

				default:
					return [];
			}
		}

		// Cell in the table body
		if (s.nodeName && s._DT_CellIndex) {
			return [s._DT_CellIndex.column];
		}

		// jQuery selector on the TH elements for the columns
		var jqResult = $(nodes)
			.filter(s)
			.map(function () {
				return _fnColumnsFromHeader(this); // `nodes` is column index complete and in order
			})
			.toArray();

		if (jqResult.length || !s.nodeName) {
			return jqResult;
		}

		// Otherwise a node which might have a `dt-column` data attribute, or be
		// a child or such an element
		var host = $(s).closest('*[data-dt-column]');
		return host.length ?
			[host.data('dt-column')] :
			[];
	};

	return _selector_run(selector, run, settings, opts);
};

_api_register('columns()', function (selector, opts) {
	opts = _selector_opts(opts);

	var inst = this.iterator('table', function (settings) {
		return __column_selector(settings, selector, opts);
	}, 1);

	// Want argument shifting here and in _row_selector?
	inst.selector.cols = selector;
	inst.selector.opts = opts;

	return inst;
});

_api_registerPlural('columns().indexes()', 'column().index()', function (type) {
	return this.iterator('column', function (settings, column) {
		return type === 'visible' ?
			_fnColumnIndexToVisible(settings, column) :
			column;
	}, 1);
});

// #endregion
// #region api.order.js

// Order by the selected column(s)
_api_register([
	'columns().order()',
	'column().order()'
], function (dir) {
	var that = this;

	if (!dir) {
		return this.iterator('column', function (settings, idx) {
			var sort = _fnSortFlatten(settings);

			for (var i = 0, ien = sort.length; i < ien; i++) {
				if (sort[i].col === idx) {
					return sort[i].dir;
				}
			}

			return null;
		}, 1);
	}
	else {
		return this.iterator('table', function (settings, i) {
			settings.order = that[i].map(function (col) {
				return [col, dir];
			});
		});
	}
});

_api_registerPlural('columns().orderable()', 'column().orderable()', function (directions) {
	return this.iterator('column', function (settings, idx) {
		var col = settings.columns[idx];

		return directions ?
			col.orderSequence :
			col.orderable;
	}, 1);
});

// #endregion

// #region api.core.js

/**
 *
 */
_api_register('$()', function (selector, opts) {
	var
		rows = this.rows(opts).nodes(), // Get all rows
		jqRows = $(rows);

	return $([].concat(
		jqRows.filter(selector).toArray(),
		jqRows.find(selector).toArray()
	));
});


_api_register('error()', function (msg) {
	return this.iterator('table', function (settings) {
		_fnLog(settings, 0, msg);
	});
});


// i18n method for extensions to be able to use the language object from the
// DataTable
_api_register('i18n()', function (token, def) {
	var ctx = this.context[0];
	var resolved = _fnGetObjectDataFn(token)(ctx.language);

	if (resolved === undefined) {
		resolved = def;
	}

	if ($.isPlainObject(resolved)) {
		resolved = resolved._;
	}

	return typeof resolved === 'string'
		? resolved.replace('%d', undefined) // nb: plural might be undefined,
		: resolved;
});

// #endregion

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
// #region model.row.js

/**
 * Template object for the way in which DataTables holds information about
 * each individual row. This is the object format used for the settings
 * data array.
 *  @namespace
 */
DataTable.models.oRow = {
	/**
	 * TR element for the row
	 */
	"nTr": null,

	/**
	 * Array of TD elements for each row. This is null until the row has been
	 * created.
	 */
	"anCells": null,

	/**
	 * Data object from the original data source for the row. This is either
	 * an array if using the traditional form of DataTables, or an object if
	 * using mData options. The exact type will depend on the passed in
	 * data from the data source, or will be an array if using DOM a data
	 * source.
	 */
	"_aData": [],

	/**
	 * Sorting data cache - this array is ostensibly the same length as the
	 * number of columns (although each index is generated only as it is
	 * needed), and holds the data that is used for sorting each column in the
	 * row. We do this cache generation at the start of the sort in order that
	 * the formatting of the sort data need be done only once for each cell
	 * per sort. This array should not be read from or written to by anything
	 * other than the master sorting methods.
	 */
	"_aSortData": null,

	/**
	 * Per cell filtering data cache. As per the sort data cache, used to
	 * increase the performance of the filtering in DataTables
	 */
	"_aFilterData": null,

	/**
	 * Filtering data cache. This is the same as the cell filtering cache, but
	 * in this case a string rather than an array. This is easily computed with
	 * a join on `_aFilterData`, but is provided as a cache so the join isn't
	 * needed on every search (memory traded for performance)
	 */
	"_sFilterRow": null,

	/**
	 * Index in the data array. This saves an indexOf lookup when we have the
	 * object, but want to know the index
	 */
	"idx": -1,

	/**
	 * Cached display value
	 */
	displayData: null
};

// #endregion
// #region model.column.js


/**
 * Template object for the column information object in DataTables. This object
 * is held in the settings columns array and contains all the information that
 * DataTables needs about each individual column.
 *
 * Note that this object is related to {@link DataTable.defaults.column}
 * but this one is the internal data store for DataTables's cache of columns.
 * It should NOT be manipulated outside of DataTables. Any configuration should
 * be done through the initialisation options.
 *  @namespace
 */
DataTable.models.oColumn = {
	/**
	 * Column index.
	 */
	idx: null,

	/**
	 * Define the sorting directions that are applied to the column, in sequence
	 * as the column is repeatedly sorted upon - i.e. the first value is used
	 * as the sorting direction when the column if first sorted (clicked on).
	 * Sort it again (click again) and it will move on to the next index.
	 * Repeat until loop.
	 */
	orderSequence: null,

	/**
	 * Flag to indicate if the column is searchable, and thus should be included
	 * in the filtering or not.
	 */
	searchable: null,

	/**
	 * Flag to indicate if the column is sortable or not.
	 */
	orderable: null,

	/**
	 * Function to get data from a cell in a column. You should <b>never</b>
	 * access data directly through _aData internally in DataTables - always use
	 * the method attached to this property. It allows mData to function as
	 * required. This function is automatically assigned by the column
	 * initialisation method
	 */
	getData: null,

	/**
	 * Property to read the value for the cells in the column from the data
	 * source array / object. If null, then the default content is used, if a
	 * function is given then the return from the function is used.
	 */
	data: null,

	/**
	 * Title of the column - what is seen in the TH element (nTh).
	 */
	title: null,

	/**
	 * Width of the column
	 */
	width: null,

	/**
	 * Width of the column when it was first "encountered"
	 */
	originalWidth: null,

	/** Cached string which is the longest in the column */
	maxLenString: null,
};

// #endregion
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
	 * If ordering is enabled, then DataTables will perform a first pass sort on
	 * initialisation. You can define which column(s) the sort is performed
	 * upon, and the sorting direction, with this variable. The `sorting` array
	 * should contain an array for each column to be sorted initially containing
	 * the column's index and a direction string ('asc' or 'desc').
	 */
	order: [[0, 'asc']],


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
	lengthMenu: [10, 25, 50, 100],


	/**
	 * The `columns` option in the initialisation parameter allows you to define
	 * details about the way individual columns behave. For a full list of
	 * column options that can be set, please see
	 * {@link DataTable.defaults.column}. Note that if you use `columns` to
	 * define your columns, you must have an entry in the array for every single
	 * column that you have in your table (these can be null if you don't which
	 * to specify any options).
	 */
	columns: null,

	/**
	 * Enable or disable filtering of data. Filtering in DataTables is "smart" in
	 * that it allows the end user to input multiple words (space separated) and
	 * will match a row containing those words, even if not in the order that was
	 * specified (this allow matching across multiple columns). Note that if you
	 * wish to use filtering in DataTables this must remain 'true' - to remove the
	 * default filtering input box and retain filtering abilities, please use
	 * {@link DataTable.defaults.dom}.
	 */
	searching: true,

	/**
	 * Enable or disable pagination.
	 */
	paging: true,


	/**
	 * Enable or disable sorting of columns. Sorting of individual columns can be
	 * disabled by the `sortable` option for each column.
	 */
	ordering: true,


	/**
	 * All strings that DataTables uses in the user interface that it creates
	 * are defined in this object, allowing you to modified them individually or
	 * completely replace them all as required.
	 */
	language: {
		/**
		 * Strings that are used for WAI-ARIA labels and controls only (these are not
		 * actually visible on the page, but will be read by screenreaders, and thus
		 * must be internationalised as well).
		 */
		"oAria": {
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
		"oPaginate": {
			/**
			 * Label and character for first page button («)
			 */
			"sFirst": "\u00AB",

			/**
			 * Last page button (»)
			 */
			"sLast": "\u00BB",

			/**
			 * Next page button (›)
			 */
			"sNext": "\u203A",

			/**
			 * Previous page button (‹)
			 */
			"sPrevious": "\u2039",
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
		"sEmptyTable": "No data available in table",


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
		"sInfo": "Showing _START_ to _END_ of _TOTAL_ _ENTRIES-TOTAL_",


		/**
		 * Display information string for when the table is empty. Typically the
		 * format of this string should match `info`.
		 */
		"sInfoEmpty": "Showing 0 to 0 of 0 _ENTRIES-TOTAL_",


		/**
		 * When a user filters the information in a table, this string is appended
		 * to the information (`info`) to give an idea of how strong the filtering
		 * is. The variable _MAX_ is dynamically updated.
		 */
		"sInfoFiltered": "(filtered from _MAX_ total _ENTRIES-MAX_)",


		/**
		 * Detail the action that will be taken when the drop down menu for the
		 * pagination length option is changed. The '_MENU_' variable is replaced
		 * with a default select list of 10, 25, 50 and 100, and can be replaced
		 * with a custom select box if required.
		 */
		"sLengthMenu": "_MENU_ _ENTRIES_ per page",


		/**
		 * When using Ajax sourced data and during the first draw when DataTables is
		 * gathering the data, this message is shown in an empty row in the table to
		 * indicate to the end user the the data is being loaded. Note that this
		 * parameter is not used when loading data by server-side processing, just
		 * Ajax sourced data with client-side processing.
		 */
		"sLoadingRecords": "Loading...",

		/**
		 * Details the actions that will be taken when the user types into the
		 * filtering input text box. The variable "_INPUT_", if used in the string,
		 * is replaced with the HTML text box for the filtering input allowing
		 * control over where it appears in the string. If "_INPUT_" is not given
		 * then the input box is appended to the string automatically.
		 */
		"sSearch": "Search:",


		/**
		 * Text shown inside the table records when the is no information to be
		 * displayed after filtering. `emptyTable` is shown when there is simply no
		 * information in the table at all (regardless of filtering).
		 */
		"sZeroRecords": "No matching records found"
	},

	/**
	 * Set the data property name that DataTables should use to get a row's id
	 * to set as the `id` property in the node.
	 */
	rowId: "DT_RowId",
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

	ariaTitle: '',


	/**
	 * You can control the default ordering direction, and even alter the
	 * behaviour of the sort handler (i.e. only allow ascending ordering etc)
	 * using this parameter.
	 */
	orderSequence: ['asc', 'desc', ''],


	/**
	 * Enable or disable filtering on the data in this column.
	 */
	searchable: true,


	/**
	 * Enable or disable ordering on this column.
	 */
	orderable: true,

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
	data: null,


	/**
	 * The title of this column.
	 */
	title: null,


	/**
	 * Defining the width of the column, this parameter may take any CSS value
	 * (3em, 20px etc). DataTables applies 'smart' widths to columns which have not
	 * been given a specific width through this interface ensuring that the table
	 * remains readable.
	 */
	width: null
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
	features: {

		/**
		 * Enable filtering on the table or not. Note that if this is disabled
		 * then there is no filtering at all on the table, including fnFilter.
		 * To just remove the filtering input use sDom and remove the 'f' option.
		 * Note that this parameter will be set by the initialisation routine. To
		 * set a default use {@link DataTable.defaults}.
		 */
		searching: null,

		/**
		 * Pagination enabled or not. Note that if this is disabled then length
		 * changing must also be disabled.
		 * Note that this parameter will be set by the initialisation routine. To
		 * set a default use {@link DataTable.defaults}.
		 */
		paging: null,

		/**
		 * Sorting enablement flag.
		 * Note that this parameter will be set by the initialisation routine. To
		 * set a default use {@link DataTable.defaults}.
		 */
		ordering: null,
	},

	/**
	 * Language information for the table.
	 */
	language: {
	},

	/**
	 * Store data information - see {@link DataTable.models.oRow} for detailed
	 * information.
	 */
	data: [],

	/**
	 * Array of indexes which are in the current display (after filtering etc)
	 */
	display: [],

	/**
	 * Array of indexes for display - no filtering
	 */
	displayMaster: [],

	/**
	 * Store information about each column that is in use
	 */
	columns: [],

	/**
	 * Store information about the table's header
	 */
	header: [],

	/**
	 * Store information about the table's footer
	 */
	footer: [],

	/**
	 * Store the applied global search information in case we want to force a
	 * research or compare the old search to a new one.
	 * Note that this parameter will be set by the initialisation routine. To
	 * set a default use {@link DataTable.defaults}.
	 */
	searchText: "",

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
	order: null,

	/**
	 * Array of callback functions for draw callback functions
	 */
	drawCallbacks: [],

	/**
	 * Cache the table ID for quick access
	 */
	tableId: "",

	/**
	 * The TABLE node for the main table
	 */
	tableElement: null,

	/**
	 * Permanent ref to the thead element
	 */
	tHeadElement: null,

	/**
	 * Permanent ref to the tfoot element - if it exists
	 */
	tFootElement: null,

	/**
	 * Permanent ref to the tbody element
	 */
	tBodyElement: null,

	/**
	 * Cache the wrapper node (contains all DataTables controlled elements)
	 */
	wrapperElement: null,

	/**
	 * Indicate if all required information has been read in
	 */
	initialized: false,

	/**
	 * List of options that can be used for the user selectable length menu.
	 * Note that this parameter will be set by the initialisation routine. To
	 * set a default use {@link DataTable.defaults}.
	 */
	lengthMenu: null,

	/**
	 * Counter for the draws that the table does. Also used as a tracker for
	 * server-side processing
	 */
	drawCounter: 0,

	/**
	 * Indicate if a redraw is being done - useful for Ajax
	 */
	drawing: false,

	/**
	 * Draw index (drawCounter) of the last error when parsing the returned data
	 */
	drawError: -1,

	/**
	 * Paging display length
	 */
	_displayLength: 10,

	/**
	 * Paging start point - display index
	 */
	_displayStart: 0,

	/**
	 * Get the number of records in the current record set, before filtering
	 */
	total: function () {
		return this.displayMaster.length;
	},

	/**
	 * Get the number of records in the current record set, after filtering
	 */
	totalDisplayed: function () {
		return this.display.length;
	},

	/**
	 * Get the display end point - display index
	 */
	displayEnd: function () {
		var len = this._displayLength,
			start = this._displayStart,
			calc = start + len,
			records = this.display.length,
			features = this.features,
			paginate = features.paging;

		return !paginate || calc > records || len === -1
			? records
			: calc;
	},

	/**
	 * The DataTables object for this table
	 */
	instance: null,

	/**
	 * Unique identifier for each instance of the DataTables object. If there
	 * is an ID on the table node, then it takes that value, otherwise an
	 * incrementing internal counter is used.
	 */
	instanceId: null,

	/**
	 * Last applied sort
	 */
	lastSort: [],

	/**
	 * Function used to get a row's id from the row's data
	 */
	getRowId: null,

	/**
	 * Data location where to store a row's id
	 */
	rowId: null,

	colgroup: null,
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

// #region ext.paging.js


var extPagination = DataTable.ext.pager;

// Paging buttons configuration
$.extend(extPagination, {
	simple: function () {
		return ['previous', 'next'];
	},

	full: function () {
		return ['first', 'previous', 'next', 'last'];
	},

	numbers: function () {
		return ['numbers'];
	},

	simple_numbers: function () {
		return ['previous', 'numbers', 'next'];
	},

	full_numbers: function () {
		return ['first', 'previous', 'numbers', 'next', 'last'];
	},

	first_last: function () {
		return ['first', 'last'];
	},

	first_last_numbers: function () {
		return ['first', 'numbers', 'last'];
	},

	// For testing and plug-ins to use
	_numbers: _pagingNumbers,

	// Number of number buttons - legacy, use `numbers` option for paging feature
	numbers_length: 7
});


$.extend(true, DataTable.ext.renderer, {
	pagingButton: {
		_: function (settings, buttonType, content, active, disabled) {
			var classes = DataTable.ext.classes.paging;
			var btnClasses = [classes.button];
			var btn;

			if (active) {
				btnClasses.push(classes.active);
			}

			if (disabled) {
				btnClasses.push(classes.disabled)
			}

			if (buttonType === 'ellipsis') {
				btn = $('<span class="ellipsis"></span>').html(content)[0];
			}
			else {
				btn = $('<button>', {
					class: btnClasses.join(' '),
					role: 'link',
					type: 'button'
				}).html(content);
			}

			return {
				display: btn,
				clicker: btn
			}
		}
	},

	pagingContainer: {
		_: function (settings, buttons) {
			// No wrapping element - just append directly to the host
			return buttons;
		}
	}
});

// #endregion
// #region ext.filter.js

// Common function to remove new lines, strip HTML and diacritic control
var _filterString = function (stripHtml) {
	return function (str) {
		if (_empty(str) || typeof str !== 'string') {
			return str;
		}

		str = str.replace(_re_new_lines, " ");

		if (stripHtml) {
			str = _stripHtml(str);
		}

		str = _normalize(str);

		return str;
	};
}

// #endregion
// #region ext.types.js

var _extTypes = DataTable.ext.type;

// Get / set type
DataTable.type = function (name, prop, val) {
	if (!prop) {
		return {
			className: _extTypes.className[name],
			detect: _extTypes.detect.find(function (fn) {
				return fn.name === name;
			}),
			order: {
				pre: _extTypes.order[name + '-pre'],
				asc: _extTypes.order[name + '-asc'],
				desc: _extTypes.order[name + '-desc']
			},
			render: _extTypes.render[name],
			search: _extTypes.search[name]
		};
	}

	var setProp = function (prop, propVal) {
		_extTypes[prop][name] = propVal;
	};
	var setDetect = function (detect) {
		// `detect` can be a function or an object - we set a name
		// property for either - that is used for the detection
		Object.defineProperty(detect, "name", { value: name });

		var idx = _extTypes.detect.findIndex(function (item) {
			return item.name === name;
		});

		if (idx === -1) {
			_extTypes.detect.unshift(detect);
		}
		else {
			_extTypes.detect.splice(idx, 1, detect);
		}
	};
	var setOrder = function (obj) {
		_extTypes.order[name + '-pre'] = obj.pre; // can be undefined
		_extTypes.order[name + '-asc'] = obj.asc; // can be undefined
		_extTypes.order[name + '-desc'] = obj.desc; // can be undefined
	};

	// prop is optional
	if (val === undefined) {
		val = prop;
		prop = null;
	}

	if (prop === 'className') {
		setProp('className', val);
	}
	else if (prop === 'detect') {
		setDetect(val);
	}
	else if (prop === 'order') {
		setOrder(val);
	}
	else if (prop === 'render') {
		setProp('render', val);
	}
	else if (prop === 'search') {
		setProp('search', val);
	}
	else if (!prop) {
		if (val.className) {
			setProp('className', val.className);
		}

		if (val.detect !== undefined) {
			setDetect(val.detect);
		}

		if (val.order) {
			setOrder(val.order);
		}

		if (val.render !== undefined) {
			setProp('render', val.render);
		}

		if (val.search !== undefined) {
			setProp('search', val.search);
		}
	}
}

// Get a list of types
DataTable.types = function () {
	return _extTypes.detect.map(function (fn) {
		return fn.name;
	});
};

//
// Built in data types
//

DataTable.type('string', {
	detect: function () {
		return 'string';
	},
	order: {
		pre: function (a) {
			// This is a little complex, but faster than always calling toString,
			// http://jsperf.com/tostring-v-check
			return _empty(a) && typeof a !== 'boolean' ?
				'' :
				typeof a === 'string' ?
					a.toLowerCase() :
					!a.toString ?
						'' :
						a.toString();
		}
	},
	search: _filterString(false)
});

// #endregion
// #region ext.sorting.js


var __numericReplace = function (d, re1, re2) {
	if (d !== 0 && (!d || d === '-')) {
		return -Infinity;
	}

	var type = typeof d;

	if (type === 'number' || type === 'bigint') {
		return d;
	}

	if (d.replace) {
		if (re1) {
			d = d.replace(re1, '');
		}

		if (re2) {
			d = d.replace(re2, '');
		}
	}

	return d * 1;
};

// #endregion
// #region ext.renderer.js


$.extend(true, DataTable.ext.renderer, {
	footer: {
		_: function (settings, cell, classes) {
			cell.addClass(classes.tfoot.cell);
		}
	},

	header: {
		_: function (settings, cell, classes) {
			cell.addClass(classes.thead.cell);

			if (!settings.features.ordering) {
				cell.addClass(classes.order.none);
			}

			// Conditions to not apply the ordering icons
			if (
				// Cells and rows which have the attribute to disable the icons
				cell.attr('data-dt-order') === 'disable' ||
				cell.parent().attr('data-dt-order') === 'disable'
			) {
				return;
			}

			// No additional mark-up required
			// Attach a sort listener to update on sort - note that using the
			// `DT` namespace will allow the event to be removed automatically
			// on destroy, while the `dt` namespaced event is the one we are
			// listening for
			$(settings.tableElement).on('order.dt.DT column-visibility.dt.DT', function (e, ctx) {
				if (settings !== ctx) { // need to check this this is the host
					return;               // table, not a nested one
				}

				var sorting = ctx.sortDetails;

				if (!sorting) {
					return;
				}

				var i;
				var orderClasses = classes.order;
				var columns = ctx.api.columns(cell);
				var col = settings.columns[columns.flatten()[0]];
				var orderable = columns.orderable().includes(true);
				var ariaType = '';
				var indexes = columns.indexes();
				var sortDirs = columns.orderable(true).flatten();
				var orderedColumns = _pluck(sorting, 'col');

				cell.removeClass(orderClasses.isAsc + ' ' + orderClasses.isDesc)
					.toggleClass(orderClasses.none, !orderable)
					.toggleClass(orderClasses.canAsc, orderable && sortDirs.includes('asc'))
					.toggleClass(orderClasses.canDesc, orderable && sortDirs.includes('desc'));

				// Determine if all of the columns that this cell covers are included in the
				// current ordering
				var isOrdering = true;

				for (i = 0; i < indexes.length; i++) {
					if (!orderedColumns.includes(indexes[i])) {
						isOrdering = false;
					}
				}

				if (isOrdering) {
					// Get the ordering direction for the columns under this cell
					// Note that it is possible for a cell to be asc and desc sorting
					// (column spanning cells)
					var orderDirs = columns.order();

					cell.addClass(
						orderDirs.includes('asc') ? orderClasses.isAsc : '' +
							orderDirs.includes('desc') ? orderClasses.isDesc : ''
					);
				}

				// Find the first visible column that has ordering applied to it - it get's
				// the aria information, as the ARIA spec says that only one column should
				// be marked with aria-sort
				var firstVis = orderedColumns[0];

				if (indexes[0] == firstVis) {
					var firstSort = sorting[0];
					var sortOrder = col.orderSequence;

					cell.attr('aria-sort', firstSort.dir === 'asc' ? 'ascending' : 'descending');

					// Determine if the next click will remove sorting or change the sort
					ariaType = !sortOrder[firstSort.index + 1] ? 'Remove' : 'Reverse';
				}
				else {
					cell.removeAttr('aria-sort');
				}

				cell.attr('aria-label', orderable
					? col.ariaTitle + ctx.api.i18n('oAria.orderable' + ariaType)
					: col.ariaTitle
				);

				// Make the headers tab-able for keyboard navigation
				if (orderable) {
					cell.find('.dt-column-title').attr('role', 'button');
					cell.attr('tabindex', 0)
				}
			});
		}
	},

	layout: {
		_: function (settings, container, items) {
			var classes = DataTable.ext.classes.layout;

			var row = document.createElement('div');
			row.id = items.id || null;
			row.className = items.className || classes.row;
			container.appendChild(row);

			for (const [key, val] of Object.entries(items)) {
				if (key === 'id' || key === 'className') {
					continue;
				}

				var klass = '';

				if (val.table) {
					row.classList.add(classes.tableRow);
					klass += classes.tableCell + ' ';
				}

				if (key === 'start') {
					klass += classes.start;
				}
				else if (key === 'end') {
					klass += classes.end;
				}
				else {
					klass += classes.full;
				}

				$('<div/>')
					.attr({
						id: val.id || null,
						"class": val.className
							? val.className
							: classes.cell + ' ' + klass
					})
					.append(val.contents)
					.appendTo(row);
			}
		}
	}
});

// #endregion

// #region features.api.js

DataTable.feature = {};

// Third parameter is internal only!
DataTable.feature.register = function (name, cb, legacy) {
	DataTable.ext.features[name] = cb;

	if (legacy) {
		_ext.feature.push({
			cFeature: legacy,
			fnInit: cb
		});
	}
};

// #endregion
// #region features.div.js

function _divProp(el, prop, val) {
	if (val) {
		el[prop] = val;
	}
}

DataTable.feature.register('div', function (settings, opts) {
	var n = $('<div>')[0];

	if (opts) {
		_divProp(n, 'className', opts.className);
		_divProp(n, 'id', opts.id);
		_divProp(n, 'innerHTML', opts.html);
		_divProp(n, 'textContent', opts.text);
	}

	return n;
});

// #endregion
// #region features.info.js

DataTable.feature.register('info', function (settings, opts) {
	var
		lang = settings.language,
		tid = settings.tableId,
		n = $('<div/>', {
			'class': DataTable.ext.classes.info.container,
		});

	opts = $.extend({
		callback: null,
		empty: lang.sInfoEmpty,
		search: lang.sInfoFiltered,
		text: lang.sInfo,
	}, opts);


	// Update display on each draw
	settings.drawCallbacks.push(function (s) {
		_fnUpdateInfo(s, opts, n);
	});

	// For the first info display in the table, we add a callback and aria information.
	if (!settings._infoEl) {
		n.attr({
			'aria-live': 'polite',
			id: tid + '_info',
			role: 'status'
		});

		// Table is described by our info div
		$(settings.tableElement).attr('aria-describedby', tid + '_info');

		settings._infoEl = n;
	}

	return n;
}, 'i');

/**
 * Update the information elements in the display
 *  @param {object} settings dataTables settings object
 *  @memberof DataTable#oApi
 */
function _fnUpdateInfo(settings, opts, node) {
	var
		start = settings._displayStart + 1,
		end = settings.displayEnd(),
		max = settings.total(),
		total = settings.totalDisplayed(),
		out = total
			? opts.text
			: opts.empty;

	if (total !== max) {
		// Record set after filtering
		out += ' ' + opts.search;
	}

	// Convert the macros
	out = _fnMacros(settings, out);

	if (opts.callback) {
		out = opts.callback.call(settings.instance,
			settings, start, end, max, total, out
		);
	}

	node.html(out);

	_fnCallbackFire(settings, null, 'info', [settings, node[0], out]);
}

// #endregion
// #region features.search.js

var __searchCounter = 0;

// opts
// - text
// - placeholder
DataTable.feature.register('search', function (settings, opts) {
	// Don't show the input if filtering isn't available on the table
	if (!settings.features.searching) {
		return null;
	}

	var classes = DataTable.ext.classes.search;
	var tableId = settings.tableId;
	var language = settings.language;
	var searchText = settings.searchText;
	var input = '<input type="search" class="' + classes.input + '"/>';

	opts = $.extend({
		processing: false,
		text: language.sSearch
	}, opts);

	// The _INPUT_ is optional - is appended if not present
	if (opts.text.indexOf('_INPUT_') === -1) {
		opts.text += '_INPUT_';
	}

	opts.text = _fnMacros(settings, opts.text);

	// We can put the <input> outside of the label if it is at the start or end
	// which helps improve accessability (not all screen readers like implicit
	// for elements).
	var end = opts.text.match(/_INPUT_$/);
	var start = opts.text.match(/^_INPUT_/);
	var removed = opts.text.replace(/_INPUT_/, '');
	var str = '<label>' + opts.text + '</label>';

	if (start) {
		str = '_INPUT_<label>' + removed + '</label>';
	}
	else if (end) {
		str = '<label>' + removed + '</label>_INPUT_';
	}

	var filter = $('<div>')
		.addClass(classes.container)
		.append(str.replace(/_INPUT_/, input));

	// add for and id to label and input
	filter.find('label').attr('for', 'dt-search-' + __searchCounter);
	filter.find('input').attr('id', 'dt-search-' + __searchCounter);
	__searchCounter++;

	var searchFn = function (event) {
		var val = this.value;

		/* Now do the filter */
		if (val != searchText) {
			_fnProcessingRun(settings, opts.processing, function () {
				searchText = val;

				_fnFilterComplete(settings, searchText);

				// Need to redraw, without resorting
				settings._displayStart = 0;
				_fnDraw(settings);
			});
		}
	};

	var jqFilter = $('input', filter)
		.val(searchText)
		.attr('placeholder', "")
		.on('keyup.DT search.DT input.DT paste.DT cut.DT', searchFn)
		.on('mouseup.DT', function (e) {
			// Edge fix! Edge 17 does not trigger anything other than mouse events when clicking
			// on the clear icon (Edge bug 17584515). This is safe in other browsers as `searchFn`
			// checks the value to see if it has changed. In other browsers it won't have.
			setTimeout(function () {
				searchFn.call(jqFilter[0], e);
			}, 10);
		})
		.on('keypress.DT', function (e) {
			/* Prevent form submission */
			if (e.keyCode == 13) {
				return false;
			}
		})
		.attr('aria-controls', tableId);

	// Update the input elements whenever the table is filtered
	$(settings.tableElement).on('search.dt.DT', function (ev, s) {
		if (settings === s && jqFilter[0] !== document.activeElement) {
			jqFilter.val(typeof searchText !== 'function'
				? searchText
				: ''
			);
		}
	});

	return filter;
}, 'f');

// #endregion
// #region features.page.js

// opts
// - type - button configuration
// - buttons - number of buttons to show - must be odd
DataTable.feature.register('paging', function (settings, opts) {
	// Don't show the paging input if the table doesn't have paging enabled
	if (!settings.features.paging) {
		return null;
	}

	opts = $.extend({
		buttons: DataTable.ext.pager.numbers_length,
		boundaryNumbers: true,
		firstLast: true,
		previousNext: true,
		numbers: true
	}, opts);

	// create the host element for the controls
	const host = document.createElement('div');
	host.classList.add('dt-paging');
	const nav = document.createElement('nav');
	nav.setAttribute('aria-label', 'pagination');
	host.appendChild(nav);

	var draw = function () {
		_pagingDraw(settings, host.children, opts);
	};

	settings.drawCallbacks.push(draw);

	// Responsive redraw of paging control
	$(settings.tableElement).on('column-sizing.dt.DT', draw);

	return host;
}, 'p');

/**
 * Dynamically create the button type array based on the configuration options.
 * This will only happen if the paging type is not defined.
 */
function _pagingDynamic(opts) {
	var out = [];

	if (opts.numbers) {
		out.push('numbers');
	}

	if (opts.previousNext) {
		out.unshift('previous');
		out.push('next');
	}

	if (opts.firstLast) {
		out.unshift('first');
		out.push('last');
	}

	return out;
}

function _pagingDraw(settings, host, opts) {
	host = $(host);

	if (!settings._bInitComplete) {
		return;
	}

	var
		plugin = opts.type
			? DataTable.ext.pager[opts.type]
			: _pagingDynamic,
		aria = settings.language.oAria.paginate || {},
		start = settings._displayStart,
		len = settings._displayLength,
		visRecords = settings.total(),
		all = len === -1,
		page = all ? 0 : Math.ceil(start / len),
		pages = all ? 1 : Math.ceil(visRecords / len),
		buttons = plugin(opts)
			.map(function (val) {
				return val === 'numbers'
					? _pagingNumbers(page, pages, opts.buttons, opts.boundaryNumbers)
					: val;
			})
			.flat();

	var buttonEls = [];

	for (var i = 0; i < buttons.length; i++) {
		var button = buttons[i];

		var btnInfo = _pagingButtonInfo(settings, button, page, pages);
		var btn = _fnRenderer('pagingButton')(
			settings,
			button,
			btnInfo.display,
			btnInfo.active,
			btnInfo.disabled
		);

		var ariaLabel = typeof button === 'string'
			? aria[button]
			: aria.number
				? aria.number + (button + 1)
				: null;

		// Common attributes
		$(btn.clicker).attr({
			'aria-controls': settings.tableId,
			'aria-disabled': btnInfo.disabled ? 'true' : null,
			'aria-current': btnInfo.active ? 'page' : null,
			'aria-label': ariaLabel,
			'data-dt-idx': button,
			'tabIndex': btnInfo.disabled
				? -1
				: null,
		});

		if (typeof button !== 'number') {
			$(btn.clicker).addClass(button);
		}

		_fnBindAction(
			btn.clicker, { action: button }, function (e) {
				e.preventDefault();

				_fnPageChange(settings, e.data.action);
			}
		);

		buttonEls.push(btn.display);
	}

	var wrapped = _fnRenderer('pagingContainer')(
		settings, buttonEls
	);

	var activeEl = host.find(document.activeElement).data('dt-idx');

	host.empty().append(wrapped);

	if (activeEl !== undefined) {
		host.find('[data-dt-idx=' + activeEl + ']').trigger('focus');
	}

	// Responsive - check if the buttons are over two lines based on the
	// height of the buttons and the container.
	if (
		buttonEls.length && // any buttons
		opts.buttons > 1 && // prevent infinite
		$(host).height() >= ($(buttonEls[0]).outerHeight() * 2) - 10
	) {
		_pagingDraw(settings, host, $.extend({}, opts, { buttons: opts.buttons - 2 }));
	}
}

/**
 * Get properties for a button based on the current paging state of the table
 *
 * @param {*} settings DT settings object
 * @param {*} button The button type in question
 * @param {*} page Table's current page
 * @param {*} pages Number of pages
 * @returns Info object
 */
function _pagingButtonInfo(settings, button, page, pages) {
	var lang = settings.language.oPaginate;
	var o = {
		display: '',
		active: false,
		disabled: false
	};

	switch (button) {
		case 'ellipsis':
			o.display = '&#x2026;';
			o.disabled = true;
			break;

		case 'first':
			o.display = lang.sFirst;

			if (page === 0) {
				o.disabled = true;
			}
			break;

		case 'previous':
			o.display = lang.sPrevious;

			if (page === 0) {
				o.disabled = true;
			}
			break;

		case 'next':
			o.display = lang.sNext;

			if (pages === 0 || page === pages - 1) {
				o.disabled = true;
			}
			break;

		case 'last':
			o.display = lang.sLast;

			if (pages === 0 || page === pages - 1) {
				o.disabled = true;
			}
			break;

		default:
			if (typeof button === 'number') {
				o.display = _formatNumber(button + 1);

				if (page === button) {
					o.active = true;
				}
			}
			break;
	}

	return o;
}

/**
 * Compute what number buttons to show in the paging control
 *
 * @param {*} page Current page
 * @param {*} pages Total number of pages
 * @param {*} buttons Target number of number buttons
 * @param {boolean} addFirstLast Indicate if page 1 and end should be included
 * @returns Buttons to show
 */
function _pagingNumbers(page, pages, buttons, addFirstLast) {
	var
		numbers = [],
		half = Math.floor(buttons / 2),
		before = addFirstLast ? 2 : 1,
		after = addFirstLast ? 1 : 0;

	if (pages <= buttons) {
		numbers = _range(0, pages);
	}
	else if (buttons === 1) {
		// Single button - current page only
		numbers = [page];
	}
	else if (buttons === 3) {
		// Special logic for just three buttons
		if (page <= 1) {
			numbers = [0, 1, 'ellipsis'];
		}
		else if (page >= pages - 2) {
			numbers = _range(pages - 2, pages);
			numbers.unshift('ellipsis');
		}
		else {
			numbers = ['ellipsis', page, 'ellipsis'];
		}
	}
	else if (page <= half) {
		numbers = _range(0, buttons - before);
		numbers.push('ellipsis');

		if (addFirstLast) {
			numbers.push(pages - 1);
		}
	}
	else if (page >= pages - 1 - half) {
		numbers = _range(pages - (buttons - before), pages);
		numbers.unshift('ellipsis');

		if (addFirstLast) {
			numbers.unshift(0);
		}
	}
	else {
		numbers = _range(page - half + before, page + half - after);
		numbers.push('ellipsis');
		numbers.unshift('ellipsis');

		if (addFirstLast) {
			numbers.push(pages - 1);
			numbers.unshift(0);
		}
	}

	return numbers;
}

// #endregion
// #region features.pageLength.js

var __lengthCounter = 0;

// opts
// - menu
// - text
DataTable.feature.register('pageLength', function (settings, opts) {
	var features = settings.features;

	// For compatibility with the legacy `pageLength` top level option
	if (!features.paging) {
		return null;
	}

	opts = $.extend({
		menu: settings.lengthMenu,
		text: settings.language.sLengthMenu
	}, opts);

	var
		classes = DataTable.ext.classes.length,
		tableId = settings.tableId,
		menu = opts.menu,
		lengths = [],
		language = [];

	for (let i = 0; i < menu.length; i++) {
		lengths.push(menu[i]);
		language.push(menu[i]);
	}

	// We can put the <select> outside of the label if it is at the start or
	// end which helps improve accessability (not all screen readers like
	// implicit for elements).
	var end = opts.text.match(/_MENU_$/);
	var start = opts.text.match(/^_MENU_/);
	var removed = opts.text.replace(/_MENU_/, '');

	var str = `<label>${opts.text}</label>`;
	if (start) {
		str = `_MENU_<label>${removed}</label>`;
	}
	else if (end) {
		str = `<label>${removed}</label>_MENU_`;
	}

	// Wrapper element - use a span as a holder for where the select will go
	var tmpId = `tmp-` + (+new Date())
	var div = document.createElement('div');
	div.classList.add(classes.container);
	div.innerHTML = str.replace('_MENU_', `<span id="${tmpId}"></span>`);

	// Save text node content for macro updating
	var textNodes = [];
	div.querySelector('label').childNodes.forEach(function (el) {
		if (el.nodeType === Node.TEXT_NODE) {
			textNodes.push({
				el: el,
				text: el.textContent
			});
		}
	});

	// Update the label text in case it has an entries value
	var updateEntries = function (len) {
		textNodes.forEach(function (node) {
			node.el.textContent = _fnMacros(settings, node.text, len);
		});
	}

	// Next, the select itself, along with the options
	const select = document.createElement('select');
	select.setAttribute('name', tableId + '_length');
	select.setAttribute('aria-controls', tableId);
	select.className = classes.select;

	for (let i = 0; i < lengths.length; i++) {
		select[i] = new Option(
			_formatNumber(language[i]),
			lengths[i]
		);
	}

	// add for and id to label and input
	div.querySelector('label').setAttribute('for', 'dt-length-' + __lengthCounter);
	select.id = 'dt-length-' + __lengthCounter;
	__lengthCounter++;

	// Swap in the select list
	div.querySelector('#' + tmpId).replaceWith(select);

	// Can't use `select` variable as user might provide their own and the
	// reference is broken by the use of outerHTML
	select.value = settings._displayLength;
	select.addEventListener('change', function () {
		_fnLengthChange(settings, this.value);
		_fnDraw(settings);
	});

	// Update node value whenever anything changes the table's length
	settings.tableElement.addEventListener('length.dt.DT', function (e) {
		if (settings === e.detail.settings) {
			div.querySelector('select').value = e.detail.len;

			// Resolve plurals in the text for the new length
			updateEntries(e.detail.len);
		}
	});

	updateEntries(settings._displayLength);

	return div;
}, 'l');

// #endregion

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

export default DataTable;
