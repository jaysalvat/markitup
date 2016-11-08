/* global MarkItUp:true */

(function ($) {
    'use strict';

    $.fn.markitup = function(options) {
        var args = arguments,
            error = false,
            returns;

        if (options === undefined || typeof options === 'object') {
            return this.each(function () {
                if (!this._markItUp) {
                    this._markItUp = new MarkItUp(this, options);
                }
            });
        } else if (typeof options === 'string') {
            this.each(function () {
                var instance = this._markItUp;

                if (!instance) {
                    throw new Error('No MarkItUp! applied to this element.');
                }

                if (typeof instance[options] === 'function' && options[0] !== '_') {
                    returns = instance[options].apply(instance, [].slice.call(args, 1));
                } else {
                    error = true;
                }
            });

            if (error) {
                throw new Error('No method "' + options + '" in Vegas.');
            }

            return returns !== undefined ? returns : this;
        }
    };
})(window.jQuery || window.Zepto);
