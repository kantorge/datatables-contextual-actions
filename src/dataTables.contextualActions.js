﻿/* MIT License

Copyright (c) 2020 Tor Robinson

https://github.com/torrobinson/datatables-contextual-actions

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE. */

// Configure our plugin
jQuery.fn.dataTable.Api.register('contextualActions()', function (options) {

    // Get our table references
    var dt = this.table();
    var table = $(dt.container()).find('table');

    // Default our options
    if (options === undefined || options === null) options = {};
    var defaultOptions = {
        contextMenu: {
            enabled: true,
            xoffset: -10,
            yoffset: -10,
            headerRenderer: function () { return ''; },
        },
        buttonList: {
            enabled: true,
            iconOnly: false,
            disabledOpacity: 0.5,
            dividerSpacing: 10,
            buttonsAreOutline: false,
        },
        classes: [],
        iconPrefix: '',
        items: [],
        showSpeed: '0.30s'
    };

    options = mergeDeep(defaultOptions, options);

    if (options.buttonList.enabled && options.buttonList.containerSelector === undefined) {
        throw 'The buttonList.containerSelector option must be specified if the buttonList is enabled, to specify where the buttons will be created';
    }

    // Context menu state
    var contextMenuId = (table instanceof jQuery ? table.attr('id') : table.id) + '-context-menu';
    var rightClickedRowData = null;

    // Hides an open context menu
    function hideContextMenu() {

        // Deselect rows
        table.DataTable().rows().deselect();

        // Hide it
        $('#' + contextMenuId).removeClass('show').hide();
        rightClickedRowData = null;

        // Then destroy it
        destroyContextMenu(contextMenuId);
    }

    // Shows a context menu at the given offset from current mouse position
    function showContextMenuAt(x, y) {
        // Create the context menu
        createContextMenu(contextMenuId, options.classes, options.iconPrefix, hideContextMenu, options.items, rightClickedRowData);

        // Set its coordinates
        $("#" + contextMenuId).css({
            top: y + options.contextMenu.yoffset,
            left: x + options.contextMenu.xoffset
        });

        // Generate the header for the menu
        $("#" + contextMenuId).find('.dropdown-header').html(options.contextMenu.headerRenderer(rightClickedRowData));

        // Wait for next tick and then display
        setTimeout(function () {
            $('#' + contextMenuId).css({
                display: 'block',
                visibility: 'visible',
                opacity: 1,
                transform: 'translateY(0px)',
                transition: options.showSpeed + ' ease all',
                'z-index': 99999
            });
        }, 1);
    }

    // Ensure that clicks outside of the context menu dismiss it
    $(window).click(function () {
        if (
            $('#' + contextMenuId).is(":visible") // If the context menu is visible
            && !$(event.target).closest('.dropdown-menu').length // And you're not clicking inside of the context menu
        ) { hideContextMenu(); } // Then hide it
    });

    // Handle row right-clicks
    $(table).on('contextmenu', 'tr', function (e) {
        var node = this;
        var data = dt.row(node).data();

        if (!options.contextMenu.enabled) return;

        // If this isn't a valid data row (an empty table, for example), then return
        if (data === undefined) return;

        // Hide context menu
        hideContextMenu();

        // Set the current row's data for access elsewhere
        rightClickedRowData = data;



        // Select the row
        dt.row(node).select();

        // Show context menu at mouse position
        showContextMenuAt(e.pageX, e.pageY);

        // Return false to prevent the browser context menu from appearing
        return false;
    });

    // Bind to row selection
    dt.on('select', function (e, dt, type, indexes) {
        if (type === 'row') {
            // Set selected rows
            var selectedRowIndexes = dt.rows({ selected: true }).toArray()[0];
            var rows = table.DataTable().rows(selectedRowIndexes).data().toArray();
            refreshButtonsOnSelectionChanged(dt, options, rows);
        }
    });

    // Bind to deselection
    dt.on('deselect', function (e, dt, type, indexes) {
        if (type === 'row') {
            var selectedRowIndexes = dt.rows({ selected: true }).toArray()[0];
            var rows = table.DataTable().rows(selectedRowIndexes).data().toArray();
            refreshButtonsOnSelectionChanged(dt, options, rows);
        }
    });

    // Immediately try render button list
    refreshButtonsOnSelectionChanged(dt, options, []);

    // Show or hide the buttons based on row data
    function refreshButtonsOnSelectionChanged(dt, options, rows) {
        // Do nothing if the user doesn't want buttons
        if (!options.buttonList.enabled) return;
        updateButtons(options.buttonList, options.classes, options.items, options.iconPrefix, rows);
    }

    // Helper to create a context menu
    function createContextMenu(id, classes, iconPrefix, destroy, items, row) {
        var menu = $('<div id="' + id + '" class="dropdown-menu shadow' + classes.join(' ') + '">');

        menu.css({
            display: 'block',
            visibility: 'hidden',
            opacity: 0,
            transform: 'translateY(-30px)',
            transition: '0.15s ease all'
        });

        // Add the header
        menu.append('<h6 class="dropdown-header"></h6>');

        // Add the items
        $.each(items, function (i, item) {
            // If this item shouldnt even be rendered, skip it
            if (typeof item.isHidden === "function" && item.isHidden(row)) return;

            // Handle dividers
            if (item.type === 'divider') {
                menu.append('<div class="dropdown-divider"></div>');
            }

            // Handle options
            else if (item.type === 'option') {
                var icon = '';
                if (item.iconClass !== undefined && item.icon !== '') {
                    icon = '<i style="margin-right:15px;" class="' + iconPrefix + ' ' + item.iconClass + '"></i>';
                }

                var bootstrapClass = (item.bootstrapClass === undefined || item.bootstrapClass.trim === '') ? '' : 'text-' + item.bootstrapClass;

                var extraClasses = item.classes !== undefined ? item.classes.join(' ') : '';

                var title = item.title;
                var itemElement = $.parseHTML('<a class="dropdown-item ' + extraClasses + ' ' + bootstrapClass + '" style="cursor: pointer;">' + icon + title + '</a>');

                if (typeof item.isDisabled === "function" && item.isDisabled(row)) $(itemElement).addClass('disabled').css('opacity', '0.5');

                // On click, perform the action
                if (item.confirmation !== undefined) {
                    $(itemElement).click(function () {
                        dt.rows().deselect();
                        destroyContextMenu(id);
                        onClickWithConfirmation(item, [row], $(itemElement));
                    });
                }
                else {
                    $(itemElement).click(function () {
                        dt.rows().deselect();
                        destroyContextMenu(id);
                        item.action([row], $(itemElement));
                    });
                }

                menu.append(itemElement);
            }
        });

        // Add the menu to the DOM
        $('body').append(menu);
    }

    // Helper to destroy the context menu
    function destroyContextMenu(id) {
        $('#' + id + '.dropdown-menu').remove();
    }

    // Helper to update the button list
    function updateButtons(options, classes, items, iconPrefix, rows) {
        destroyButtonGroup(options.containerSelector, classes);
        createButtonGroup(options, classes, items, iconPrefix, rows);
    }

    // Helper to destroy the button list
    function destroyButtonGroup(container, classes) {
        // Remove any custom classes
        $.each(classes, function (i, cssClass) {
            $(options.containerSelector).removeClass(cssClass);
        });

        // Annd empty it again
        $(container).empty();
    }

    // How exactly to create the buttons to render
    function createButtonGroup(options, classes, items, iconPrefix, rows) {
        var buttonGroupTemplate = '<div class="btn-group"></div>';

        var groups = [];
        var currentGroup = null;
        // Add the items
        $.each(items, function (i, item) {
            // Figure out which group we'll be adding things to
            if (currentGroup === null) {
                // First iteration. New group.
                currentGroup = $(buttonGroupTemplate);
            }
            else if (i > 0 && item.type === 'divider') {
                // If the last item was a divider, then we need to package up the last group
                groups.push(currentGroup);

                // And start a new one
                currentGroup = $(buttonGroupTemplate);
                currentGroup.css('margin-left', options.dividerSpacing + 'px');
                return;
            }


            // If this item shouldnt even be rendered, skip it
            if (typeof item.isHidden === "function" && rows.some(row => item.isHidden(row))) return;

            // Handle options
            else if (item.type === 'option' || item.type === 'static') {
                var icon = '';
                var marginRight = options.iconOnly ? '' : 'margin-right:10px;';
                if (item.iconClass !== undefined && item.icon !== '') {
                    icon = '<i style="' + marginRight + '" class="' + iconPrefix + ' ' + item.iconClass + '"></i>';
                }

                var buttonClasses = '';

                // Get classes from its default or specified class
                var outlinePrefix = options.buttonsAreOutline ? 'outline-' : '';
                var bootstrapClass = (item.bootstrapClass === undefined || item.bootstrapClass.trim === '') ? '' : 'btn-' + outlinePrefix + item.bootstrapClass;
                if (bootstrapClass === '') bootstrapClass = options.defaultButtonClass;
                buttonClasses += ' ' + bootstrapClass;

                // Get generic classes from the item
                var extraClasses = item.classes !== undefined ? item.classes.join(' ') : '';
                buttonClasses += ' ' + extraClasses;

                // Build what the user will see in the button
                var buttonContents = '';

                if (!options.iconOnly) buttonContents = icon + item.title;
                else buttonContents = icon;

                var title = item.multiTitle === undefined ? item.title : (rows.length > 1 ? item.multiTitle : item.title);
                if (options.iconOnly) {
                    // Of it's just an icon, it needs a tooltip title
                    title = title;

                    if (item.type !== 'static' && rows.length > 1) {
                        // Append the count if there's multiple rows selected and we're not a static button
                        title += ' (' + rows.length + ')';
                    }
                }
                else {
                    // If has a label, it doesn't need a tooltip title
                    title = '';
                }

                var itemElement = $.parseHTML('<button class="btn ' + buttonClasses + '" title="' + title + '" >' + buttonContents + '</button>');

                if (item.id !== undefined) {
                    $(itemElement).attr('id', item.id);
                }

                // We are disabled if
                var isDisabled =
                    (item.type !== 'static' && rows.length === 0) // If there's nothing selected at all and we need something selected (not a static button)
                    ||
                    ((item.multi !== undefined && item.multi === false) && rows.length > 1) // If the item isn't a multi-action and yet there's more than 1 row selected,
                    ||
                    (typeof item.isDisabled === "function" && rows.some(row => item.isDisabled(row))) // Or the item should be disabled,
                    ;

                if (
                    isDisabled
                ) {
                    // Then disable it
                    $(itemElement).addClass('disabled');
                    $(itemElement).attr('disabled', 'disabled');
                    $(itemElement).css('cursor', 'not-allowed');
                    $(itemElement).css('opacity', options.disabledOpacity);
                }
                else if (!options.iconOnly && item.type !== 'static' && rows.length > 1) {
                    // Add the count of selected rows to the title, if the user doesn't want to just see the icon
                    $(itemElement).append(' (' + rows.length + ')');
                }

                // If we're icon- only force immediate and obvious tooltips
                if (!isDisabled && options.iconOnly && title !== '') $(itemElement).attr('data-toggle', 'tooltip');

                // On click, perform the action
                if (item.type === 'static') {
                    $(itemElement).click(function () {
                        dt.rows().deselect();
                        item.action();
                    });
                }
                else if (item.type === 'option') {
                    if (item.confirmation !== undefined) {
                        $(itemElement).click(function () { onClickWithConfirmation(item, rows); });
                    }
                    else {
                        $(itemElement).click(function () {
                            dt.rows().deselect();
                            item.action(rows, $(itemElement));
                        });
                    }
                }

                // Append it to the current btn-group
                currentGroup.append(itemElement);
            }
        });

        // Then push the btn-gorup to the master list
        groups.push(currentGroup);

        // Apply any extra parent classes
        $.each(classes, function (i, cssClass) {
            $(options.containerSelector).addClass(cssClass);
        });

        // Now push all the btn-groups into the parent container and bob's your uncle
        $.each(groups, function (i, group) {
            $(options.containerSelector).append(group);
        });
    }

    // Execute a confirmation action
    function onClickWithConfirmation(item, rows, btn) {
        var confirmation = item.confirmation(rows);
        confirmation.callback = function (confirmed) {
            if (confirmed) {
                dt.rows().deselect();
                item.action(rows, btn);
            }
        };
        bootbox.confirm(confirmation);
    }

    // Below 2 functions courtesy of @Salakar https://stackoverflow.com/a/34749873/1669011
    // We use this to recursively (deep) merge our default options with the user options
    function isObject(item) {
        return (item && typeof item === 'object' && !Array.isArray(item));
    }
    function mergeDeep(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();

        if (isObject(target) && isObject(source)) {
            for (const key in source) {
                if (isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    mergeDeep(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }

        return mergeDeep(target, ...sources);
    }

});
