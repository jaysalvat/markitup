/*!-----------------------------------------------------------------------------
 * MarkItUp! — Boost your textareas
 * v3.0.0-0 - built 2016-11-09
 * Licensed under the MIT License.
 * http://markitup.jaysalvat.com/
 * ----------------------------------------------------------------------------
 * Copyright (C) 2007-2016 Jay Salvat
 * http://jaysalvat.com/
 * --------------------------------------------------------------------------*/
/* global module, define */

(function (context, factory) {
    'use strict';

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else {
        context.MarkItUp = factory();
    }
})(this, function () {
    'use strict';

    var defaults = {
        parseSingle: '{x}',
        parseOpen:   '{x:}',
        parseClose:  '{:x}',
        tab: '    ',
        autoTab: true,
        width: null,
        height: null,
        content: null,
        preview: false,
        previewHidden: false,
        previewWidth: null,
        previewHeight: null,
        previewServerPath: null,
        previewTemplatePath: null,
        previewRefreshOn: [ 'markitup.insertion' ],
        vars: {},
        funcs: {},
        commands: {},
        shortcuts: {},
        plugins: [],
        beforeInit: null,
        afterInit: null,
        beforePreviewRefresh: null,
        afterPreviewRefresh: null,
        beforeDialogOpen: null,
        afterDialogOpen: null,
        beforeDialogClose: null,
        afterDialogClose: null,
        beforeInsert: null,
        afterInsert: null,
        toolbar: [
        // {
        //   name: '',
        //   class '',
        //   beforeBlock: '',
        //   afterBlock: '',
        //   before: '',
        //   after: '',
        //   content: '',
        //   placeholder: '',
        //   shortcut: '',
        //   multiline: false,
        //   select: true,
        //   vars: {},
        //   beforeInsert: function () {},
        //   afterInsert: function () {},
        //   dialog: {
        //      header: '',
        //      body': '',
        //      url: '',
        //      widget: null,
        //      width: null,
        //      height: null,
        //      cancel: 'Cancel',
        //      submit: 'Ok',
        //      beforeOpen: null,
        //      afterOpen: null,
        //      beforeClose null,
        //      afterClose: null
        //   }
        //   dropdown: [
        //      ...toolbar
        //   ]
        // }, ...
        ]
    };

    var click = "ontouchstart" in window ? 'touchstart' : 'click';

    var MarkItUp = function (elmt, settings) {
        if (!(this instanceof MarkItUp)) {
            return new MarkItUp(elmt, settings);
        }

        settings = settings || {};
        settings = MarkItUp.utils.extend(this.defaults, settings || {});

        if (typeof elmt === 'string') {
            elmt = document.querySelector(elmt);
        }

        if (!elmt) {
            return;
        }

        if (elmt.tagName !== 'TEXTAREA') {
           return console.error('markItUp! must be applied to Textareas only.');
        }

        this.previewTemplateCache = null;
        this.markItUpPath = null;
        this.container = null;
        this.preview = null;
        this.dialog = null;
        this.overlay = null;
        this.tabJump = null;
        this.boundKeyDownEvent = null;
        this.boundKeyUpEvent = null;
        this.selectAfterParsing = { start: null, len: null};
        this.shortcuts = {};
        this.textarea = elmt;
        this.settings = settings;
        this.plugins = {};

        this.shiftPressed = false;
        this.altPressed = false;
        this.ctrlPressed = false;
        this.metaPressed = false;

        this._callback(this.settings.beforeInit, [ this.settings ]);

        this._initPlugins();
        this._init();
        this._initParser();
        this._initKeyEvents();
        this._initPreview();

        this._callback(this.settings.afterInit, [ this.settings ]);
    };

    MarkItUp.prototype = {
        defaults: defaults,
        defaultShortcuts: {
            "Enter": function (e) {
                if (this.settings.autoTab) {
                    e.preventDefault();

                    this.insert('\n' + this.tabs(), {
                        'select': false
                    });
                } else {
                    this.refreshPreview();
                }
            },
            "Tab": function (e) {
                e.preventDefault();

                if (this.tabJump !== null) {
                    this.setPosition(this.textarea.value.length - this.tabJump);
                    this._resetTabJump();
                } else if (!this._command()) {
                    this.indent();
                }
            },
            "Shift Tab": function (e) {
                e.preventDefault();

                this.outdent();
            },
            "Up, Down, Left, Right": function () {
                this._resetTabJump();
            }
        },

        _init: function () {
            var parent  = this.textarea.parentNode,
                sibling = this.textarea.nextSibling,
                buttons = this.settings.toolbar,
                self    = this;

            var container = MarkItUp.utils.fragment('<div class="markitup-container"></div>'),
                toolbar   = this._initToolbar(buttons);

            container.appendChild(toolbar);
            container.appendChild(this.textarea);

            this.container = container;
            this.textarea.className += ' markitup-textarea';
            this.textarea.addEventListener(click, this._resetTabJump.bind(this));

            if (this.settings.content) {
                this.textarea.value = this.settings.content;
            }

            if (this.settings.width) {
                this.textarea.style.width = this.settings.width + 'px';

                if (!this.settings.previewWidth) {
                    this.settings.previewWidth = this.settings.width;
                }
            }

            if (this.settings.height) {
                this.textarea.style.height = this.settings.height + 'px';

                if (!this.settings.previewHeight) {
                    this.settings.previewHeight = this.settings.height;
                }
            }

            // Close dropdown when body if clicked
            document.body.addEventListener(click, MarkItUp.utils.closeDropdowns);

            // Listen textarea events in order to trigger a preview refresh
            var refreshEvents = this.settings.previewRefreshOn;

            if (!Array.isArray(refreshEvents)) {
                refreshEvents = [ refreshEvents ];
            }

            refreshEvents.forEach(function (event) {
                self.textarea.addEventListener(event, function () {
                    self.refreshPreview();
                });
            });

            if (sibling) {
                parent.insertBefore(container, sibling);
            } else {
                parent.appendChild(container);
            }
        },

        _initPreview: function () {
            var preview;

            // If preview: true we create the preview iFrame
            if (this.settings.preview === true) {
                preview = MarkItUp.utils.fragment('<iframe class="markitup-preview"></iframe>');

                if (this.settings.previewWidth) {
                    preview.style.width = this.settings.previewWidth + 'px';
                }

                if (this.settings.previewHeight) {
                    preview.style.height = this.settings.previewHeight + 'px';
                }

                if (this.settings.previewHidden) {
                    preview.style.display = 'none';
                }

                this.container.appendChild(preview);

            // If preview is a DOM Element
            } else if (typeof this.settings.preview === 'object') {
                preview = this.settings.preview;

            // If preview is a selector
            } else if (typeof this.settings.preview === 'string') {
                preview = document.querySelector(this.settings.preview);
            }

            this.preview = preview;

            this.refreshPreview();
        },

        _initToolbar: function (settings) {
            var self     = this,
                newRow   = true,
                newGroup = true,
                toolbar,
                group,
                row;

            toolbar = MarkItUp.utils.fragment('<div class="markitup-toolbar"></div>');

            settings.forEach(function (setting) {
                var html,
                    button,
                    dropdown;

                if (setting.row) {
                    newRow = true;
                    return;
                }

                if (setting.separator) {
                    newGroup = true;
                    return;
                }

                if (setting.name === undefined) {
                    return;
                }

                if (newRow) {
                    row = MarkItUp.utils.fragment('<div class="markitup-button-row"></div>');
                    newRow = false;
                    newGroup = true;
                    toolbar.appendChild(row);
                }

                if (newGroup) {
                    group = MarkItUp.utils.fragment('<div class="markitup-button-group"></div>');
                    newGroup = false;
                    row.appendChild(group);
                }

                html  = '<div class="markitup-button-wrapper ' + (setting.className || '') + '">';
                html +=   '<button class="markitup-button" title="' + setting.name + '">';

                if (setting.icon) {
                    html += '<div class="markitup-icon markitup-icon-' + setting.icon + '">';
                    html += MarkItUp.icons[setting.icon];
                    html += '</div>';
                }
                html +=     '<span>' + setting.name + '</span>';
                if (setting.dropdown) {
                    html += '<div class="markitup-caret"></div>';
                }
                html +=   '</button>';
                html += '</div>';

                button = MarkItUp.utils.fragment(html);

                if (setting.dropdown) {
                    dropdown = self._initDropdown(setting.dropdown);

                    button.addEventListener(click, function (e) {
                        e.stopPropagation();
                        e.preventDefault();

                        MarkItUp.utils.addClass(this, 'markitup-open');
                    });

                    button.appendChild(dropdown);
                } else {
                    self._click(button.querySelector('button'), setting);
                }

                group.appendChild(button);
            });

            return toolbar;
        },

        _initDropdown: function (settings) {
            var self = this, menu;

            menu = MarkItUp.utils.fragment('<ul class="markitup-dropdown"></ul>');

            settings.forEach(function (setting) {
                var html,
                    menuRow,
                    menuLink,
                    submenu,
                    widget;

                menuRow = MarkItUp.utils.fragment('<li class="' + (setting.className || '') + '"></li>');

                if (setting.width) {
                    menu.style.width = setting.width + 'px';
                }

                widget = self._funcOrArg(setting.widget);

                if (typeof widget === 'object' && widget.nodeType === 1) {
                    menuRow.appendChild(widget);

                } else {
                    html = '<a href="#">';
                    if (setting.icon) {
                        html += '<i class="' + setting.icon + '"></i>';
                    }
                    html += setting.name;
                    if (setting.dropdown) {
                        html += '<div class="markitup-caret"></div>';
                    }
                    html += '</a>';

                    menuLink = MarkItUp.utils.fragment(html);

                    self._click(menuLink, setting);

                    menuRow.appendChild(menuLink);
                }

                if (setting.dropdown) {
                    submenu = self._initDropdown(setting.dropdown);

                    menuRow.addEventListener(click, function (e) {
                        MarkItUp.utils.addClass(this, 'markitup-open');
                        e.stopPropagation();
                    });

                    menuRow.appendChild(submenu);
                }

                menu.appendChild(menuRow);
            });

            return menu;
        },

        _initParser: function () {
            var single = MarkItUp.utils.escapeREChars(this.settings.parseSingle).split(/x+/),
                open   = MarkItUp.utils.escapeREChars(this.settings.parseOpen).split(/x+/),
                close  = MarkItUp.utils.escapeREChars(this.settings.parseClose).split(/x+/);

            single[0] = single[0] + ' *';
            single[1] = ' *' + single[1];

            open[0] = open[0] + ' *';
            open[1] = ' *' + open[1];

            close[0] = close[0] + ' *';
            close[1] = ' *' + close[1];

            var keywords = {
                'if':        'IF',
                'else':      'ELSE',
                'or':        'OR',
                'var':       'VAR',
                'func':      'FN',
                'alt':       'A',
                'tab':       'T',
                'selection': 'S',
                'caret':     'C',
                'multiline': 'M',
                'number':    '#'
            };

            this.regexp = {
                'if':         new RegExp(open[0]   + keywords.if + ' (\\w+)' + open[1] + '(.*?)(' + single[0] + keywords.else + single[1] + '(.*?))?' + close[0] + keywords.if + close[1], 'g'),
                'alt':        new RegExp(open[0]   + keywords.alt + open[1] + '(.*?)(' + single[0] + keywords.or + single[1] + '(.*?))?' + close[0] + keywords.alt + close[1], 'g'),
                'var':        new RegExp(single[0] + keywords.var + ' (\\w+)' + single[1], 'g'),
                'var2':       new RegExp(open[0]   + keywords.var + ' (\\w+)' + open[1] + '(.*?)' + close[0] + keywords.var + close[1], 'g'),
                'selection':  new RegExp(single[0] + keywords.selection + single[1], 'g'),
                'selection2': new RegExp(open[0]   + keywords.selection + open[1] + '(.*?)' + close[0] + keywords.selection + close[1], 'g'),
                'caret':      new RegExp(single[0] + keywords.caret + single[1], 'g'),
                'caret2':     new RegExp(open[0]   + keywords.caret + open[1] + '(.*?)' + close[0] + keywords.caret + close[1], 'g'),
                'function':   new RegExp(single[0] + keywords.func + ' (\\w+)( *\\((.*?)\\))?' + single[1], 'g'),
                'function2':  new RegExp(open[0]   + keywords.func + ' (\\w+)( *\\((.*?)\\))?' + open[1] + '(.*?)' + close[0] + keywords.func + close[1], 'g'),
                'tab':        new RegExp(single[0] + keywords.tab + '(\\d*)' + single[1], 'g'),
                'multiline':  new RegExp(open[0]   + keywords.multiline + open[1] + '(.*?)' + close[0] + keywords.multiline + close[1], 'g'),
                'line':       new RegExp(single[0] + keywords.multiline + single[1], 'g'),
                'number':     new RegExp(single[0] + keywords.number + single[1], 'g')
            };
        },

        _initPlugins: function () {
            var self = this,
                plugins = MarkItUp.plugins;

            for (var key in plugins) {
                if (plugins.hasOwnProperty(key)) {
                    self.register(plugins[key]);
                }
            }
        },

        _initKeyEvents: function () {
            var shortcuts, key;

            shortcuts = this.defaultShortcuts;

            for (key in shortcuts) {
                if (shortcuts.hasOwnProperty(key)) {
                    this._registerShortcut(key, shortcuts[key], true);
                }
            }

            shortcuts = this.settings.shortcuts;

            for (key in shortcuts) {
                if (shortcuts.hasOwnProperty(key)) {
                    this._registerShortcut(key, shortcuts[key]);
                }
            }

            this.boundKeyDownEvent = this._keyEvents.bind(this);
            this.textarea.addEventListener('keydown', this.boundKeyDownEvent);

            this.container.addEventListener('keydown', this._keyStates.bind(this));
            this.container.addEventListener('keyup',   this._keyStates.bind(this));
        },

        _keyStates: function (e) {
            this.altPressed   = e.altKey;
            this.metaPressed  = e.metaKey;
            this.shiftPressed = e.shiftKey;
            this.ctrlPressed  = e.ctrlKey;
        },

        _keyEvents: function (e, defaultShortcut) {
            var shortcuts,
                shortcut,
                keys = [],
                keyMapping = {
                     '8': 'backspace',
                     '9': 'tab',
                    '13': 'enter',
                    '27': 'esc',
                    '32': 'space',
                    '37': 'left',
                    '38': 'up',
                    '39': 'right',
                    '40': 'down',
                    '16': null, // SHIFT
                    '17': null, // CTRL
                    '18': null, // ALT
                    '91': null, // META
                };

            if (keyMapping[e.which] !== undefined) {
                keys.push(keyMapping[e.which]);
            } else {
                if (keyMapping[e.which] !== null) {
                    keys.push(String.fromCharCode(e.which).toLowerCase());
                }
            }

            if (e.metaKey) {
                keys.push('meta');
            }

            if (e.shiftKey) {
                keys.push('shift');
            }

            if (e.ctrlKey) {
                keys.push('ctrl');
            }

            if (e.altKey) {
                keys.push('alt');
            }

            keys.sort();

            shortcut = keys.join(' ').toUpperCase();

            if (defaultShortcut) {
                shortcuts = this.defaultShortcuts;
            } else {
                shortcuts = this.shortcuts;
            }

            if (typeof shortcuts[shortcut] === 'function') {
                shortcuts[shortcut].apply(this, [ e ]);
            }
        },

        _registerShortcut: function (shortcut, callback, defaultShortcut) {
            var self = this, keys;

            shortcut.split(/, ?/).forEach(function (shortcut) {
                shortcut = shortcut.toLowerCase();
                keys = shortcut.split(' ');
                keys.sort();
                shortcut = keys.join(' ').toUpperCase();

                if (typeof callback === 'object') {
                    var settings = callback;

                    callback = function () {
                        self.do(settings);
                    };
                }

                if (typeof callback === 'string') {
                    var content = callback;

                    callback = function () {
                        self.insert(content);
                    };
                }

                if (typeof callback === 'function') {
                    self.shortcuts[shortcut] = callback;

                    if (defaultShortcut) {
                        self.defaultShortcuts[shortcut] = callback;
                    }
                }
            });

            if (defaultShortcut) {
                delete this.defaultShortcuts[shortcut];
            }

            return shortcut;
        },

        defaultBehavior: function (e) {
            this._keyEvents(e, true);
        },

        getMarkItUpPath: function () {
            if (this.markItUpPath) {
                return this.markItUpPath;
            }

            this.markItUpPath = MarkItUp.utils.getPath();

            return this.markItUpPath;
        },

        indent: function () {
            this.insertBefore(this.settings.tab, {
                select:    this.getSelection().text ? 'outer' : false,
                multiline: true,
                autotab:   false
            });
        },

        outdent: function () {
            var content = this.getSelection().text;

            // If selection, remove tab from selection
            if (content) {
                content = content.replace(new RegExp('^'  + this.settings.tab, 'g'), '');
                content = content.replace(new RegExp('\n' + this.settings.tab, 'g'), '\n');

                this.insert(content, {
                    select: !!this.getSelection().text,
                    autotab: false
                });

            // Otherwhise, remove tabs before caret position
            } else {
                var caretPosition = this.getPosition(),
                    part1 = this.textarea.value.substring(0, caretPosition),
                    part2 = this.textarea.value.substring(caretPosition);

                part1 = part1.replace(new RegExp(this.settings.tab + '$', 'g'), '');

                this.textarea.value = part1 + part2;
                this.setPosition(part1.length);
                this.textarea.focus();
            }
        },

        getContainer: function () {
            return this.container;
        },

        getTextarea: function () {
            return this.textarea;
        },

        getPreview: function () {
            return this.preview;
        },

        setContent: function (content) {
            this.textarea.value = content;
        },

        getContent: function () {
            return this.textarea.value;
        },

        setLine: function (which, mode) {
            var line = this.getLine(which);

            if (!line) {
                return;
            }

            if (mode === 'end') {
                this.setPosition(line.end - 1);
            } else if (mode === 'select') {
                this.setSelection(line.start, line.len);
            } else {
                this.setPosition(line.start);
            }

            return line;
        },

        getLine: function (which) {
            var content = this.textarea.value,
                lines = content.split(/\r?\n/),
                total = lines.length,
                position = this.getPosition(),
                chars = 0,
                buffer = 0,
                lineLength,
                data;

            if (which !== undefined && which !== 'current') {
                position = null;
            }

            for (var i = 0; i < total; i++) {
                lineLength = lines[i].length + 1;

                chars += lineLength;

                data = {
                    number: i + 1,
                    start:  buffer,
                    end:    chars,
                    len:    lineLength,
                    total:  total,
                    text:   lines[i]
                };

                if (
                    (which === 'first' && i === 0) ||
                    (which === 'last'  && i === total - 1) ||
                    (which === i + 1) ||
                    (position && position >= buffer && position < chars)
                ) {
                    return  data;
                }

                buffer = chars;
            }
        },

        selectLine: function (which, len) {
            var line1, line2;

            if (!which) {
                return;
            }

            if (len) {
                line1 = this.getLine(which);
                line2 = this.getLine(which + len - 1);

                if (!line2) {
                    line2 = this.getLine('last');
                }

                return this.setSelection(line1.start, line2.end - line1.start);
            }

            return this.setLine(which, 'select');
        },

        setPosition: function (position) {
            if (position === 'first') {
                this.setSelection(0, 0);
            } else if (position === 'last') {
                this.setSelection(this.textarea.value.length, 0);
            } else {
                this.setSelection(position, 0);
            }
        },

        getPosition: function () {
            return this.getSelection().start;
        },

        setLinePosition: function (which, position) {
            var line = this.getLine(which);

            if (!line) {
                return;
            }

            this.setPosition(line.start + position);
        },

        getLinePosition: function () {
            var line = this.getLine('current');

            if (!line) {
                return;
            }

            return {
                line: line.number,
                position: this.getPosition() - line.start
            };
        },

        getSelection: function () {
            var start = this.textarea.selectionStart,
                end   = this.textarea.selectionEnd,
                text  = this.textarea.value.substring(start, end);

            return {
                'start': start,
                'end':   end,
                'text':  text,
                'len':   text.length
            };
        },

        setSelection: function (start, len) {
            this.textarea.selectionStart = start;
            this.textarea.selectionEnd   = start + len;
        },

        setOption: function (key, value) {
            this.settings[key] = value;
        },

        getOption: function (key) {
            return this.settings[key];
        },

        setOptions: function (options) {
            this.settings = MarkItUp.utils.extend(this.settings, options);
        },

        getOptions: function () {
            return this.settings;
        },

        do: function (settings) {
            var self = this;

            if (settings.dialog) {
                this._dialog(settings.dialog, function (vars) {
                    settings.vars = MarkItUp.utils.extend(settings.vars, vars);

                    doJob(settings);
                });
            } else {
                doJob(settings);
            }

            function doJob (settings) {
                self.textarea.focus();

                var selection   = self.getSelection(),
                    beforeBlock = self._funcOrArg(settings.beforeBlock) || '',
                    before      = self._funcOrArg(settings.before) || '',
                    after       = self._funcOrArg(settings.after) || '',
                    afterBlock  = self._funcOrArg(settings.afterBlock) || '',
                    placeholder = self._funcOrArg(settings.placeholder) || '',
                    content     = self._funcOrArg(settings.content) || selection.text || placeholder,
                    multiline   = self._funcOrArg(settings.multiline),
                    select      = self._funcOrArg(settings.select),
                    autotab     = self._funcOrArg(settings.autotab);

                if (self.metaPressed && select === undefined) {
                    select = self.shiftPressed ? 'outer' : 'inner';
                } else if (placeholder && !selection.text) {
                    select = 'inner';
                }

                if (self.shiftPressed) {
                    multiline = true;
                }

                if (autotab === undefined) {
                    autotab = self.settings.autoTab;
                }

                // Callbacks
                self._callback(self.settings.beforeInsert, [ settings ]);
                self._callback(settings.beforeInsert, [ settings ]);

                var nlAtTheEndRE         = /(\n)$/,
                    specialAtTheEndRE    = /(\s)$/,
                    tabsAtTheBeginningRE = new RegExp('^' + self.tabs(), 'g'),
                    nlAtTheEnd           = selection.text.match(nlAtTheEndRE),
                    specialAtTheEnd      = selection.text.match(specialAtTheEndRE),
                    tabsAtTheBeginning   = selection.text.match(tabsAtTheBeginningRE);

                // Multi line Mode
                if (multiline) {
                    content = self._multiline(content, function (line) {
                        if (autotab) {
                            line = line.replace(tabsAtTheBeginningRE, '');
                        }

                        return before + line + after;
                    });

                // Single line Mode
                } else {
                    if (autotab) {
                        content = content.replace(tabsAtTheBeginningRE, '');
                    }

                    // Push special char after the closing tag
                    if (specialAtTheEnd) {
                        content = content.replace(specialAtTheEndRE, '');
                        content = before + content + after + specialAtTheEnd[0];
                    } else {
                        content = before + content + after;
                    }

                    if (nlAtTheEnd) {
                        content = content.replace(nlAtTheEndRE, '');
                    }
                }

                if (nlAtTheEnd && !afterBlock) {
                    content = content + nlAtTheEnd[0];
                }

                content = beforeBlock + content + afterBlock;

                if (nlAtTheEnd && afterBlock) {
                    content = content + nlAtTheEnd[0];
                }

                // Retab all lines
                if (autotab) {
                    if (multiline) {
                        content = content.replace(/\n/g, '\n' + self.tabs());
                    }
                    content = content.replace(new RegExp(self.tabs() + '$'), '');

                    if (tabsAtTheBeginning) {
                        content = self.tabs() + content;
                    }
                }

                content = self.parse(content, settings.vars);

                var part1, part2, scrollTop,
                    start, end;

                // Insert content in place
                if (content) {
                    part1     = self.textarea.value.substring(0, selection.start);
                    part2     = self.textarea.value.substring(selection.end);
                    scrollTop = self.textarea.scrollTop;

                    self.textarea.value = part1 + content + part2;
                    self.textarea.scrollTop = scrollTop;
                }

                if (after || afterBlock || self.selectAfterParsing.start) {
                    self.tabJump = part2.length;
                } else {
                    self.tabJump = null;
                }

                // Parse blocks to get length after parsing
                beforeBlock = self.parse(afterBlock, settings.vars, true);
                afterBlock  = self.parse(afterBlock, settings.vars, true);
                before      = self.parse(before,     settings.vars, true);
                after       = self.parse(after,      settings.vars, true);

                // Select where {C} {C:} {:C} could be defined
                if (self.selectAfterParsing.start !== null) {
                    self.setSelection(selection.start + self.selectAfterParsing.start, self.selectAfterParsing.len);

                    self.selectAfterParsing = {
                        start: null,
                        len:   null
                    };

                // Otherwhise
                } else {
                    // Select the previously selected content
                    if (select === 'inner' || select === true) {
                        start = selection.start + beforeBlock.length + before.length;
                        end   = content.length - before.length - after.length - beforeBlock.length - afterBlock.length;
                        self.setSelection(start, end);

                    // Select new content
                    } else if (select === 'outer') {
                        self.setSelection(selection.start, content.length);

                    // No selection
                    } else {
                        if (selection.text) {
                            end = selection.start + content.length;
                        } else {
                            end = selection.start + content.length - after.length - afterBlock.length;
                        }
                        self.setPosition(end);
                    }
                }

                self.textarea.focus();

                // Trigger insertion event
                self._triggerEvent('markitup.insertion');

                // Callbacks
                self._callback(self.settings.afterInsert, [ settings ]);
                self._callback(settings.afterInsert, [ settings ]);
            }
        },

        insert: function (content, settings) {
            settings = settings || {};

            if (settings.multiline) {
                content = this._multiline(this.getSelection().text, function () {
                    return content;
                });
            }
            settings.content = content;

            this.do(settings);
        },

        insertBefore: function (before, settings) {
            settings = settings || {};
            settings.content = this.getSelection().text;
            settings.before  = before;

            this.do(settings);
        },

        insertAfter: function (after, settings) {
            settings = settings || {};
            settings.content = this.getSelection().text;
            settings.after   = after;

            this.do(settings);
        },

        wrap: function (before, after, settings) {
            settings = settings || {};
            settings.content = this.getSelection().text;
            settings.before  = before;
            settings.after   = after;

            this.do(settings);
        },

        tabs: function () {
            var regex = new RegExp('^(' + this.settings.tab + ')*', 'g'),
                line  = this.getLine(),
                matches;

            if (!line) {
                return '';
            }

            matches = line.text.match(regex);

            if (matches[0]) {
                return matches[0];
            }

            return '';
        },

        parse: function (string, vars, nocaret) {
            var self = this, selection;

            vars      = MarkItUp.utils.extend(this.settings.vars, vars);
            string    = this._funcOrArg(string);
            selection = this.getSelection();

            if (typeof string !== 'string') {
                return string;
            }

            var processVars = function (string, varname, placeholder) {
                varname = varname.trim();

                if (vars[varname]) {
                    return vars[varname];
                }

                return (typeof placeholder === 'string') ? placeholder : '';
            };

            var processFuncs = function (string, funcname, allValues, values, placeholder) {
                var fn, args = [];

                funcname = funcname.trim();

                if (values) {
                    args = values.trim().split(/\s?,\s?/);
                }

                if (self.settings.funcs[funcname]) {
                    fn = self.settings.funcs[funcname].apply(self, args);

                    return self.parse(fn);
                }

                return (typeof placeholder === 'string') ? placeholder : '';
            };

            // Alt content: {A:}...{OR}...{:A}
            string = string.replace(this.regexp.alt, function (string, value1, orPart, value2) {
                if (self.altPressed) {
                    return value2 || '';
                }

                return value1;
            });

            // if: {IF varname:}...{ELSE}...{:IF}
            string = string.replace(this.regexp.if, function (string, varname, value1, elsePart, value2) {
                if (vars[varname]) {
                    return value1;
                } else if (elsePart) {
                    return value2;
                }

                return '';
            });

            // multiline: {M:}...{M}...{:M}
            string = string.replace(this.regexp.multiline, function (string, line) {
                var lines = selection.text.trim().split(/\r?\n/);

               for (var i = 0; i < lines.length; i++) {
                    lines[i] = self._removeTabsAtBeggining(lines[i]);
                    lines[i] = self.parse(line.replace(self.regexp.line, lines[i]), { '#': i + 1}, true);
                }

                return lines.join('\n');
            });

            // var with placeholder: {VAR varname:} placeholder {:VAR}
            string = string.replace(this.regexp.var2, processVars);

            // var: {VAR varname}
            string = string.replace(this.regexp.var, processVars);

            // function with placeholder: {FN funcname (...params):} placeholder {:FN}
            string = string.replace(this.regexp.function2, processFuncs);

            // function: {FN funcname (...params)}
            string = string.replace(this.regexp.function, processFuncs);

            // tab: {T} or {T2}, {T3}, {T4}...
            string = string.replace(this.regexp.tab, function (string, number) {
                if (number) {
                    return new Array(parseInt(number, 10) + 1).join(self.settings.tab);
                }

                return self.settings.tab;
            });

            // line number: {#}
            string = string.replace(this.regexp.number, function () {
                return vars['#'] !== undefined ? vars['#'] : 1;
            });

            // selection with placeholder: {S:} placeholder {:S}
            string = string.replace(this.regexp.selection2, function (string, placeholder) {
                return selection.text ? selection.text : placeholder;
            });

            // selection: {S}
            string = string.replace(this.regexp.selection, selection.text);

            if (!nocaret) {
                // caret with selection: {C:} selection {:C}
                string = string.replace(this.regexp.caret2, function (string, selection, position) {
                    if (self.selectAfterParsing.start === null) {
                        self.selectAfterParsing = {
                            start: position,
                            len:   selection.length
                        };
                    }

                    return selection;
                });

               // caret: {C}
                string = string.replace(this.regexp.caret, function (string, position) {
                    if (self.selectAfterParsing.start === null) {
                        self.selectAfterParsing = {
                            start: position,
                            len: 0
                        };
                    }

                    return '';
                });
            }

            return string;
        },

        refreshPreview: function () {
            var self    = this,
                content = this.textarea.value;

            if (!this.preview) {
                return;
            }

            if (this.settings.beforePreviewRefresh) {
                this._callback(
                    this.settings.beforePreviewRefresh,
                    [
                        content,
                        function (content) {
                            goThroughServerParser(content);
                        }
                    ]
                );
            } else {
                goThroughServerParser(content);
            }

            function goThroughServerParser (content) {
                var serverPath, postValues;

                if (self.settings.previewServerPath) {
                    serverPath = self._replaceMarkItUpPath(self.settings.previewServerPath);
                    postValues = {};

                    postValues.markitup = content;

                    self._ajaxPost(serverPath, postValues, function (parsedContent) {
                        applyTemplate(parsedContent);
                    });
                } else {
                    applyTemplate(content);
                }
            }

            function applyTemplate (content) {
                var templatePath;

                if (self.preview.tagName === 'IFRAME' && self.settings.previewTemplatePath) {

                    // Is template is cached
                    if (self.previewTemplateCache) {
                       doRefreshPreview(content, self.previewTemplateCache);

                    // Load template and cache it
                    } else {
                        templatePath = self._replaceMarkItUpPath(self.settings.previewTemplatePath);

                        if (templatePath) {
                           self._ajaxGet(templatePath, function (template) {
                               self.previewTemplateCache = self._replaceMarkItUpPath(template);

                               doRefreshPreview(content, self.previewTemplateCache);
                           });
                       }
                   }
                } else {
                    doRefreshPreview(content, self.previewTemplateCache);
                }
            }

            function doRefreshPreview (content, template) {
                var iframe;

                // Add content in template
                if (template) {
                    content = template.replace(/\{ *markitup *\/?\}/g,  content);
                }

                // Refresh IFRAME content
                if (self.preview.tagName === 'IFRAME' && self.preview.contentWindow) {
                    iframe = self.preview.contentWindow.document;
                    iframe.open();
                    iframe.write(content);
                    iframe.close();

                // Or refresh page element innerHTML
                } else {
                    self.preview.innerHTML = content;
                }

                // afterPreviewRefresh Callback
                self._callback(self.settings.afterPreviewRefresh, [ content, self.textarea.value ]);
            }
        },

        togglePreview: function () {
            if (this.preview.style.display === 'block') {
                this.hidePreview();
            } else {
                this.showPreview();
            }
        },

        showPreview: function () {
            this.preview.style.display = 'block';
        },

        hidePreview: function () {
            this.preview.style.display = 'none';
        },

        getPreviewContent: function () {
            if (this.preview.tagName === 'IFRAME') {
                return this.preview.contentWindow.document.body.innerHTML;
            } else {
                return this.preview.textContent;
            }
        },

        register: function (Plugin) {
            var self = this;

            if (typeof Plugin !== 'function' || !Plugin.id) {
                throw 'Invalid MarkItUp! plugin.';
            }

            MarkItUp.prototype[Plugin.id] = function () {
                var args = [ null, self ].concat([].slice.call(arguments));

                return new (Function.prototype.bind.apply(Plugin, args))();
            }();
        },

        _replaceMarkItUpPath: function (path) {
            var markitupPath = this.getMarkItUpPath();

            return path.replace(/markitup:\/\//g, markitupPath);
        },

        _dialog: function (settings, callback) {
            var self = this,
                overlay,
                dialog,
                html;

            html = '<div class="markitup-overlay"></div>';

            overlay = MarkItUp.utils.fragment(html);

            if (settings.url) {
                this._ajaxGet(settings.url, function (data) {
                    settings.body = data;

                    createDialog();
                });
            } else {
                createDialog();
            }

            function createDialog () {
                var widget,
                    body;

                self._callback(self.settings.beforeDialogOpen, [ settings ]);
                self._callback(settings.beforeOpen, [ settings ]);

                html  = '<div class="markitup-dialog">';
                html +=     '<form>';

                // Dialog Header
                if (settings.header) {
                    html += '<div class="markitup-dialog-header">';
                    html +=     '<h4>' + settings.header + '</h4>';
                    html += '</div>';
                }

                // Dialog body
                html += '<div class="markitup-dialog-body"></div>';

                // Dialog footer
                if (settings.cancel !== false || settings.submit !== false) {
                    html += '<div class="markitup-dialog-footer">';
                    if (settings.cancel !== false) {
                        html += '<button type="button" class="markitup-dialog-button markitup-dialog-close">';
                        html +=     (settings.cancel || 'Cancel');
                        html += '</button>';
                    }
                    if (settings.submit !== false) {
                        html += '<button type="submit" class="markitup-dialog-button markitup-dialog-submit">';
                        html +=     (settings.submit || 'Ok');
                        html += '</button>';
                    }
                    html += '</div>';
                }

                html += '</form>';
                html += '</div>';

                dialog = MarkItUp.utils.fragment(html);
                widget = self._funcOrArg(settings.widget);
                body   = dialog.querySelector('.markitup-dialog-body');

                if (typeof widget === 'object' && widget.nodeType === 1) {
                    body.appendChild(widget);
                } else {
                    body.innerHTML = settings.body;
                }

                if (settings.width) {
                    dialog.style.width = settings.width + 'px';
                }

                if (settings.height) {
                    dialog.style.height = settings.height + 'px';
                }

                dialog.settings = settings;

                dialog.querySelector('form').addEventListener('submit', function (e) {
                    var vars   = {},
                        inputs = dialog.querySelectorAll('input[name]');

                    e.preventDefault();

                    [].forEach.call(inputs, function (elmt) {
                        if (elmt.type === 'checkbox' || elmt.type === 'radio') {
                            if (elmt.checked) {
                                vars[elmt.name] = elmt.value;
                            }
                        } else {
                            vars[elmt.name] = elmt.value;
                        }
                    });

                    if (typeof callback === 'function') {
                        callback.apply(self, [ vars ]);
                    }

                    self.closeDialog();
                });

                if (settings.cancel !== false) {
                    dialog.querySelector('.markitup-dialog-close').addEventListener(click, function (e) {
                        self.closeDialog();

                        e.stopPropagation();
                    });
                }

                dialog.addEventListener('keydown', function (e) {
                    if (e.which === 27) {
                        self.closeDialog();
                    }

                    e.stopPropagation();
                });

                dialog.addEventListener(click, function (e) {
                    e.stopPropagation();
                });

                overlay.addEventListener(click, function (e) {
                    self.closeDialog();

                    e.stopPropagation();
                });

                document.body
                    .appendChild(overlay)
                    .appendChild(dialog);

                setTimeout(function () {
                    MarkItUp.utils.addClass(overlay, 'markitup-transition');
                    MarkItUp.utils.addClass(dialog, 'markitup-transition');
                }, 10);

                var firstField = dialog.querySelector('[name]');

                if (firstField) {
                    dialog.querySelector('[name]').focus();
                }

                self.dialog  = dialog;
                self.overlay = overlay;

                self._callback(self.settings.afterDialogOpen, [ settings, dialog, overlay ]);
                self._callback(settings.afterOpen, [ settings, dialog, overlay ]);
            }
        },

        closeDialog: function () {
            var overlay = this.overlay,
                dialog  = this.dialog;

            if (!dialog) {
                return;
            }

            this._callback(this.settings.beforeDialogClose, [ dialog.settings, dialog, overlay ]);
            this._callback(dialog.settings.beforeClose, [ dialog.settings, dialog, overlay ]);

            overlay.remove();
            dialog.remove();

            this.textarea.focus();

            this.dialog  = null;
            this.overlay = null;

            this._callback(this.settings.afterDialogClose, [ dialog.settings ]);
            this._callback(dialog.settings.afterClose, [ dialog.settings ]);
        },

        destroy: function () {
            var container = this.container,
                textarea  = this.textarea,
                dialog    = this.dialog,
                overlay   = this.overlay;

            if (!container || !textarea) {
                return;
            }

            this.texarea   = null;
            this.container = null;
            this.preview   = null;
            this.dialog    = null;
            this.overlay   = null;

            textarea.className = textarea.className.replace('markitup-textarea', '');
            container.parentNode.insertBefore(textarea, container.nextSibling);
            container.parentNode.removeChild(container);

            if (dialog) {
                dialog.parentNode.removeChild(dialog);
                overlay.parentNode.removeChild(overlay);
            }

            textarea.removeEventListener('keydown', this.boundKeyDownEvent);
            textarea.removeEventListener(click,     this._resetTabJump);

            document.body.removeEventListener(click, MarkItUp.utils.closeDropdowns);
        },

        closeDropdowns: function () {
            MarkItUp.utils.closeDropdowns();
        },

        _ajaxGet: function (url, callback) {
            var request = new XMLHttpRequest ();

            url = this._replaceMarkItUpPath(url);

            request.open('GET', url, true);

            request.onload = function () {
                if (request.status >= 200 && request.status < 400) {
                    callback.apply(this, [ request.responseText ]);
                }
            };

            request.send();
        },

        _ajaxPost: function (url, data, callback) {
            var request = new XMLHttpRequest ();

            url = this._replaceMarkItUpPath(url);

            request.open('POST', url, true);
            request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');

            request.onload = function () {
                if (request.status >= 200 && request.status < 400) {
                    callback.apply(this, [ request.responseText ]);
                }
            };

            request.send(MarkItUp.utils.queryString(data));
        },

        _multiline: function (content, callback) {
            var line,
                lines    = [],
                selected = content.replace(/\r?\n$/, '').split(/\r?\n/);

            for (var i = 0; i < selected.length; i++) {
                line = callback(selected[i], i);
                line = line.replace(this.regexp.number, i + 1);
                lines.push(line);
            }

            return lines.join('\n');
        },

        _removeTabsAtBeggining: function (content) {
            return content.replace(new RegExp('^' + this.tabs()), '');
        },

        _funcOrArg: function (value) {
            if (typeof value === 'function') {
                return value.apply(this);
            }

            return value;
        },

        _resetTabJump: function () {
            this.tabJump = null;
        },

        _click: function (elmt, setting) {
            var self = this;
            var selection = self.getSelection();

            function insertion (e) {
                e.preventDefault();

                setting.event = e;

                if (!setting.dropdown) {
                    MarkItUp.utils.closeDropdowns();
                }

                self._callback(setting.click, [ setting ]);
                self.do(setting);
            }

            if (setting.shortcut) {
                this._registerShortcut(setting.shortcut, insertion);
            }

            elmt.addEventListener(click, insertion);
        },

        _callback: function (fn, args) {
            if (typeof fn === 'function') {
                return fn.apply(this, args);
            }
        },

        _triggerEvent: function (type) {
            type = type || 'insertion';

            var event = document.createEvent("Event");

            event.initEvent(type, false, false);

            this.textarea.dispatchEvent(event);
        },

        _command: function () {
            var position = this.getPosition(),
                content  = this.textarea.value.substring(0, position),
                matches  = content.match(/\w+$/),
                command;

            if (matches) {
                command = matches[0];

                if (this.settings.commands[command]) {
                    var string = this.settings.commands[command].apply(this);

                    this.setSelection(position - command.length, command.length);
                    this.insert(string, { select: 0 });

                    return true;
                }
            }
        }
    };

    MarkItUp.prototype.utils = MarkItUp.utils = {
        getPath: function () {
            var scripts = document.getElementsByTagName('script'),
                len = scripts.length,
                path;

            for (var i = 0; i < len; i++) {
                var matches = scripts[i].src.match(/(.*)markitup(\.min)?\.js$/);

                if (matches) {
                    path = matches[1];
                    break;
                }
            }

            return path;
        },

        extend: function (obj1, obj2) {
            if (!obj1) {
                obj1 = {};
            }

            if (!obj2) {
                obj2 = {};
            }

            for (var key in obj1) {
                if (typeof obj2[key] === 'undefined') {
                    obj2[key] = obj1[key];
                }
            }

            return obj2;
        },

        closeDropdowns: function () {
            var dropdowns = document.querySelectorAll('.markitup-open');

            [].forEach.call(dropdowns, function (elmt) {
                setTimeout(function () {
                    MarkItUp.utils.removeClass(elmt, 'markitup-open');
                }, 10);
            });
        },

        escapeREChars: function (string) {
            return ('' + string).replace(/[:.?*+^$[\]\\(){}|-]/g, "\\$&");
        },

        classRE: function (className) {
            return new RegExp('(^|\\s+)' + className + '(\\s+|$)');
        },

        hasClass: function (elmt, className) {
            return MarkItUp.utils.classRE(className).test(elmt.className);
        },

        addClass: function (elmt, className) {
            if (!MarkItUp.utils.hasClass(elmt, className) ) {
                elmt.className = elmt.className + ' ' + className;
            }
        },

        removeClass: function (elmt, className) {
            elmt.className = elmt.className.replace(MarkItUp.utils.classRE(className), '');
        },

        queryString: function (data) {
            return Object.keys(data).map(function(key) {
                return encodeURIComponent(key) + '=' + encodeURIComponent(data[key]);
            }).join('&');
        },

        fragment: function (html) {
            var container,
                tag   = html.match(/^\s*<(\w+|!)[^>]*>/)[1],
                div   = document.createElement('div'),
                table = document.createElement('table'),
                tbody = document.createElement('tbody'),
                tr    = document.createElement('tr'),
                containers = {
                    'thead': table,
                    'tbody': table,
                    'tfoot': table,
                    'tr': tbody,
                    'td': tr,
                    'th': tr
                };

            if (containers[tag]) {
                container = containers[tag];
            } else {
                container = div;
            }

            container.innerHTML = html;

            return container.childNodes[0];
        }
    };

    MarkItUp.plugins = {};

    MarkItUp.register = function (Plugin) {
        MarkItUp.plugins[Plugin.id] = Plugin;
    };

    MarkItUp.icons = {
        "align-center": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1792 1344v128q0 26-19 45t-45 19H64q-26 0-45-19t-19-45v-128q0-26 19-45t45-19h1664q26 0 45 19t19 45zm-384-384v128q0 26-19 45t-45 19H448q-26 0-45-19t-19-45V960q0-26 19-45t45-19h896q26 0 45 19t19 45zm256-384v128q0 26-19 45t-45 19H192q-26 0-45-19t-19-45V576q0-26 19-45t45-19h1408q26 0 45 19t19 45zm-384-384v128q0 26-19 45t-45 19H576q-26 0-45-19t-19-45V192q0-26 19-45t45-19h640q26 0 45 19t19 45z\"/></svg>",
        "align-justify": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1792 1344v128q0 26-19 45t-45 19H64q-26 0-45-19t-19-45v-128q0-26 19-45t45-19h1664q26 0 45 19t19 45zm0-384v128q0 26-19 45t-45 19H64q-26 0-45-19t-19-45V960q0-26 19-45t45-19h1664q26 0 45 19t19 45zm0-384v128q0 26-19 45t-45 19H64q-26 0-45-19T0 704V576q0-26 19-45t45-19h1664q26 0 45 19t19 45zm0-384v128q0 26-19 45t-45 19H64q-26 0-45-19T0 320V192q0-26 19-45t45-19h1664q26 0 45 19t19 45z\"/></svg>",
        "align-left": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1792 1344v128q0 26-19 45t-45 19H64q-26 0-45-19t-19-45v-128q0-26 19-45t45-19h1664q26 0 45 19t19 45zm-384-384v128q0 26-19 45t-45 19H64q-26 0-45-19t-19-45V960q0-26 19-45t45-19h1280q26 0 45 19t19 45zm256-384v128q0 26-19 45t-45 19H64q-26 0-45-19T0 704V576q0-26 19-45t45-19h1536q26 0 45 19t19 45zm-384-384v128q0 26-19 45t-45 19H64q-26 0-45-19T0 320V192q0-26 19-45t45-19h1152q26 0 45 19t19 45z\"/></svg>",
        "align-right": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1792 1344v128q0 26-19 45t-45 19H64q-26 0-45-19t-19-45v-128q0-26 19-45t45-19h1664q26 0 45 19t19 45zm0-384v128q0 26-19 45t-45 19H448q-26 0-45-19t-19-45V960q0-26 19-45t45-19h1280q26 0 45 19t19 45zm0-384v128q0 26-19 45t-45 19H192q-26 0-45-19t-19-45V576q0-26 19-45t45-19h1536q26 0 45 19t19 45zm0-384v128q0 26-19 45t-45 19H576q-26 0-45-19t-19-45V192q0-26 19-45t45-19h1152q26 0 45 19t19 45z\"/></svg>",
        "anchor": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M960 256q0-26-19-45t-45-19-45 19-19 45 19 45 45 19 45-19 19-45zm832 928v352q0 22-20 30-8 2-12 2-13 0-23-9l-93-93q-119 143-318.5 226.5T896 1776t-429.5-83.5T148 1466l-93 93q-9 9-23 9-4 0-12-2-20-8-20-30v-352q0-14 9-23t23-9h352q22 0 30 20 8 19-7 35l-100 100q67 91 189.5 153.5T768 1543V896H576q-26 0-45-19t-19-45V704q0-26 19-45t45-19h192V477q-58-34-93-92.5T640 256q0-106 75-181T896 0t181 75 75 181q0 70-35 128.5t-93 92.5v163h192q26 0 45 19t19 45v128q0 26-19 45t-45 19h-192v647q149-20 271.5-82.5T1485 1307l-100-100q-15-16-7-35 8-20 30-20h352q14 0 23 9t9 23z\"/></svg>",
        "bold": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M747 1521q74 32 140 32 376 0 376-335 0-114-41-180-27-44-61.5-74t-67.5-46.5-80.5-25-84-10.5-94.5-2q-73 0-101 10 0 53-.5 159t-.5 158q0 8-1 67.5t-.5 96.5 4.5 83.5 12 66.5zm-14-746q42 7 109 7 82 0 143-13t110-44.5 74.5-89.5 25.5-142q0-70-29-122.5t-79-82T979 245t-124-14q-50 0-130 13 0 50 4 151t4 152q0 27-.5 80t-.5 79q0 46 1 69zm-541 889l2-94q15-4 85-16t106-27q7-12 12.5-27t8.5-33.5 5.5-32.5 3-37.5.5-34V1297q0-982-22-1025-4-8-22-14.5t-44.5-11-49.5-7-48.5-4.5-30.5-3l-4-83q98-2 340-11.5t373-9.5q23 0 68.5.5t67.5.5q70 0 136.5 13t128.5 42 108 71 74 104.5 28 137.5q0 52-16.5 95.5t-39 72T1398 722t-73 45-84 40q154 35 256.5 134t102.5 248q0 100-35 179.5t-93.5 130.5-138 85.5T1170 1633t-176 14q-44 0-132-3t-132-3q-106 0-307 11t-231 12z\"/></svg>",
        "bolt": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1333 566q18 20 7 44L800 1767q-13 25-42 25-4 0-14-2-17-5-25.5-19t-4.5-30l197-808-406 101q-4 1-12 1-18 0-31-11-18-15-13-39l201-825q4-14 16-23t28-9h328q19 0 32 12.5t13 29.5q0 8-5 18L891 651l396-98q8-2 12-2 19 0 34 15z\"/></svg>",
        "char": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1362 1185q0 153-99.5 263.5T1004 1585v175q0 14-9 23t-23 9H837q-13 0-22.5-9.5T805 1760v-175q-66-9-127.5-31T576 1509.5t-74-48-46.5-37.5-17.5-18q-17-21-2-41l103-135q7-10 23-12 15-2 24 9l2 2q113 99 243 125 37 8 74 8 81 0 142.5-43t61.5-122q0-28-15-53t-33.5-42-58.5-37.5-66-32-80-32.5q-39-16-61.5-25T733 948.5t-62.5-31T614 882t-53.5-42.5-43.5-49-35.5-58-21-66.5-8.5-78q0-138 98-242t255-134V32q0-13 9.5-22.5T837 0h135q14 0 23 9t9 23v176q57 6 110.5 23t87 33.5T1265 302t39 29 15 14q17 18 5 38l-81 146q-8 15-23 16-14 3-27-7-3-3-14.5-12t-39-26.5-58.5-32-74.5-26T921 430q-95 0-155 43t-60 111q0 26 8.5 48t29.5 41.5 39.5 33 56 31 60.5 27 70 27.5q53 20 81 31.5t76 35 75.5 42.5 62 50 53 63.5 31.5 76.5 13 94z\"/></svg>",
        "check": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1671 566q0 40-28 68l-724 724-136 136q-28 28-68 28t-68-28l-136-136-362-362q-28-28-28-68t28-68l136-136q28-28 68-28t68 28l294 295 656-657q28-28 68-28t68 28l136 136q28 28 28 68z\"/></svg>",
        "code": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M553 1399l-50 50q-10 10-23 10t-23-10L-9 983q-10-10-10-23t10-23l466-466q10-10 23-10t23 10l50 50q10 10 10 23t-10 23L160 960l393 393q10 10 10 23t-10 23zm591-1067L771 1623q-4 13-15.5 19.5T732 1645l-62-17q-13-4-19.5-15.5T648 1588l373-1291q4-13 15.5-19.5t23.5-2.5l62 17q13 4 19.5 15.5t2.5 24.5zm657 651l-466 466q-10 10-23 10t-23-10l-50-50q-10-10-10-23t10-23l393-393-393-393q-10-10-10-23t10-23l50-50q10-10 23-10t23 10l466 466q10 10 10 23t-10 23z\"/></svg>",
        "cogs": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M832 896q0-106-75-181t-181-75-181 75-75 181 75 181 181 75 181-75 75-181zm768 512q0-52-38-90t-90-38-90 38-38 90q0 53 37.5 90.5t90.5 37.5 90.5-37.5 37.5-90.5zm0-1024q0-52-38-90t-90-38-90 38-38 90q0 53 37.5 90.5T1472 512t90.5-37.5T1600 384zm-384 421v185q0 10-7 19.5t-16 10.5l-155 24q-11 35-32 76 34 48 90 115 7 10 7 20 0 12-7 19-23 30-82.5 89.5T935 1423q-11 0-21-7l-115-90q-37 19-77 31-11 108-23 155-7 24-30 24H483q-11 0-20-7.5t-10-17.5l-23-153q-34-10-75-31l-118 89q-7 7-20 7-11 0-21-8-144-133-144-160 0-9 7-19 10-14 41-53t47-61q-23-44-35-82l-152-24q-10-1-17-9.5t-7-19.5V802q0-10 7-19.5t16-10.5l155-24q11-35 32-76-34-48-90-115-7-11-7-20 0-12 7-20 22-30 82-89t79-59q11 0 21 7l115 90q34-18 77-32 11-108 23-154 7-24 30-24h186q11 0 20 7.5t10 17.5l23 153q34 10 75 31l118-89q8-7 20-7 11 0 21 8 144 133 144 160 0 9-7 19-12 16-42 54t-45 60q23 48 34 82l152 23q10 2 17 10.5t7 19.5zm640 533v140q0 16-149 31-12 27-30 52 51 113 51 138 0 4-4 7-122 71-124 71-8 0-46-47t-52-68q-20 2-30 2t-30-2q-14 21-52 68t-46 47q-2 0-124-71-4-3-4-7 0-25 51-138-18-25-30-52-149-15-149-31v-140q0-16 149-31 13-29 30-52-51-113-51-138 0-4 4-7 4-2 35-20t59-34 30-16q8 0 46 46.5t52 67.5q20-2 30-2t30 2q51-71 92-112l6-2q4 0 124 70 4 3 4 7 0 25-51 138 17 23 30 52 149 15 149 31zm0-1024v140q0 16-149 31-12 27-30 52 51 113 51 138 0 4-4 7-122 71-124 71-8 0-46-47t-52-68q-20 2-30 2t-30-2q-14 21-52 68t-46 47q-2 0-124-71-4-3-4-7 0-25 51-138-18-25-30-52-149-15-149-31V314q0-16 149-31 13-29 30-52-51-113-51-138 0-4 4-7 4-2 35-20t59-34 30-16q8 0 46 46.5t52 67.5q20-2 30-2t30 2q51-71 92-112l6-2q4 0 124 70 4 3 4 7 0 25-51 138 17 23 30 52 149 15 149 31z\"/></svg>",
        "color": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"216\" height=\"146\" viewBox=\"0 0 216 146\"><path d=\"M143.113 68.845c-.326-.489-2.024-2.946-5.092-7.373-3.069-4.427-5.812-8.528-8.229-12.303s-5.118-8.609-8.106-14.502c-2.987-5.893-5.242-11.366-6.762-16.417-.435-1.629-1.344-2.906-2.73-3.829-1.383-.923-2.782-1.385-4.194-1.385s-2.797.462-4.155 1.385-2.281 2.2-2.77 3.829c-1.521 5.051-3.775 10.524-6.762 16.417s-5.689 10.727-8.106 14.502-5.16 7.876-8.229 12.303c-3.069 4.427-4.766 6.884-5.092 7.373-4.399 7.062-6.599 14.53-6.599 22.405 0 11.516 4.074 21.346 12.221 29.493S96.485 132.965 108 132.965c11.514 0 21.346-4.074 29.493-12.222s12.222-17.978 12.222-29.493c0-8.039-2.201-15.507-6.602-22.405zm-38.168 40.207c-2.038 2.037-4.495 3.056-7.374 3.056-2.878 0-5.336-1.019-7.373-3.056-2.037-2.036-3.056-4.495-3.056-7.373 0-1.956.544-3.829 1.63-5.622.055-.055.475-.664 1.263-1.832s1.48-2.201 2.078-3.097c.598-.897 1.277-2.091 2.037-3.585.76-1.494 1.331-2.865 1.711-4.113.217-.869.788-1.305 1.711-1.305s1.494.436 1.711 1.305c.38 1.248.951 2.619 1.711 4.113.76 1.494 1.439 2.689 2.037 3.585.597.896 1.289 1.929 2.077 3.097.787 1.168 1.208 1.777 1.263 1.832 1.086 1.793 1.629 3.666 1.629 5.622 0 2.878-1.019 5.337-3.055 7.373z\"/></svg>",
        "cross": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1490 1322q0 40-28 68l-136 136q-28 28-68 28t-68-28l-294-294-294 294q-28 28-68 28t-68-28l-136-136q-28-28-28-68t28-68l294-294-294-294q-28-28-28-68t28-68l136-136q28-28 68-28t68 28l294 294 294-294q28-28 68-28t68 28l136 136q28 28 28 68t-28 68l-294 294 294 294q28 28 28 68z\"/></svg>",
        "file": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1152 512V40q22 14 36 28l408 408q14 14 28 36h-472zm-128 32q0 40 28 68t68 28h544v1056q0 40-28 68t-68 28H224q-40 0-68-28t-28-68V96q0-40 28-68t68-28h800v544z\"/></svg>",
        "font": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M789 559l-170 450q33 0 136.5 2t160.5 2q19 0 57-2-87-253-184-452zM64 1664l2-79q23-7 56-12.5t57-10.5 49.5-14.5 44.5-29 31-50.5l237-616 280-724h128q8 14 11 21l205 480q33 78 106 257.5t114 274.5q15 34 58 144.5t72 168.5q20 45 35 57 19 15 88 29.5t84 20.5q6 38 6 57 0 4-.5 13t-.5 13q-63 0-190-8t-191-8q-76 0-215 7t-178 8q0-43 4-78l131-28q1 0 12.5-2.5t15.5-3.5 14.5-4.5 15-6.5 11-8 9-11 2.5-14q0-16-31-96.5t-72-177.5-42-100l-450-2q-26 58-76.5 195.5T446 1489q0 22 14 37.5t43.5 24.5 48.5 13.5 57 8.5 41 4q1 19 1 58 0 9-2 27-58 0-174.5-10T300 1642q-8 0-26.5 4t-21.5 4q-80 14-188 14z\"/></svg>",
        "header": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1682 1664q-44 0-132.5-3.5T1416 1657q-44 0-132 3.5t-132 3.5q-24 0-37-20.5t-13-45.5q0-31 17-46t39-17 51-7 45-15q33-21 33-140l-1-391q0-21-1-31-13-4-50-4H560q-38 0-51 4-1 10-1 31l-1 371q0 142 37 164 16 10 48 13t57 3.5 45 15 20 45.5q0 26-12.5 48t-36.5 22q-47 0-139.5-3.5T387 1657q-43 0-128 3.5t-127 3.5q-23 0-35.5-21T84 1598q0-30 15.5-45t36-17.5 47.5-7.5 42-15q33-23 33-143l-1-57V500q0-3 .5-26t0-36.5T256 399t-3.5-42-6.5-36.5-11-31.5-16-18q-15-10-45-12t-53-2-41-14-18-45q0-26 12-48t36-22q46 0 138.5 3.5T387 135q42 0 126.5-3.5T640 128q25 0 37.5 22t12.5 48q0 30-17 43.5T634.5 256t-49.5 4-43 13q-35 21-35 160l1 320q0 21 1 32 13 3 39 3h699q25 0 38-3 1-11 1-32l1-320q0-139-35-160-18-11-58.5-12.5t-66-13T1102 198q0-26 12.5-48t37.5-22q44 0 132 3.5t132 3.5q43 0 129-3.5t129-3.5q25 0 37.5 22t12.5 48q0 30-17.5 44t-40 14.5-51.5 3-44 12.5q-35 23-35 161l1 943q0 119 34 140 16 10 46 13.5t53.5 4.5 41.5 15.5 18 44.5q0 26-12 48t-36 22z\"/></svg>",
        "indent": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M352 832q0 14-9 23L55 1143q-9 9-23 9-13 0-22.5-9.5T0 1120V544q0-13 9.5-22.5T32 512q14 0 23 9l288 288q9 9 9 23zm1440 480v192q0 13-9.5 22.5t-22.5 9.5H32q-13 0-22.5-9.5T0 1504v-192q0-13 9.5-22.5T32 1280h1728q13 0 22.5 9.5t9.5 22.5zm0-384v192q0 13-9.5 22.5t-22.5 9.5H672q-13 0-22.5-9.5T640 1120V928q0-13 9.5-22.5T672 896h1088q13 0 22.5 9.5t9.5 22.5zm0-384v192q0 13-9.5 22.5T1760 768H672q-13 0-22.5-9.5T640 736V544q0-13 9.5-22.5T672 512h1088q13 0 22.5 9.5t9.5 22.5zm0-384v192q0 13-9.5 22.5T1760 384H32q-13 0-22.5-9.5T0 352V160q0-13 9.5-22.5T32 128h1728q13 0 22.5 9.5t9.5 22.5z\"/></svg>",
        "italic": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M384 1662l17-85q6-2 81.5-21.5T594 1518q28-35 41-101 1-7 62-289t114-543.5T863 288v-25q-24-13-54.5-18.5t-69.5-8-58-5.5l19-103q33 2 120 6.5t149.5 7T1090 144q48 0 98.5-2.5t121-7 98.5-6.5q-5 39-19 89-30 10-101.5 28.5T1179 279q-8 19-14 42.5t-9 40-7.5 45.5-6.5 42q-27 148-87.5 419.5T977 1224q-2 9-13 58t-20 90-16 83.5-6 57.5l1 18q17 4 185 31-3 44-16 99-11 0-32.5 1.5t-32.5 1.5q-29 0-87-10t-86-10q-138-2-206-2-51 0-143 9t-121 11z\"/></svg>",
        "link": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1520 1216q0-40-28-68l-208-208q-28-28-68-28-42 0-72 32 3 3 19 18.5t21.5 21.5 15 19 13 25.5 3.5 27.5q0 40-28 68t-68 28q-15 0-27.5-3.5t-25.5-13-19-15-21.5-21.5-18.5-19q-33 31-33 73 0 40 28 68l206 207q27 27 68 27 40 0 68-26l147-146q28-28 28-67zM817 511q0-40-28-68L583 236q-28-28-68-28-39 0-68 27L300 381q-28 28-28 67 0 40 28 68l208 208q27 27 68 27 42 0 72-31-3-3-19-18.5T607.5 680t-15-19-13-25.5T576 608q0-40 28-68t68-28q15 0 27.5 3.5t25.5 13 19 15 21.5 21.5 18.5 19q33-31 33-73zm895 705q0 120-85 203l-147 146q-83 83-203 83-121 0-204-85l-206-207q-83-83-83-203 0-123 88-209l-88-88q-86 88-208 88-120 0-204-84L164 652q-84-84-84-204t85-203L312 99q83-83 203-83 121 0 204 85l206 207q83 83 83 203 0 123-88 209l88 88q86-88 208-88 120 0 204 84l208 208q84 84 84 204z\"/></svg>",
        "list-ol": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M381 1620q0 80-54.5 126T191 1792q-106 0-172-66l57-88q49 45 106 45 29 0 50.5-14.5T254 1626q0-64-105-56l-26-56q8-10 32.5-43.5t42.5-54 37-38.5v-1q-16 0-48.5 1t-48.5 1v53H32v-152h333v88l-95 115q51 12 81 49t30 88zm2-627v159H21q-6-36-6-54 0-51 23.5-93T95 937t66-47.5 56.5-43.5 23.5-45q0-25-14.5-38.5T187 749q-46 0-81 58l-85-59q24-51 71.5-79.5T198 640q73 0 123 41.5T371 794q0 50-34 91.5T262 950t-75.5 50.5T151 1053h127v-60h105zm1409 319v192q0 13-9.5 22.5t-22.5 9.5H544q-13 0-22.5-9.5T512 1504v-192q0-14 9-23t23-9h1216q13 0 22.5 9.5t9.5 22.5zM384 413v99H49v-99h107q0-41 .5-122t.5-121v-12h-2q-8 17-50 54l-71-76L170 9h106v404h108zm1408 387v192q0 13-9.5 22.5t-22.5 9.5H544q-13 0-22.5-9.5T512 992V800q0-14 9-23t23-9h1216q13 0 22.5 9.5t9.5 22.5zm0-512v192q0 13-9.5 22.5T1760 512H544q-13 0-22.5-9.5T512 480V288q0-13 9.5-22.5T544 256h1216q13 0 22.5 9.5t9.5 22.5z\"/></svg>",
        "list-ul": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M384 1408q0 80-56 136t-136 56-136-56-56-136 56-136 136-56 136 56 56 136zm0-512q0 80-56 136t-136 56-136-56T0 896t56-136 136-56 136 56 56 136zm1408 416v192q0 13-9.5 22.5t-22.5 9.5H544q-13 0-22.5-9.5T512 1504v-192q0-13 9.5-22.5t22.5-9.5h1216q13 0 22.5 9.5t9.5 22.5zM384 384q0 80-56 136t-136 56-136-56T0 384t56-136 136-56 136 56 56 136zm1408 416v192q0 13-9.5 22.5t-22.5 9.5H544q-13 0-22.5-9.5T512 992V800q0-13 9.5-22.5T544 768h1216q13 0 22.5 9.5t9.5 22.5zm0-512v192q0 13-9.5 22.5T1760 512H544q-13 0-22.5-9.5T512 480V288q0-13 9.5-22.5T544 256h1216q13 0 22.5 9.5t9.5 22.5z\"/></svg>",
        "magic": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1254 581l293-293-107-107-293 293zm447-293q0 27-18 45L397 1619q-18 18-45 18t-45-18l-198-198q-18-18-18-45t18-45L1395 45q18-18 45-18t45 18l198 198q18 18 18 45zM350 98l98 30-98 30-30 98-30-98-98-30 98-30 30-98zm350 162l196 60-196 60-60 196-60-196-196-60 196-60 60-196zm930 478l98 30-98 30-30 98-30-98-98-30 98-30 30-98zM990 98l98 30-98 30-30 98-30-98-98-30 98-30 30-98z\"/></svg>",
        "outdent": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M384 544v576q0 13-9.5 22.5T352 1152q-14 0-23-9L41 855q-9-9-9-23t9-23l288-288q9-9 23-9 13 0 22.5 9.5T384 544zm1408 768v192q0 13-9.5 22.5t-22.5 9.5H32q-13 0-22.5-9.5T0 1504v-192q0-13 9.5-22.5T32 1280h1728q13 0 22.5 9.5t9.5 22.5zm0-384v192q0 13-9.5 22.5t-22.5 9.5H672q-13 0-22.5-9.5T640 1120V928q0-13 9.5-22.5T672 896h1088q13 0 22.5 9.5t9.5 22.5zm0-384v192q0 13-9.5 22.5T1760 768H672q-13 0-22.5-9.5T640 736V544q0-13 9.5-22.5T672 512h1088q13 0 22.5 9.5t9.5 22.5zm0-384v192q0 13-9.5 22.5T1760 384H32q-13 0-22.5-9.5T0 352V160q0-13 9.5-22.5T32 128h1728q13 0 22.5 9.5t9.5 22.5z\"/></svg>",
        "paragraph": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1534 189v73q0 29-18.5 61t-42.5 32q-50 0-54 1-26 6-32 31-3 11-3 64v1152q0 25-18 43t-43 18h-108q-25 0-43-18t-18-43V385h-143v1218q0 25-17.5 43t-43.5 18H842q-26 0-43.5-18t-17.5-43v-496q-147-12-245-59-126-58-192-179-64-117-64-259 0-166 88-286 88-118 209-159 111-37 417-37h479q25 0 43 18t18 43z\"/></svg>",
        "picture": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M576 576q0 80-56 136t-136 56-136-56-56-136 56-136 136-56 136 56 56 136zm1024 384v448H192v-192l320-320 160 160 512-512zm96-704H96q-13 0-22.5 9.5T64 288v1216q0 13 9.5 22.5T96 1536h1600q13 0 22.5-9.5t9.5-22.5V288q0-13-9.5-22.5T1696 256zm160 32v1216q0 66-47 113t-113 47H96q-66 0-113-47t-47-113V288q0-66 47-113t113-47h1600q66 0 113 47t47 113z\"/></svg>",
        "preview": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1664 960q-152-236-381-353 61 104 61 225 0 185-131.5 316.5T896 1280t-316.5-131.5T448 832q0-121 61-225-229 117-381 353 133 205 333.5 326.5T896 1408t434.5-121.5T1664 960zM944 576q0-20-14-34t-34-14q-125 0-214.5 89.5T592 832q0 20 14 34t34 14 34-14 14-34q0-86 61-147t147-61q20 0 34-14t14-34zm848 384q0 34-20 69-140 230-376.5 368.5T896 1536t-499.5-139T20 1029Q0 994 0 960t20-69q140-229 376.5-368T896 384t499.5 139T1772 891q20 35 20 69z\"/></svg>",
        "quote": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M832 960v384q0 80-56 136t-136 56H256q-80 0-136-56t-56-136V640q0-104 40.5-198.5T214 278t163.5-109.5T576 128h64q26 0 45 19t19 45v128q0 26-19 45t-45 19h-64q-106 0-181 75t-75 181v32q0 40 28 68t68 28h224q80 0 136 56t56 136zm896 0v384q0 80-56 136t-136 56h-384q-80 0-136-56t-56-136V640q0-104 40.5-198.5T1110 278t163.5-109.5T1472 128h64q26 0 45 19t19 45v128q0 26-19 45t-45 19h-64q-106 0-181 75t-75 181v32q0 40 28 68t68 28h224q80 0 136 56t56 136z\"/></svg>",
        "smiley": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1262 1075q-37 121-138 195t-228 74-228-74-138-195q-8-25 4-48.5t38-31.5q25-8 48.5 4t31.5 38q25 80 92.5 129.5T896 1216t151.5-49.5T1140 1037q8-26 32-38t49-4 37 31.5 4 48.5zM768 640q0 53-37.5 90.5T640 768t-90.5-37.5T512 640t37.5-90.5T640 512t90.5 37.5T768 640zm512 0q0 53-37.5 90.5T1152 768t-90.5-37.5T1024 640t37.5-90.5T1152 512t90.5 37.5T1280 640zm256 256q0-130-51-248.5t-136.5-204-204-136.5T896 256t-248.5 51-204 136.5-136.5 204T256 896t51 248.5 136.5 204 204 136.5 248.5 51 248.5-51 204-136.5 136.5-204 51-248.5zm128 0q0 209-103 385.5T1281.5 1561 896 1664t-385.5-103T231 1281.5 128 896t103-385.5T510.5 231 896 128t385.5 103T1561 510.5 1664 896z\"/></svg>",
        "strikethrough": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1760 896q14 0 23 9t9 23v64q0 14-9 23t-23 9H32q-14 0-23-9t-9-23v-64q0-14 9-23t23-9h1728zM483 832q-28-35-51-80-48-97-48-188 0-181 134-309 133-127 393-127 50 0 167 19 66 12 177 48 10 38 21 118 14 123 14 183 0 18-5 45l-12 3-84-6-14-2q-50-149-103-205-88-91-210-91-114 0-182 59-67 58-67 146 0 73 66 140t279 129q69 20 173 66 58 28 95 52H483zm507 256h411q7 39 7 92 0 111-41 212-23 55-71 104-37 35-109 81-80 48-153 66-80 21-203 21-114 0-195-23l-140-40q-57-16-72-28-8-8-8-22v-13q0-108-2-156-1-30 0-68l2-37v-44l102-2q15 34 30 71t22.5 56 12.5 27q35 57 80 94 43 36 105 57 59 22 132 22 64 0 139-27 77-26 122-86 47-61 47-129 0-84-81-157-34-29-137-71z\"/></svg>",
        "subscript": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1025 1369v167H777l-159-252-24-42q-8-9-11-21h-3l-9 21q-10 20-25 44l-155 250H133v-167h128l197-291-185-272H136V638h276l139 228q2 4 23 42 8 9 11 21h3q3-9 11-21l25-42 140-228h257v168H896l-184 267 204 296h109zm639 217v206h-514l-4-27q-3-45-3-46 0-64 26-117t65-86.5 84-65 84-54.5 65-54 26-64q0-38-29.5-62.5T1393 1191q-51 0-97 39-14 11-36 38l-105-92q26-37 63-66 80-65 188-65 110 0 178 59.5t68 158.5q0 66-34.5 118.5t-84 86-99.5 62.5-87 63-41 73h232v-80h126z\"/></svg>",
        "superscript": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1025 1369v167H777l-159-252-24-42q-8-9-11-21h-3l-9 21q-10 20-25 44l-155 250H133v-167h128l197-291-185-272H136V638h276l139 228q2 4 23 42 8 9 11 21h3q3-9 11-21l25-42 140-228h257v168H896l-184 267 204 296h109zm637-679v206h-514l-3-27q-4-28-4-46 0-64 26-117t65-86.5 84-65 84-54.5 65-54 26-64q0-38-29.5-62.5T1391 295q-51 0-97 39-14 11-36 38l-105-92q26-37 63-66 83-65 188-65 110 0 178 59.5t68 158.5q0 56-24.5 103t-62 76.5T1482 605t-82 50.5-65.5 51.5-30.5 63h232v-80h126z\"/></svg>",
        "underline": "<svg width=\"1792\" height=\"1792\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M176 223q-37-2-45-4l-3-88q13-1 40-1 60 0 112 4 132 7 166 7 86 0 168-3 116-4 146-5 56 0 86-2l-1 14 2 64v9q-60 9-124 9-60 0-79 25-13 14-13 132 0 13 .5 32.5t.5 25.5l1 229 14 280q6 124 51 202 35 59 96 92 88 47 177 47 104 0 191-28 56-18 99-51 48-36 65-64 36-56 53-114 21-73 21-229 0-79-3.5-128t-11-122.5T1372 396l-4-59q-5-67-24-88-34-35-77-34l-100 2-14-3 2-86h84l205 10q76 3 196-10l18 2q6 38 6 51 0 7-4 31-45 12-84 13-73 11-79 17-15 15-15 41 0 7 1.5 27t1.5 31q8 19 22 396 6 195-15 304-15 76-41 122-38 65-112 123-75 57-182 89-109 33-255 33-167 0-284-46-119-47-179-122-61-76-83-195-16-80-16-237V475q0-188-17-213-25-36-147-39zm1488 1409v-64q0-14-9-23t-23-9H160q-14 0-23 9t-9 23v64q0 14 9 23t23 9h1472q14 0 23-9t9-23z\"/></svg>"
    };

    return MarkItUp;
});
