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
                select:    !!this.getSelection().text,
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
                    content = content.replace(/\n/g, '\n' + self.tabs());
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

    MarkItUp.icons = { /* insert SVG icons here */ };

    return MarkItUp;
});
