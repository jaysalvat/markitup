/*!-----------------------------------------------------------------------------
 * markitup — A framework agnostic Javascript library that add powerful new features to standard textareas
 * v3.0.0-0 - built 2016-11-08
 * Licensed under the MIT License.
 * http://markitup.jaysalvat.com/
 * ----------------------------------------------------------------------------
 * Copyright (C) 2016 Jay Salvat
 * http://jaysalvat.com/
 * --------------------------------------------------------------------------*/
/* global define */

(function (context, factory) {
    'use strict';

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else {
        context.markitup = factory();
    }
})(this, function () {
    'use strict';

    var markitup = function markitup() {
        console.log('It works');
    };

    return markitup;
});
//# sourceMappingURL=maps/markitup.js.map
