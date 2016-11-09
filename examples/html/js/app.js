/* global MarkItUp:true */
/* jshint strict:false */

var markitup = new MarkItUp('#markitup', {
    preview: true,
    previewTemplatePath: 'markitup://../examples/html/preview/preview.html',
    tabs: '    ',
    shortcuts: {
        'Ctrl Shift R': function (e) {
            this.refreshPreview();
            e.preventDefault();
        },
        'Shift Enter': '<br />'
    },
    toolbar: [
        {   name: 'Link',
            icon: 'link',
            shortcut: 'Ctrl Shift L',
            content: '<a href="{VAR link}"{IF target:} target="{VAR target}"{:IF}>{S:}{VAR placeholder}{:S}</a>',
            dialog: {
                header: 'Links',
                url: 'dialogs/link.html'
            },
        },
        {   name: 'Picture',
            icon: 'picture',
            shortcut: 'Ctrl Shift P',
            content: '<img src="{VAR url}"{IF alt:} alt="{VAR alt}"{:IF} />',
            dialog: {
                header: 'Picture',
                url: 'dialogs/picture.html'
            }
        },
        {
            separator: true
        },
        {   name: 'Headings',
            icon: 'header',
            dropdown: [
                {   name: 'Heading level 1',
                    shortcut: 'Ctrl Shift 1',
                    before: '<h1>',
                    after: '</h1>'
                },
                {   name: 'Heading level 2',
                    shortcut: 'Ctrl Shift 2',
                    before: '<h2>',
                    after: '</h2>'
                },
                {   name: 'Heading level 3',
                    shortcut: 'Ctrl Shift 3',
                    before: '<h3>',
                    after: '</h3>'
                },
                {   name: 'Heading level 4',
                    shortcut: 'Ctrl Shift 4',
                    before: '<h4>',
                    after: '</h4>'
                },
                {   name: 'Paragraph',
                    shortcut: 'Ctrl Shift 1',
                    before: '<p>',
                    after: '</p>'
                }
            ]
        },
        {   name: 'Bold',
            icon: 'bold',
            shortcut: 'Ctrl Shift B',
            before: '<b>',
            after: '</b>'
        },
        {   name: 'Italic',
            icon: 'italic',
            shortcut: 'Ctrl Shift I',
            before: '<em>',
            after: '</em>'
        },
        {   name: 'Strike Through',
            icon: 'strikethrough',
            shortcut: 'Ctrl Shift D',
            before: '<del>',
            after: '</del>'
        },
        {
            separator: true
        },
        {   name: 'Unordered List',
            icon: 'list-ul',
            beforeBlock: '<ul>\n',
            before: '{T}<li>{#}. ',
            after: '</li>',
            afterBlock: '\n</ul>',
            multiline: true
        },
        {   name: 'Ordered List',
            icon: 'list-ol',
            content: '<ol>\n{M:}{T}<li>{#} - {M}</li>{:M}\n</ol>',
        }
    ]
});

document.getElementById('click').onclick = function (e) {
    e.preventDefault();

    markitup.insert('<b>{S:}New content{:S}</b>');
};
