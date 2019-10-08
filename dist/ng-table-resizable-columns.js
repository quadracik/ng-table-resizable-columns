// based on https://github.com/dobtco/jquery-resizable-columns
angular.module('ngTableResizableColumns', [])
  .factory('ngTableResizableColumnsHelper', function () {

    var parseWidth = function(node) {
        return parseFloat(node.style.width.replace('%', ''));
    }, setWidth = function(node, width) {
        return node.style.width = "" + width.toFixed(3) + "%";
    }, pointerX = function(e) {
        return (e.type.indexOf('touch') === 0) ? (e.originalEvent.touches[0] || e.originalEvent.changedTouches[0]).pageX : e.pageX;
    };

    var DEFAULT_SCOPE_RECREATE_EVENT_NAME = 'ng-table-resizable-columns-update';
    function ResizableColumns($table, scope, config) {
      var __bind = function(fn, me){
        return function(){
          return fn.apply(me, arguments);
        };
      };

      this.saveRestoreService = null;
      if (config.saveRestoreService) {
        var moduleService = config.saveRestoreService.split(':');
        var ngModule = moduleService[0], seviceName = moduleService[1];
          var injector = angular.element(document).injector(ngModule);
          this.saveRestoreService = injector.get(seviceName);
      } else if (window.store) {
        this.saveRestoreService = angular.injector().get('ngTableResizableColumnsSaveRestoreStoreService');
      }

      this.pointerdown = __bind(this.pointerdown, this);
      var _this = this;
      this.options = {
        customReloadEvent: config.customReloadEvent,
        scopeReloadEvent: config.customReloadEvent || DEFAULT_SCOPE_RECREATE_EVENT_NAME,
        rigidSizing: false,
        resizeFromBody: true
      };
      this.$table = $table;
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
          if (!_this.options.customReloadEvent) {
            $(window).on('resize.rc', (function() {
              return _this.syncHandleWidths(true);
            }));
          }
          _this.unwatchOn = _this.$table.scope().$on(_this.options.scopeReloadEvent, function (event) {
            _this.syncHandleWidths(true);
          });
          unwatch();
        }
      });
    }

    ResizableColumns.prototype.getColumnId = function($el) {
      return this.$table.data('resizable-columns-id') + '-' + $el.data('resizable-column-id');
    };

    ResizableColumns.prototype.setHeaders = function() {
      this.$tableHeaders = this.$table.find('thead tr:first th:visible');
      this.assignPercentageWidths();
      return this.createHandles();
    };

    ResizableColumns.prototype.destroy = function () {
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

    ResizableColumns.prototype.assignPercentageWidths = function() {
      var _this = this;
      return this.$tableHeaders.each(function(_, el) {
        var $el;
        $el = $(el);
        return setWidth($el[0], $el.outerWidth() / _this.$table.width() * 100);
      });
    };

    ResizableColumns.prototype.createHandles = function() {
      var _ref,
      _this = this;
      if ((_ref = this.$handleContainer) != null) {
        _ref.remove();
      }
      this.$table.before((this.$handleContainer = $("<div class='rc-handle-container' />")));
      angular.element(document).injector().invoke(function($compile) {
        var scope = angular.element(_this.$handleContainer).scope();
        $compile(_this.$handleContainer)(scope);
      });
      this.$tableHeaders.each(function(i, el) {
        var $handle;
        if (_this.$tableHeaders.eq(i + 1).length === 0 || _this.$tableHeaders.eq(i).attr('data-noresize') || _this.$tableHeaders.eq(i + 1).attr('data-noresize')) {
          return;
        }
        $handle = $("<div class='rc-handle'><div></div></div>");
        $handle.data('th', $(el));
        return $handle.appendTo(_this.$handleContainer);
      });
      return this.$handleContainer.on('mousedown touchstart', '.rc-handle', this.pointerdown);
    };

    ResizableColumns.prototype.syncHandleWidths = function(recreateHeaders) {
      var _this = this;
      if (recreateHeaders) {
        this.setHeaders();
      }
      return this.$handleContainer.width(this.$table.width()).find('.rc-handle').each(function(_, el) {
        var $el;
        $el = $(el);
        return $el.css({
          left: $el.data('th').outerWidth() + ($el.data('th').offset().left - _this.$handleContainer.offset().left),
          height: _this.options.resizeFromBody ? _this.$table.height() : _this.$table.find('thead').height()
        });
      });
    };

    ResizableColumns.prototype.saveColumnWidths = function() {
      var _this = this;
      if (_this.saveRestoreService != null && this.$table.data('resizable-columns-id')) {
          var widthsJQ = this.$tableHeaders.filter(function(_, el) {
            var $el;
            $el = $(el);
            return !$el.attr('data-noresize');
          }).map(function (_, el) {
              var $el;
              $el = $(el);
              return {
                id: _this.getColumnId($el),
                width: parseWidth($el[0])
              };
          });
          _this.saveRestoreService.set(this.$table.data('resizable-columns-id'), widthsJQ.get());
          return widthsJQ;
      }
      return this.$tableHeaders;
    };

    ResizableColumns.prototype.restoreColumnWidths = function() {
      var _this = this;
      if (_this.saveRestoreService != null && this.$table.data('resizable-columns-id')) {
        var widths = _this.saveRestoreService.get(this.$table.data('resizable-columns-id'));
        if (widths && widths.length) {
          var widthsDict = widths.reduce(function (result, nextCol) {
            result[nextCol.id] = nextCol.width;
            return result;
          }, {});
          return this.$tableHeaders.each(function(_, el) {
            var $el, width;
            $el = $(el);
            if ((width = widthsDict[_this.getColumnId($el)])) {
              return setWidth($el[0], width);
            }
          });
        }
      }
      return this.$tableHeaders;
    };

    ResizableColumns.prototype.totalColumnWidths = function() {
      var total,
        _this = this;
      total = 0;
      this.$tableHeaders.each(function(_, el) {
        return total += parseFloat($(el)[0].style.width.replace('%', ''));
      });
      return total;
    };

    ResizableColumns.prototype.pointerdown = function(e) {
      var $currentGrip, $leftColumn, $rightColumn, startPosition, widths,
        _this = this;
      e.preventDefault();
      startPosition = pointerX(e);
      $currentGrip = $(e.currentTarget);
      $leftColumn = $currentGrip.data('th');
      $rightColumn = this.$tableHeaders.eq(this.$tableHeaders.index($leftColumn) + 1);
      widths = {
        left: parseWidth($leftColumn[0]),
        right: parseWidth($rightColumn[0])
      };
      this.$table.addClass('rc-table-resizing');
      this.$handleContainer.addClass('rc-table-resizing');
      $currentGrip.addClass('rc-handle-active');
      $(document).on('mousemove.rc touchmove.rc', function(e) {
        var difference;
        difference = (pointerX(e) - startPosition) / _this.$table.width() * 100;
        setWidth($rightColumn[0], widths.right - difference);
        return setWidth($leftColumn[0], widths.left + difference);
      });
      return $(document).one('mouseup touchend', function() {
        $(document).off('mousemove.rc touchmove.rc');
        _this.$table.removeClass('rc-table-resizing');
        _this.$handleContainer.removeClass('rc-table-resizing');
        $currentGrip.removeClass('rc-handle-active');
        _this.syncHandleWidths(false);
        return _this.saveColumnWidths();
      });
    };
    return ResizableColumns;
  })

  .directive('ngTableResizableColumnsDynamic', ['$timeout', 'ngTableResizableColumnsHelper', function ($timeout, ngTableResizableColumnsHelper) {
    return {
        restrict: 'C',
        priority: 999,
        require: 'ngTableDynamic',
        link: function(scope, element, args, ngTable) {
            var data;
            var initPromise = null;
            function reload() {
                if (initPromise) {
                    $timeout.cancel(initPromise);
                }
                data.destroy();
                initPromise = $timeout(function () {
                    data = new ngTableResizableColumnsHelper(element, scope, config);
                });
            }
            var config = {
                customReloadEvent: args.ntrcCustomReloadEvent,
                saveRestoreService: args.ntrcSaveRestoreService,
            };
            scope.$watch('$data', reload);
            args.ngTableDynamic.split(' with ').forEach(function (paramName) {
                scope.$watch(paramName, reload, true);
            });
            data = new ngTableResizableColumnsHelper(element, scope, config);
        }
    };
  }])

  .directive('ngTableResizableColumns', ['$timeout', 'ngTableResizableColumnsHelper', function ($timeout, ngTableResizableColumnsHelper) {
    return {
        restrict: 'C',
        priority: 999,
        require: 'ngTable',
        link: function(scope, element, args, ngTable) {
            var data;
            var initPromise = null;
            function reload() {
                if (initPromise) {
                    $timeout.cancel(initPromise);
                }
                data.destroy();
                initPromise = $timeout(function () {
                    data = new ngTableResizableColumnsHelper(element, scope, config);
                });
            }
            var config = {
                customReloadEvent: args.ntrcCustomReloadEvent,
                saveRestoreService: args.ntrcSaveRestoreService,
            };
            scope.$watch('$data', reload);
            scope.$watch(args.ngTable, reload, true);
            data = new ngTableResizableColumnsHelper(element, scope, config);
        }
    };
  }])
  .service('ngTableResizableColumnsSaveRestoreStoreService', function() {
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
  });
