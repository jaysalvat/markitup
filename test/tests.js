/* global describe, it */

'use strict';

if (typeof window === 'undefined') {
    var markitup = require('../dist/markitup.js');
    var chai = require('chai');
}
var expect = chai.expect;

describe("Some tests", function () {
    it("should work", function () {
        expect(markitup).to.be.a('function');
        expect(markitup).to.not.throw(Error);
    });
});
