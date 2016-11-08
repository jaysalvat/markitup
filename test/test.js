/* global MarkItUp, QUnit, $ */
/* jshint strict:false */

/*
 * TODO:
 * - Test indent/outdent
 * - Test dialogs
 * - Test shortcuts and try to test Alt+Click
 */

var fixtures = [
    'line 1 content',
    'line 2 content',
    'line 3 content',
    'line 4 content',
    'line 5 content'
];

function createNewMarkItUp (options) {
    $('.markitup-container').remove();

    var $textarea = $('<textarea />');

    $textarea.val(fixtures.join('\n'));
    $textarea.appendTo('body');

    var markitup = new MarkItUp($textarea[0], options);

    return markitup;
}

QUnit.assert.contains = function (needle, haystack, message) {
  var actual = haystack.indexOf(needle) > -1;

  this.push(actual, actual, needle, message);
};

QUnit.test("set/getElements", function (assert) {
    var markitup, container, textarea, preview;

    markitup = createNewMarkItUp({
        preview: true
    });

    container = markitup.getContainer();
    assert.equal(container.className.trim(), 'markitup-container');

    textarea = markitup.getTextarea();
    assert.equal(textarea.className.trim(), 'markitup-textarea');

    preview = markitup.getPreview();
    assert.equal(preview.className.trim(), 'markitup-preview');
});

QUnit.test("set/getOptions", function (assert) {
    var markitup, options, option;

    markitup = createNewMarkItUp();

    options = markitup.getOptions();
    assert.equal(typeof options, 'object');

    markitup.setOptions({
        'newSetting': '1'
    });
    options = markitup.getOptions();
    assert.equal(options.newSetting, '1');

    markitup.setOption('newSettings', '2');
    option = markitup.getOption('newSettings');
    assert.equal(option, '2');
});

QUnit.test("width/height", function (assert) {
    var markitup, textarea;

    markitup = createNewMarkItUp({
        width: 100,
        height: 100,
    });

    textarea = markitup.getTextarea();

    assert.equal(textarea.style.width, '100px');
    assert.equal(textarea.style.height, '100px');
});

QUnit.test("set/getContent", function (assert) {
    var markitup, content;

    markitup = createNewMarkItUp();

    content = markitup.getContent();

    assert.equal(content, fixtures.join('\n'));
});

QUnit.test("set/getPosition", function (assert) {
    var markitup, position;

    markitup = createNewMarkItUp();

    markitup.setPosition(1);
    position = markitup.getPosition();
    assert.equal(position, 1);

    markitup.setPosition(5);
    position = markitup.getPosition();
    assert.equal(position, 5);

    markitup.setPosition(10);
    position = markitup.getPosition();
    assert.equal(position, 10);

    markitup.setPosition('first');
    position = markitup.getPosition();
    assert.equal(position, 0);

    markitup.setPosition('last');
    position = markitup.getPosition();
    assert.equal(position, markitup.getContent().length);
});

QUnit.test("set/getSelection", function (assert) {
    var markitup, selection;

    markitup = createNewMarkItUp();

    markitup.setSelection(5, 1);
    selection = markitup.getSelection();
    assert.equal(selection.start, 5);
    assert.equal(selection.end, 6);
    assert.equal(selection.len, 1);
    assert.equal(selection.text, '1');

    markitup.setSelection(7, 12);
    selection = markitup.getSelection();
    assert.equal(selection.start, 7);
    assert.equal(selection.end, 19);
    assert.equal(selection.len, 12);
    assert.equal(selection.text, 'content\nline');
});

QUnit.test("set/getLine", function (assert) {
    var markitup, line, line1, line2, position, selection;

    markitup = createNewMarkItUp();

    line = markitup.getLine(2);
    assert.equal(line.number,   2);
    assert.equal(line.start,    2 * 15 - 15);
    assert.equal(line.end,      2 * 15);
    assert.equal(line.len,      15);
    assert.equal(line.total,    5);
    assert.equal(line.text,     fixtures[1]);

    line = markitup.getLine('first');
    assert.equal(line.number,   1);
    assert.equal(line.start,    1 * 15 - 15);
    assert.equal(line.end,      1 * 15);
    assert.equal(line.len,      15);
    assert.equal(line.total,    5);
    assert.equal(line.text,     fixtures[0]);

    line = markitup.getLine('last');
    assert.equal(line.number,   5);
    assert.equal(line.start,    5 * 15 - 15);
    assert.equal(line.end,      5 * 15);
    assert.equal(line.len,      15);
    assert.equal(line.total,    5);
    assert.equal(line.text,     fixtures[4]);

    line1 = markitup.getLine(1);
    line2 = markitup.getLine('first');
    assert.deepEqual(line1, line2);

    line1 = markitup.getLine(5);
    line2 = markitup.getLine('last');
    assert.deepEqual(line1, line2);

    markitup.setLine(2, 'start');
    position = markitup.getPosition();
    selection = markitup.getSelection();
    assert.equal(position, 15);
    assert.equal(selection.len, 0);

    markitup.setLine(2, 'end');
    position = markitup.getPosition();
    selection = markitup.getSelection();
    assert.equal(position, 29);
    assert.equal(selection.len, 0);

    markitup.setLine(2, 'select');
    position  = markitup.getPosition();
    selection = markitup.getSelection();
    assert.equal(position, 15);
    assert.equal(selection.start, 15);
    assert.equal(selection.end, 30);
    assert.equal(selection.len, 15);
});

QUnit.test("set/getLinePosition", function (assert) {
    var markitup, position;

    markitup = createNewMarkItUp();

    markitup.setPosition(20);
    position = markitup.getLinePosition();
    assert.equal(position.line, 2);
    assert.equal(position.position, 20 - (2 * 15 - 15));

    markitup.setPosition(40);
    position = markitup.getLinePosition();
    assert.equal(position.line, 3);
    assert.equal(position.position, 40 - (3 * 15 - 15));
});

QUnit.test("insert", function (assert) {
    var markitup, line1, line2, selection;

    markitup = createNewMarkItUp();

    line1 = markitup.getLine(1);
    markitup.setLine(1, 'start');
    markitup.insert('insertion');
    markitup.setLine(1, 'end');
    markitup.insert('insertion', { select: false });
    line2 = markitup.getLine(1);
    selection = markitup.getSelection();
    assert.equal(line2.text, 'insertion' + line1.text + 'insertion');
    assert.equal(selection.text, '');

    line1 = markitup.getLine(2);
    markitup.setLine(2, 'start');
    markitup.insert('insertion', { select: 'outer' });
    line2 = markitup.getLine(2);
    selection = markitup.getSelection();
    assert.equal(line2.text, 'insertion' + line1.text);
    assert.equal(selection.text, 'insertion');

    markitup = createNewMarkItUp();

    markitup.selectLine(1, 5);
    markitup.insert('insertion', { select: 'outer' });
    selection = markitup.getSelection();
    assert.equal(selection.text, 'insertion');

    markitup = createNewMarkItUp();

    markitup.selectLine(1, 5);
    markitup.insert('insertion', { select: 'outer', multiline: true });
    selection = markitup.getSelection();
    assert.equal(selection.text, 'insertion\ninsertion\ninsertion\ninsertion\ninsertion');
});

QUnit.test("insert/before", function (assert) {
    var markitup, selection1, selection2;

    markitup = createNewMarkItUp();

    selection1 = markitup.selectLine(1);
    markitup.insertBefore('insertion', { select: 'outer' });
    selection2 = markitup.getSelection();
    assert.equal(selection2.text, 'insertion' + selection1.text + '\n');

    markitup = createNewMarkItUp();

    markitup.selectLine(1, 2);
    selection1 = markitup.getSelection();
    markitup.insertBefore('insertion', { select: 'outer' });
    selection2 = markitup.getSelection();
    assert.equal(selection2.text, 'insertion' + selection1.text);

    markitup = createNewMarkItUp();

    markitup.selectLine(1, 2);
    selection1 = markitup.getSelection();
    markitup.insertBefore('insertion', { select: 'outer', multiline: true });
    selection2 = markitup.getSelection();
    assert.equal(selection2.text, 'insertion' + fixtures[0] + '\n' + 'insertion' + fixtures[1] + '\n');
});

QUnit.test("insert/after", function (assert) {
    var markitup, selection1, selection2;

    markitup = createNewMarkItUp();

    selection1 = markitup.selectLine(1);
    markitup.insertAfter('insertion', { select: 'outer' });
    selection2 = markitup.getSelection();
    assert.equal(selection2.text, selection1.text + 'insertion\n');

    markitup = createNewMarkItUp();

    markitup.selectLine(1, 2);
    selection1 = markitup.getSelection();
    markitup.insertAfter('insertion', { select: 'outer' });
    selection2 = markitup.getSelection();
    assert.equal(selection2.text, selection1.text.replace(/\s$/, '') + 'insertion\n');

    markitup = createNewMarkItUp();

    markitup.selectLine(1, 2);
    selection1 = markitup.getSelection();
    markitup.insertAfter('insertion', { select: 'outer', multiline: true });
    selection2 = markitup.getSelection();
    assert.equal(selection2.text, fixtures[0] + 'insertion\n' + fixtures[1] + 'insertion' + '\n');
});

QUnit.test("insert/wrap", function (assert) {
    var markitup, selection1, selection2;

    markitup = createNewMarkItUp();

    selection1 = markitup.selectLine(1);
    markitup.wrap('before', 'after', { select: 'outer' });
    selection2 = markitup.getSelection();
    assert.equal(selection2.text, 'before' + selection1.text + 'after\n');

    markitup = createNewMarkItUp();

    markitup.selectLine(1, 2);
    selection1 = markitup.getSelection();
    markitup.wrap('before', 'after', { select: 'outer', multiline: true });
    selection2 = markitup.getSelection();
    assert.equal(selection2.text, 'before' + fixtures[0] + 'after\nbefore' + fixtures[1] + 'after' + '\n');
});

QUnit.test("parse/vars", function (assert) {
    var markitup, snippet;

    markitup = createNewMarkItUp({
        'vars': {
            'myVar': 'test'
        }
    });

    snippet = markitup.parse('{VAR myVarThatDoesntExist}');
    assert.equal(snippet, '');

    snippet = markitup.parse('{VAR myVar}');
    assert.equal(snippet, 'test');

    snippet = markitup.parse('{VAR myVar:}placeholder{:VAR}');
    assert.equal(snippet, 'test');

    snippet = markitup.parse('{VAR myVarThatDoesntExist:}placeholder{:VAR}');
    assert.equal(snippet, 'placeholder');
});

QUnit.test("parse/funcs", function (assert) {
    var markitup, snippet;

    markitup = createNewMarkItUp({
        'funcs': {
            'myFunc': function () {
                return 'test';
            }
        }
    });

    snippet = markitup.parse('{FN myFuncThatDoesntExist}');
    assert.equal(snippet, '');

    snippet = markitup.parse('{FN myFunc}');
    assert.equal(snippet, 'test');

    snippet = markitup.parse('{FN myFunc:}placeholder{:FN}');
    assert.equal(snippet, 'test');

    snippet = markitup.parse('{FN myFuncThatDoesntExist:}placeholder{:FN}');
    assert.equal(snippet, 'placeholder');

    markitup.setOption('funcs', { myFunc: function (value1, value2) {
            return value1 + ' ' + value2;
        }
    });

    snippet = markitup.parse('{FN myFunc (one, two)}');
    assert.equal(snippet, 'one two');
});

QUnit.test("parse/selection", function (assert)  {
    var markitup, snippet;

    markitup = createNewMarkItUp();

    snippet = markitup.parse('{S}');
    assert.equal(snippet, '');

    snippet = markitup.parse('{S:}{:S}');
    assert.equal(snippet, '');

    snippet = markitup.parse('{S:}placeholder{:S}');
    assert.equal(snippet, 'placeholder');

    markitup.setSelection(0, 6);
    snippet = markitup.parse('{S:}placeholder{:S}');
    assert.equal(snippet, 'line 1');
});

QUnit.test("parse/if", function (assert) {
    var markitup, snippet;

    markitup = createNewMarkItUp({
        'vars': { myVar: 'test' }
    });

    snippet = markitup.parse('{IF myVar:}var exists{:IF}');
    assert.equal(snippet, 'var exists');

    snippet = markitup.parse('{IF myVar:}var exists{ELSE}var does not exist{:IF}');
    assert.equal(snippet, 'var exists');

    snippet = markitup.parse('{IF myVarThatDoesntExist:}var exists{:IF}');
    assert.equal(snippet, '');

    snippet = markitup.parse('{IF myVarThatDoesntExist:}var exists{ELSE}var does not exist{:IF}');
    assert.equal(snippet, 'var does not exist');
});

QUnit.test("parse/multiline/line/#", function (assert) {
    var markitup, snippet;

    markitup = createNewMarkItUp();

    markitup.selectLine(1, 3);

    snippet = markitup.parse('{M:}test{:M}');
    assert.equal(snippet, 'test\ntest\ntest');

    snippet = markitup.parse('<ul>{M:}<li>{M}</li>{:M}</ul>');
    assert.equal(snippet, '<ul><li>line 1 content</li>\n<li>line 2 content</li>\n<li>line 3 content</li></ul>');

    snippet = markitup.parse('{M:}{#}{:M}');
    assert.equal(snippet, '1\n2\n3');
});

QUnit.test("parse/tab", function (assert) {
    var markitup, tab, snippet;

    markitup = createNewMarkItUp();
    tab = markitup.getOption('tab');

    snippet = markitup.parse('{T}');
    assert.equal(snippet, tab);

    snippet = markitup.parse('{T2}');
    assert.equal(snippet, tab + tab);

    snippet = markitup.parse('{T3}');
    assert.equal(snippet, tab + tab + tab);
});

QUnit.test("parse/alt", function (assert) {
    var markitup, container;

    markitup = createNewMarkItUp({
        toolbar: [{
            name: 'test',
            icon: 'markitup-mytest',
            content: '{A:}one{OR}two{:A}'
        }]
    });
    container = markitup.getContainer();

    markitup.setContent('');

    $(container).find('button').trigger('click');
    assert.equal(markitup.getContent(), 'one');

    markitup.setContent('');

    // TODO: try to test Alt+Click
    // $(container).find('button').trigger(evt);
    // assert.equal(markitup.getContent(), 'two');
});

QUnit.test("parse/caret", function (assert) {
    var markitup;

    markitup = createNewMarkItUp();

    markitup.insert('before{C}after');
    assert.equal(markitup.getPosition(), fixtures.join('\n').length + 6);

    markitup.insert('before{C:}test{:C}after');
    assert.equal(markitup.getSelection().text, 'test');
});

QUnit.test("parse/tags", function (assert) {
    var markitup, snippet;

    markitup = createNewMarkItUp({
        'vars': { 'myVar': 'test' }
    });

    markitup.setSelection(0, 0);

    snippet = markitup.parse('{VAR myVar}');
    assert.equal(snippet, 'test');

    snippet = markitup.parse('{ VAR myVar }');
    assert.equal(snippet, 'test');

    snippet = markitup.parse('{  VAR myVar  }');
    assert.equal(snippet, 'test');

    markitup = createNewMarkItUp({
        'parseSingle': '<%x/%>',
        'parseOpen':   '<%x%>',
        'parseClose':  '<%/x%>'
    });
    markitup.setOption('vars', { myVar: 'test' });

    snippet = markitup.parse('<% VAR myVar /%>');
    assert.equal(snippet, 'test');

    snippet = markitup.parse('<% S %>placeholder<%/ S %>');
    assert.equal(snippet, 'placeholder');
});

QUnit.test("indent/outdent", function (assert) {
    var markitup, selection;

    markitup = createNewMarkItUp();

    markitup.selectLine(1, 2);
    selection = markitup.getSelection().text;
    assert.equal(selection, 'line 1 content\nline 2 content\n');

    markitup.indent();
    markitup.selectLine(1, 2);
    selection = markitup.getSelection().text;

    assert.equal(selection, '    line 1 content\n    line 2 content\n');

    markitup.indent();
    markitup.selectLine(1, 2);
    selection = markitup.getSelection().text;

    assert.equal(selection, '        line 1 content\n        line 2 content\n');

    markitup.outdent();
    markitup.selectLine(1, 2);
    selection = markitup.getSelection().text;

    assert.equal(selection, '    line 1 content\n    line 2 content\n');

    markitup.outdent();
    markitup.selectLine(1, 2);
    selection = markitup.getSelection().text;

    assert.equal(selection, 'line 1 content\nline 2 content\n');
});

QUnit.test("preview/show/hide", function (assert) {
    var markitup, preview;

    markitup = createNewMarkItUp({
        preview: true,
        previewHidden: true
    });

    preview = markitup.getPreview();
    assert.equal(preview.style.display, 'none');

    markitup.showPreview();
    assert.equal(preview.style.display, 'block');

    markitup.hidePreview();
    assert.equal(preview.style.display, 'none');
});

QUnit.test("preview/before", function (assert) {
    var done;

    done = assert.async();
    assert.expect(2);

    createNewMarkItUp({
        preview: true,
        previewTemplatePath: false,
        beforePreviewRefresh: function (content, callback) {
            callback('<content>' + content + '</content>');
        },
        afterPreviewRefresh: function (previewcontent) {
            assert.contains(this.getContent(), previewcontent);
            assert.contains('<content>', previewcontent);
            done();
        }
    });
});

QUnit.test("preview/after", function (assert) {
    var done;

    done = assert.async();
    assert.expect(1);

    createNewMarkItUp({
        preview: true,
        previewTemplatePath: false,
        afterPreviewRefresh: function (previewContent) {
            assert.equal(this.getContent(), previewContent);
            done();
        }
    });
});

QUnit.test("preview/template", function (assert) {
    var done;

    done = assert.async();
    assert.expect(2);

    createNewMarkItUp({
        preview: true,
        previewTemplatePath: 'preview/preview.html',
        afterPreviewRefresh: function (previewcontent) {
            assert.contains(this.getContent(), previewcontent);
            assert.contains('<html>', previewcontent);
            done();
        }
    });
});

QUnit.test("preview/server", function (assert) {
    var done;

    done = assert.async();
    assert.expect(3);

    createNewMarkItUp({
        preview: true,
        previewTemplatePath: 'preview/preview.html',
        previewServerPath: 'server.php',
        afterPreviewRefresh: function (previewcontent) {
            assert.contains(this.getContent(), previewcontent);
            assert.contains('<html>', previewcontent);
            assert.contains('<server>', previewcontent);
            done();
        }
    });
});

QUnit.test("destroy", function (assert) {
    var markitup, container, textarea;

    markitup = createNewMarkItUp();

    container = document.querySelector('.markitup-container');
    textarea  = document.querySelector('.markitup-textarea' );

    assert.ok(container);
    assert.ok(textarea);

    markitup.destroy();

    container = document.querySelector('.markitup-container');
    textarea  = document.querySelector('.markitup-textarea' );

    assert.notOk(container);
    assert.notOk(textarea);
});

