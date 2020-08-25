// based on https://github.com/dobtco/jquery-resizable-columns
angular.module('ngTableResizableColumns', [])
    .factory('ngTableResizableColumnsHelper', ['$compile', '$timeout', function ($compile, $timeout) {

        var parseWidth = function (node, mode) {
            var suffix = (!mode || mode == MODE_PERCENTAGE) ? '%' : 'px';
            return parseFloat(node.style.width.replace(suffix, ''));
        }, parseWidthEx = function (node, mode) {
            var width = parseWidth(node, mode);
            if (isNaN(width) && mode == MODE_ABSOLUTE) {
                width = $(node).outerWidth();
            }
            return width;
        }, setWidth = function (node, width, mode, minWidth) {
            if (minWidth != undefined && minWidth != null && width < minWidth) {
                width = minWidth
            }
            var suffix = (!mode || mode == MODE_PERCENTAGE) ? '%' : 'px';
            return node.style.width = "" + width.toFixed(3) + suffix;
        }, pointerX = function (e) {
            return (e.type.indexOf('touch') === 0) ? (e.originalEvent.touches[0] || e.originalEvent.changedTouches[0]).pageX : e.pageX;
        };

        function injectAndReturn(module) {
            try {
                var moduleNameParts = module.split(':');
                var ngModule = moduleNameParts[0], seviceName = moduleNameParts[1];
                var injector = angular.element(document).injector(ngModule);
                return injector.get(seviceName);
            } catch (exc) {
                console.error(exc);
                return null;
            }
        }

        var DEFAULT_SCOPE_RECREATE_EVENT_NAME = 'ng-table-resizable-columns-update';
        var MODE_PERCENTAGE = 'percent';
        var MODE_ABSOLUTE = 'absolute';
        function ResizableColumns($table, scope, config) {
            var __bind = function (fn, me) {
                return function () {
                    return fn.apply(me, arguments);
                };
            };

            this.saveRestoreService = null;
            if (config.saveRestoreService) {
                this.saveRestoreService = injectAndReturn(config.saveRestoreService);
            } else if (window.store) {
                this.saveRestoreService = angular.element(document).injector().get('ngTableResizableColumnsSaveRestoreStoreService');
            }
            this.widthCalculateService = null;
            if (config.widthCalculateService) {
                this.widthCalculateService = injectAndReturn(config.widthCalculateService);
            } else {
                this.widthCalculateService = angular.element(document).injector().get('ngTableResizableColumnsWidthCalculateService');
            }
            this.columnCellsSelector = null;
            if (config.columnCellsSelector) {
                this.columnCellsSelector = injectAndReturn(config.columnCellsSelector);
            } else {
                this.columnCellsSelector = angular.element(document).injector().get('ngTableResizableColumnsDefaultColumnCellsSelector');
            }

            this.pointerdown = __bind(this.pointerdown, this);
            this.doubleClick = __bind(this.doubleClick, this);
            var _this = this;
            this.options = {
                customReloadEvent: config.customReloadEvent,
                scopeReloadEvent: config.customReloadEvent || DEFAULT_SCOPE_RECREATE_EVENT_NAME,
                rigidSizing: false,
                resizeFromBody: !!config.resizeFromBody,
                //mode: config.mode || MODE_PERCENTAGE
                mode: config.mode || MODE_ABSOLUTE,
                minColumnWidth: config.minColumnWidth == undefined || config.minColumnWidth == null ? 0 : parseFloat(config.minColumnWidth)
            };
            this.$table = $table;
            if (this.options.mode == MODE_ABSOLUTE) {
                this.$table[0].style.tableLayout = 'fixed';
            }
            this.state = 0;
            this.unwatchOn = null;
            var unwatch = scope.$watch('params', function (newParams, oldParams) {
                if (!newParams.isNullInstance) {
                    if (_this.state == 2) { //destroyed
                        return;
                    }
                    _this.setHeaders();
                    _this.restoreColumnWidths();
                    _this.syncHandleWidths(true);
                    _this.state = 1;
                    
                    _this.$table.scope().$emit('columns-widths-restoration-complete');

                    var timeoutPromise;
                    var syncHandleWidthsThrottled = function () {
                        if (timeoutPromise) {
                            $timeout.cancel(timeoutPromise);
                        }
                        timeoutPromise = $timeout(function () {
                            if (_this.state == 2) { //destroyed
                                return;
                            }
                            _this.calculateColumnWidthsIfNotSaved(true);
                            _this.syncHandleWidths(true);
                        }, 100);
                    };

                    if (!_this.options.customReloadEvent) {
                        $(window).on('resize.rc', syncHandleWidthsThrottled);
                    }
                    _this.unwatchOn = _this.$table.scope().$on(_this.options.scopeReloadEvent, syncHandleWidthsThrottled);
                    unwatch();
                }
            });
        }

        ResizableColumns.prototype.getColumnId = function ($el) {
            return this.$table.data('resizable-columns-id') + '-' + $el.data('resizable-column-id');
        };

        ResizableColumns.prototype.setHeaders = function () {
            this.$tableHeaders = this.$table.children('thead').find('tr:first th:visible');
            this.assignPercentageWidths();
            return this.createHandles();
        };

        ResizableColumns.prototype.filteredHeaders = function () {
            return this.$tableHeaders.filter(function (_, el) {
                return !$(el).attr('data-noresize');
            });
        };

        ResizableColumns.prototype.destroy = function () {
            if (this.state == 2) {
                return;
            }
            if (this.state == 1 && this.$handleContainer) {
                this.$handleContainer.remove();
            }
            this.$table.removeData('resizableColumns');
            this.state = 2;
            if (this.unwatchOn) {
                this.unwatchOn();
            }
            return $(window).off('.rc');
        };

        ResizableColumns.prototype.assignPercentageWidths = function () {
            var _this = this;
            return this.filteredHeaders()
                .each(function (_, el) {
                    var $el;
                    $el = $(el);
                    var width = _this.options.mode == MODE_PERCENTAGE ? $el.outerWidth() * 100 / _this.$table.outerWidth() : $el.outerWidth();
                    return setWidth($el[0], width, _this.options.mode, _this.options.minColumnWidth);
                });
        };

        ResizableColumns.prototype.createHandles = function () {
            var _ref,
                _this = this;
            if ((_ref = this.$handleContainer) != null) {
                _ref.remove();
            }
            this.$table.before((this.$handleContainer = $("<div class='rc-handle-container' />")));
            var scope = angular.element(_this.$handleContainer).scope();
            if (scope) {
                $compile(_this.$handleContainer)(scope);
            }
            var checkHasNext = this.options.mode == MODE_PERCENTAGE;
            this.$tableHeaders.each(function (i, el) {
                var $handle;
                if ((checkHasNext && _this.$tableHeaders.eq(i + 1).length === 0)
                    || _this.$tableHeaders.eq(i).attr('data-noresize')
                    || _this.$tableHeaders.eq(i + 1).attr('data-noresize')) {
                    return;
                }
                $handle = $("<div class='rc-handle'><div></div></div>");
                $handle.data('th', $(el));
                return $handle.appendTo(_this.$handleContainer);
            });
            this.$handleContainer.on('dblclick', '.rc-handle', this.doubleClick);
            return this.$handleContainer.on('mousedown touchstart', '.rc-handle', this.pointerdown);
        };

        ResizableColumns.prototype.syncHandleWidths = function (initial) {
            var _this = this;
            if (initial) {
                this.setHeaders();
            } else if (this.options.mode == MODE_PERCENTAGE) {
                this.assignPercentageWidths();
            }
            var $handles = this.$handleContainer.width(this.$table.outerWidth()).find('.rc-handle');
            $handles.each(function (_, el) {
                var $el;
                $el = $(el);
                return $el.css({
                    left: $el.data('th').outerWidth() + ($el.data('th').offset().left - _this.$handleContainer.offset().left),
                    height: _this.options.resizeFromBody ? _this.$table.height() : _this.$table.children('thead').height()
                });
            });
            if (!initial) {
                _this.$table.scope().$emit('ng-table-columns-widths-changed');
            }
            return $handles;
        };

        ResizableColumns.prototype.saveColumnWidths = function () {
            var _this = this;
            if (_this.saveRestoreService != null && this.$table.data('resizable-columns-id')) {
                var widthsJQ = this.filteredHeaders()
                    .map(function (_, el) {
                        var $el;
                        $el = $(el);
                        return {
                            id: _this.getColumnId($el),
                            width: parseWidth($el[0], _this.options.mode),
                            mode: _this.options.mode
                        };
                    });
                _this.saveRestoreService.set(this.$table.data('resizable-columns-id'), widthsJQ.get());
                return widthsJQ;
            }
            return this.$tableHeaders;
        };

        ResizableColumns.prototype.restoreColumnWidths = function () {
            var _this = this;
            if (_this.saveRestoreService != null && this.$table.data('resizable-columns-id')) {
                var widths = _this.saveRestoreService.get(this.$table.data('resizable-columns-id'));
                var widthsDict = {};
                if (widths && widths.length) {
                    widthsDict = widths.reduce(function (result, nextCol) {
                        var colMode = nextCol.mode || MODE_PERCENTAGE;
                        if (colMode == _this.options.mode) {
                            result[nextCol.id] = nextCol.width;
                        } else {
                            switch (_this.options.mode) {
                                case MODE_PERCENTAGE:
                                    switch (nextCol.mode) {
                                        case MODE_ABSOLUTE:
                                            //let's assume the saved absolute width have been calculated for the same table total width
                                            result[nextCol.id] = nextCol.width * 100 / _this.$table.outerWidth();
                                            break;
                                    }
                                    break;
                                case MODE_ABSOLUTE:
                                    switch (nextCol.mode) {
                                        case MODE_PERCENTAGE:
                                            //let's assume the saved percentage width have been calculated for the same table total width
                                            result[nextCol.id] = nextCol.width * _this.$table.outerWidth() / 100;
                                            break;
                                    }
                                    break;
                            }
                        }
                        return result;
                    }, {});
                } else if (this.options.mode == MODE_ABSOLUTE) {
                    widthsDict = this.calculateColumnWidths();
                }
                return this.applyColumnWidths(widthsDict);
            }
            return this.$tableHeaders;
        };
        ResizableColumns.prototype.applyColumnWidths = function (widthsDict) {
            var _this = this;

            this.filteredHeaders().each(function (_, el) {
                var $el, width;
                $el = $(el);
                if ((width = widthsDict[_this.getColumnId($el)])) {
                    return setWidth($el[0], width, _this.options.mode, _this.options.minColumnWidth);
                }
            });
            if (this.options.mode == MODE_ABSOLUTE) {
                setWidth(this.$table[0], this.totalColumnWidths(), this.options.mode, _this.options.minColumnWidth);
            }
            return this.$tableHeaders;
        };

        ResizableColumns.prototype.calculateColumnWidths = function (save) {
            var _this = this;
            var widthsDict = this.$tableHeaders
                .get()
                .reduce(function (result, header) {
                    var $header = $(header);
                    var maxWidth = _this.getMaxWidthFromColumn($header, 2);
                    result[_this.getColumnId($header)] = maxWidth;
                    return result;
                }, {});
            if (save) {
                var widths = Object.keys(widthsDict).map(function (colId) {
                    return {
                        id: colId,
                        width: widthsDict[colId],
                        mode: _this.options.mode
                    };
                });
                _this.saveRestoreService.set(_this.$table.data('resizable-columns-id'), widths);
            }
            return widthsDict;
        };

        ResizableColumns.prototype.calculateColumnWidthsIfNotSaved = function (save) {
            var _this = this;
            if (_this.saveRestoreService != null && _this.$table.data('resizable-columns-id')) {
                var widths = _this.saveRestoreService.get(_this.$table.data('resizable-columns-id'));
                if (widths && widths.length) {
                    return;
                }
            }
            return _this.calculateColumnWidths(save);
        };

        ResizableColumns.prototype.totalColumnWidths = function () {
            var total,
                _this = this;
            total = 0;
            this.$tableHeaders.each(function (_, el) {
                return total += parseWidthEx(el, _this.options.mode);
            });
            return total;
        };

        ResizableColumns.prototype.updatePercentageWidths = function ($rightColumn, $leftColumn, widths, difference) {
            setWidth($rightColumn[0], widths.right - difference, this.options.mode, this.options.minColumnWidth);
            return setWidth($leftColumn[0], widths.left + difference);
        };

        ResizableColumns.prototype.updateAbsoluteWidths = function ($leftColumn, widths, difference) {
            setWidth($leftColumn[0], widths.left + difference, this.options.mode, this.options.minColumnWidth);
            return setWidth(this.$table[0], widths.table + difference, this.options.mode);
        };

        ResizableColumns.prototype.pointerdown = function (e) {
            var $currentGrip, $leftColumn, $rightColumn, startPosition, widths,
                _this = this;
            e.preventDefault();
            startPosition = pointerX(e);
            $currentGrip = $(e.currentTarget);
            $leftColumn = $currentGrip.data('th');
            widths = {
                left: parseWidth($leftColumn[0], this.options.mode)
            };
            if (_this.options.mode == MODE_PERCENTAGE) {
                $rightColumn = this.$tableHeaders.eq(this.$tableHeaders.index($leftColumn) + 1);
                widths.right = parseWidth($rightColumn[0], this.options.mode);
            } else {
                widths.table = parseWidth(this.$table[0], this.options.mode);
            }
            this.$table.addClass('rc-table-resizing');
            this.$handleContainer.addClass('rc-table-resizing');
            $currentGrip.addClass('rc-handle-active');
            $(document).on('mousemove.rc touchmove.rc', function (e) {
                var difference;
                if (_this.options.mode == MODE_PERCENTAGE) {
                    difference = (pointerX(e) - startPosition) / _this.$table.outerWidth() * 100;
                    return _this.updatePercentageWidths($leftColumn, $rightColumn, widths, difference);
                } else {
                    difference = pointerX(e) - startPosition;
                    return _this.updateAbsoluteWidths($leftColumn, widths, difference);
                }
            });
            return $(document).one('mouseup touchend', function () {
                $(document).off('mousemove.rc touchmove.rc');
                _this.$table.removeClass('rc-table-resizing');
                _this.$handleContainer.removeClass('rc-table-resizing');
                $currentGrip.removeClass('rc-handle-active');
                _this.syncHandleWidths(false);
                return _this.saveColumnWidths();
            });
        };
        ResizableColumns.prototype.doubleClick = function (e) {
            var $currentGrip, $leftColumn, widths,
                _this = this;
            e.preventDefault();

            $currentGrip = $(e.currentTarget);
            $leftColumn = $currentGrip.data('th');
            widths = {
                left: parseWidth($leftColumn[0], _this.options.mode)
            };
            widths.table = parseWidth(_this.$table[0], _this.options.mode);
            var max = _this.getMaxWidthFromColumn($leftColumn);
            _this.updateAbsoluteWidths($leftColumn, widths, max - widths.left);
            _this.syncHandleWidths(false);
            return _this.saveColumnWidths();
        };
        ResizableColumns.prototype.getMaxWidthFromColumn = function ($columnHeader, cellsCount) {
            var _this = this;
            var index = $columnHeader.index();
            var headerCellId = _this.getColumnId($columnHeader).replace(/[^\w]/g, '-');
            var columnCellId = headerCellId + '-c';

            var cells = _this.columnCellsSelector.getColumnCells(_this.$table, index, cellsCount);
            var tds = cells.add($columnHeader)
                .each(function (_, col) {
                    var name = col == $columnHeader[0] ? headerCellId : columnCellId;
                    var colContentImmutableFlag = $(col).data('resizable-columns-col-immutable');
                    var colContentImmutable = colContentImmutableFlag != null ? colContentImmutableFlag : true;
                    _this.widthCalculateService.recalculateWidth(col, name, colContentImmutable);
                })
                .map(function (_, col) {
                    return $(col).data('overflowWidth');
                });

            var max = tds.get().reduce(function (retVal, currentVal) {
                return Math.max(retVal, currentVal);
            }, 0);
            return max;
        };

        return ResizableColumns;
    }])

    .directive('ngTableResizableColumnsDynamic', ['$timeout', 'ngTableResizableColumnsHelper', function ($timeout, ngTableResizableColumnsHelper) {
        return {
            restrict: 'C',
            priority: 999,
            require: 'ngTableDynamic',
            link: function (scope, element, args, ngTable) {
                var data;
                var initPromise = null;
                function reload() {
                    if (initPromise) {
                        $timeout.cancel(initPromise);
                    }
                    if (data) {
                        data.destroy();
                        data = null;
                    }
                    initPromise = $timeout(function () {
                        data = new ngTableResizableColumnsHelper(element, scope, config);
                    });
                }
                var config = {
                    customReloadEvent: args.ntrcCustomReloadEvent,
                    saveRestoreService: args.ntrcSaveRestoreService,
                    widthCalculateService: args.ntrcWidthCalculateService,
                    resizeFromBody: args.ntrcResizeFromBody,
                    mode: args.ntrcMode,
                    columnCellsSelector: args.ntrcColumnCellsSelector,
                    minColumnWidth: args.ntrcMinColumnWidth
                };
                scope.$watch('$data', reload);
                args.ngTableDynamic.split(' with ').forEach(function (paramName) {
                    scope.$watch(paramName, reload, true);
                });
                reload();
            }
        };
    }])

    .directive('ngTableResizableColumns', ['$timeout', 'ngTableResizableColumnsHelper', function ($timeout, ngTableResizableColumnsHelper) {
        return {
            restrict: 'C',
            priority: 999,
            require: 'ngTable',
            link: function (scope, element, args, ngTable) {
                var data;
                var initPromise = null;
                function reload() {
                    if (initPromise) {
                        $timeout.cancel(initPromise);
                    }
                    if (data) {
                        data.destroy();
                        data = null;
                    }
                    initPromise = $timeout(function () {
                        data = new ngTableResizableColumnsHelper(element, scope, config);
                    });
                }
                var config = {
                    customReloadEvent: args.ntrcCustomReloadEvent,
                    saveRestoreService: args.ntrcSaveRestoreService,
                    widthCalculateService: args.ntrcWidthCalculateService,
                    resizeFromBody: args.ntrcResizeFromBody,
                    mode: args.ntrcMode,
                    columnCellsSelector: args.ntrcColumnCellsSelector,
                    minColumnWidth: args.ntrcMinColumnWidth
                };
                scope.$watch('$data', reload);
                scope.$watch(args.ngTable, reload, true);
                reload();
            }
        };
    }])
    .service('ngTableResizableColumnsSaveRestoreStoreService', function () {
        var self = this;
        var store = windows.store;
        self.get = function (tableID) {
            if (store) {
                return store.get(tableID);
            }
            return null;
        };
        self.set = function (tableID, columnsWidthsArray) {
            if (store) {
                store.set(tableID, columnsWidthsArray);
            }
        };
    })
    .service('ngTableResizableColumnsWidthCalculateService', function () {
        var self = this;
        self.recalculateWidth = function (element, name, immutable) {
            var $element = $(element);
            if (immutable) {
                var storedWidth = $element.data('resizable-columns-col-width-' + name);
                if (!storedWidth) {
                    storedWidth = $element.outerWidth();
                    $element.data('resizable-columns-col-width-' + name, storedWidth);
                }
                return storedWidth;
            }
            return $element.outerWidth();
        };
    })
    .service('ngTableResizableColumnsDefaultColumnCellsSelector', function () {
        var self = this;
        self.getColumnCells = function (table, cellIndex, cellsCount) {
            var trs = table.children('tbody[ng-repeat]').children('tr');
            trs = trs.add(table.children('tbody').children('tr[ng-repeat]'));

            var tds = trs.children('td:nth-child(' + (cellIndex + 1) + ')')
            if (cellsCount) {
                tds = tds.slice(0, cellsCount);
            }

            return tds;
        };
    });
