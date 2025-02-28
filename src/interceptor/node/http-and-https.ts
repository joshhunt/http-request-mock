/* eslint-disable @typescript-eslint/ban-types */
import http from 'http';
import https from 'https';
import urlUtil from 'url';
import { isNodejs, isObject } from '../../common/utils';
import MockItem from '../../mocker/mock-item';
import Mocker from '../../mocker/mocker';
import { ClientRequestType } from '../../types';
import Base from '../base';
import ClientRequest from './client-request';

export default class NodeHttpAndHttpsRequestInterceptor extends Base{
  private static instance: NodeHttpAndHttpsRequestInterceptor;
  private httpRequest: Function;
  private httpsRequest: Function;
  private httpGet: Function;
  private httpsGet: Function;

  constructor(mocker: Mocker, proxyServer = '') {
    super(mocker, proxyServer);

    if (NodeHttpAndHttpsRequestInterceptor.instance) {
      return NodeHttpAndHttpsRequestInterceptor.instance;
    }

    NodeHttpAndHttpsRequestInterceptor.instance = this;

    this.httpRequest = http.request.bind(http);
    this.httpsRequest = https.request.bind(https);
    this.httpGet = http.get.bind(http);
    this.httpsGet = https.get.bind(https);
    this.intercept();

    return this;
  }

  /**
   * Setup request mocker for unit test.
   * @param {Mocker} mocker
   */
  static setupForUnitTest(mocker: Mocker) {
    if (!isNodejs()) {
      throw new Error('Not a nodejs envrioment.');
    }
    return new NodeHttpAndHttpsRequestInterceptor(mocker);
  }

  /**
   * https://nodejs.org/api/http.html#http_request_end_data_encoding_callback
   * https://nodejs.org/api/https.html#https_https_request_options_callback
   *
   * Intercept http.get, https.get, http.request, https.request.
   */
  private intercept() {
    this.inteceptRequestMethod();
    this.inteceptGetMethod();
  }

  /**
   * Logic of intercepting http.request and https.request method.
   */
  private inteceptRequestMethod() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const me = this;
    http.request = function(...args: unknown[]) {
      const clientRequest = me.getClientRequest(args);
      if (clientRequest) {
        clientRequest.setOriginalRequestInfo(me.httpRequest, args);
        return clientRequest;
      }
      return me.httpRequest(...args);
    };
    https.request = function(...args: unknown[]) {
      const clientRequest = me.getClientRequest(args);
      if (clientRequest) {
        clientRequest.setOriginalRequestInfo(me.httpsRequest, args);
        return clientRequest;
      }
      return me.httpsRequest(...args);
    };
  }

  /**
   * https://nodejs.org/api/http.html#http_http_get_url_options_callback
   * Logic of intercepting http.get and https.get method.
   *
   * Since most requests are GET requests without bodies, Node.js provides this convenience method.
   * The only difference between this method and http.request() is that it sets the method to GET
   * and calls req.end() automatically. The callback must take care to consume the response data
   * for reasons stated in http.ClientRequest section.
   */
  private inteceptGetMethod() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const me = this;
    http.get = function(...args: unknown[]) {
      const clientRequest = me.getClientRequest(args);
      if (clientRequest) {
        clientRequest.setOriginalRequestInfo(me.httpGet, args);
        clientRequest.end();
        return clientRequest;
      }
      return me.httpGet(...args);
    };

    https.get = function(...args: unknown[]) {
      const clientRequest = me.getClientRequest(args);
      if (clientRequest) {
        clientRequest.setOriginalRequestInfo(me.httpsGet, args);
        clientRequest.end();
        return clientRequest;
      }
      return me.httpsGet(...args);
    };
  }

  /**
   * Get instance of ClientRequest.
   * @param args Arguments of http.get, https.get, http.request or https.request
   */
  private getClientRequest(args: unknown[]) {
    const [url, options, callback] = this.getRequestArguments(args);
    if (options.useNativeModule) {
      delete options.useNativeModule; // not a standard option
      return false;
    }

    const method = options.method || 'GET';
    const requestUrl = this.checkProxyUrl(url, method);
    const mockItem:MockItem | null  = this.matchMockRequest(requestUrl, method);

    if (!mockItem) return false;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const clientRequest: ClientRequestType = new ClientRequest(url, options, callback);
    this.doMockRequest(clientRequest, mockItem);
    return clientRequest;
  }

  /**
   * Make mock request.
   * @param {ClientRequest} clientRequest
   * @param {MockItem} mockItem
   */
  private doMockRequest(clientRequest: ClientRequestType, mockItem: MockItem) {
    this.doMockResponse(clientRequest, mockItem);
  }

  /**
   * Make mock request.
   * @param {ClientRequest} clientRequest
   * @param {MockItem} mockItem
   */
  private doMockResponse(clientRequest: ClientRequestType, mockItem: MockItem) {
    const mockItemResolver = (resolve: Function) => {
      if (mockItem.delay && mockItem.delay > 0) {
        setTimeout(() => resolve(mockItem, this.mocker), +mockItem.delay);
      } else {
        resolve(mockItem, this.mocker);
      }
    };
    clientRequest.setMockItemResolver(mockItemResolver);
  }

  /**
   * Parse and get normalized arguments of http.get, https.get, http.request or https.request method.
   * http.request(options[, callback])#
   * http.request(url[, options][, callback])
   * @param {any[]} args arguments of http.get, https.get, http.request or https.request
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getRequestArguments(args: any[]) {
    let url, options, callback;

    if (typeof args[0] === 'string' || this.isUrlObject(args[0])) {
      url = typeof args[0] === 'string' ? args[0] : args[0].href;
    }
    if (url === undefined || (url && isObject(args[1]))) {
      options = url === undefined ? args[0] : args[1];
    }
    if (typeof args[1] === 'function' || typeof args[2] === 'function') {
      callback = typeof args[1] === 'function' ? args[1] : args[2];
    }

    if (!url) {
      const port = /^\d+$/.test(options.port) ? `:${options.port}` : '';
      const isHttps = (port === ':443') || options.cert || /^https:/i.test(options.path);
      const protocol = options.protocol ? options.protocol : (isHttps ? 'https:' : 'http:');

      const host = options.hostname || options.host || 'localhost';
      const path = options.path || '/';
      const auth = options.auth ? options.auth+'@' : '';

      const base = `${protocol}//${auth}${host}${port}`;

      // uri property will be populated by request library.
      url = options.uri ? options.uri.href : new URL(path, base).href;
    }

    return [url, options || {}, callback];
  }

  private isUrlObject(url: String | {[key: string]: string}) {
    return (Object.prototype.toString.call(url) === '[object URL]')
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore urlUtil.Url for a legacy compatibility
      || ((url instanceof URL) || (url instanceof urlUtil.Url))
      || (isObject(url) && ('href' in url) && ('hostname' in url) && !('method' in url));
  }
}

