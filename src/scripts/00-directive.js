// based on https://github.com/dobtco/jquery-resizable-columns
angular.module('ngTableResizableColumns', [])
  .factory('ngTableResizableColumnsHelper', function () {

    var parseWidth = function(node) {
        return parseFloat(node.style.width.replace('%', ''));
    }, setWidth = function(node, width) {
        return node.style.width = "" + width.toFixed(2) + "%";
    }, pointerX = function(e) {
        return (e.type.indexOf('touch') === 0) ? (e.originalEvent.touches[0] || e.originalEvent.changedTouches[0]).pageX : e.pageX;
    };

    function ResizableColumns($table, scope) {
        var __bind = function(fn, me){
            return function(){
                return fn.apply(me, arguments);
            };
        };

      this.pointerdown = __bind(this.pointerdown, this);
      var _this = this;
      this.options = {
        store: window.store,
        rigidSizing: false,
        resizeFromBody: true
        };
      this.$table = $table;
      this.state = 0;
      var unwatch = scope.$watch('params', function (newParams, oldParams) {
        if (!newParams.isNullInstance) {

          if (_this.state == 2) { //destroyed
            return;
          }
          _this.setHeaders();
          _this.restoreColumnWidths();
          _this.syncHandleWidths();
          _this.state = 1;
          $(window).on('resize.rc', (function() {
            return _this.syncHandleWidths();
          }));
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
      this.$tableHeaders.each(function(i, el) {
        var $handle;
        if (_this.$tableHeaders.eq(i + 1).length === 0 || (_this.$tableHeaders.eq(i).attr('data-noresize') != null) || (_this.$tableHeaders.eq(i + 1).attr('data-noresize') != null)) {
          return;
        }
        $handle = $("<div class='rc-handle' />");
        $handle.data('th', $(el));
        return $handle.appendTo(_this.$handleContainer);
      });
      return this.$handleContainer.on('mousedown touchstart', '.rc-handle', this.pointerdown);
    };

    ResizableColumns.prototype.syncHandleWidths = function() {
      var _this = this;
      this.setHeaders();
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
      return this.$tableHeaders.each(function(_, el) {
        var $el;
        $el = $(el);
        if ($el.attr('data-noresize') == null) {
          if (_this.options.store != null) {
            return _this.options.store.set(_this.getColumnId($el), parseWidth($el[0]));
          }
        }
      });
    };

    ResizableColumns.prototype.restoreColumnWidths = function() {
      var _this = this;
      return this.$tableHeaders.each(function(_, el) {
        var $el, width;
        $el = $(el);
        if ((_this.options.store != null) && (width = _this.options.store.get(_this.getColumnId($el)))) {
          return setWidth($el[0], width);
        }
      });
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
        $currentGrip.removeClass('rc-handle-active');
        _this.syncHandleWidths();
        return _this.saveColumnWidths();
      });
    };
    return ResizableColumns;
  })

  .directive('ngTableResizableColumns', ['$timeout', 'ngTableResizableColumnsHelper', function ($timeout, ngTableResizableColumnsHelper) {
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
                    data = new ngTableResizableColumnsHelper(element, scope);
                });
            }
            scope.$watch('$data', reload);
            args.ngTableDynamic.split(' with ').forEach(function (paramName) {
                scope.$watch(paramName, reload, true);
            });
            data = new ngTableResizableColumnsHelper(element, scope);
        }
    };
  }])

  .directive('ngTableResizableColumnsDynamic', ['$timeout', 'ngTableResizableColumnsHelper', function ($timeout, ngTableResizableColumnsHelper) {
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
                    data = new ngTableResizableColumnsHelper(element, scope);
                });
            }
            scope.$watch('$data', reload);
            scope.$watch(args.ngTable, reload, true);
            data = new ngTableResizableColumnsHelper(element, scope);
        }
    };
}]);
