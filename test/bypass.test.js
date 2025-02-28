import { expect, jest } from '@jest/globals';
import axios from 'axios';
import xhrAdapter from 'axios/lib/adapters/xhr';
import http from 'http';
import https from 'https';
import Bypass from '../src/common/bypass';
import * as fallback from '../src/fallback/fallback';
import HttpRequestMock from '../src/index';
import XMLHttpRequestInterceptor from '../src/interceptor/xml-http-request';

axios.defaults.adapter = xhrAdapter;

// axios.defaults.adapter = httpAdapter; //
describe('test bypassing', () => {
  beforeEach(() => {
    console.error = jest.fn();
    // eslint-disable-next-line no-import-assign
    fallback.default = jest.fn().mockResolvedValue({
      body: 'fake-body',
      response: {
        statusCode: 200,
        statusMessage: 'OK',
        headers: {}
      }
    });
  });
  afterEach(() => {
    console.error.mockRestore();
    fallback.default.mockRestore();
  });

  it('xhr(shipped with jsdom) should support to bypass a mock request', async () => {
    XMLHttpRequestInterceptor.instance = null;
    const mocker = HttpRequestMock.setupForUnitTest('xhr');

    mocker.mock({
      url: 'https://www.a-nonexist-api.com/xhr1-bypass',
      body: function(req) {
        if (req.query.pass === '1') {
          return this.bypass();
        }
        return 'mock-data';
      }
    });

    try {
      await axios.get('https://www.a-nonexist-api.com/xhr1-bypass?pass=1');
    } catch(e) {
      expect(e.message).toMatch('Network Error');
    }

    const res = await axios.get('https://www.a-nonexist-api.com/xhr1-bypass?pass=0');
    expect(res.data).toBe('mock-data');
  });

  it('xhr(shipped with http-request-mock) should support to bypass a mock request', async () => {
    global.XMLHttpRequest = undefined; // do not use xhr in jsdom
    XMLHttpRequestInterceptor.instance = null;
    const mocker = HttpRequestMock.setupForUnitTest('xhr');

    let bypass = null;
    mocker.mock({
      url: 'https://www.api.com/xhr2-bypass',
      body: function() {
        bypass = this.bypass();
        return bypass;
      }
    });
    const res = await axios.get('https://www.api.com/xhr2-bypass');
    expect(fallback.default).toBeCalled();
    expect(bypass).toBeInstanceOf(Bypass);
    expect(res.data).toBe('fake-body');
  });

  it('fetch should support to bypass a mock request', async () => {
    global.fetch = undefined; // do not use xhr in jsdom
    XMLHttpRequestInterceptor.instance = null;
    const mocker = HttpRequestMock.setupForUnitTest('fetch');

    let bypass = null;
    mocker.mock({
      url: 'https://www.api.com/fetch-bypass',
      body: function() {
        bypass = this.bypass();
        return bypass;
      }
    });
    const res = await fetch('https://www.api.com/fetch-bypass').then(res => res.text());
    expect(fallback.default).toBeCalled();
    expect(bypass).toBeInstanceOf(Bypass);
    expect(res).toBe('fake-body');
  });

  it('wx.request should support to bypass a mock request', (done) => {
    global.wx = undefined; // do not use xhr in jsdom
    XMLHttpRequestInterceptor.instance = null;
    const mocker = HttpRequestMock.setupForUnitTest('wx');

    let bypass = null;
    mocker.mock({
      url: 'https://www.api.com/wxrequest-bypass',
      body: function() {
        bypass = this.bypass();
        return bypass;
      }
    });
    /* global wx: true */
    wx.request({
      url: 'https://www.api.com/wxrequest-bypass',
      success() {
        expect(fallback.default).toBeCalled();
        expect(bypass).toBeInstanceOf(Bypass);
        done();
      }
    });
  });

  it('https.request should support to bypass a mock request', (done) => {
    XMLHttpRequestInterceptor.instance = null;
    const mocker = HttpRequestMock.setupForUnitTest('node');

    let bypass = null;
    mocker.mock({
      url: 'https://www.a-nonexist-api.com/https-request-bypass',
      body: function() {
        bypass = this.bypass();
        return bypass;
      }
    });
    const req = https.request('https://www.a-nonexist-api.com/https-request-bypass');
    req.on('error', (err) => {
      expect(err.message).toContain('www.a-nonexist-api.com');
      done();
    });
    expect(req.end()).toBeInstanceOf(http.ClientRequest);
  });
});
