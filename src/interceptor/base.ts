import { getQuery, tryToParseObject } from '../common/utils';
import MockItem from '../mocker/mock-item';
import Mocker from '../mocker/mocker';
import { Method, MixedRequestInfo, RequestInfo } from '../types';
import InterceptorFetch from './fetch';
import InterceptorNode from './node/http-and-https';
import InterceptorWxRequest from './wx-request';
import InterceptorXhr from './xml-http-request';
export default class BaseInterceptor {
  protected mocker: Mocker;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected global: Record<string, any>;

  constructor(mocker: Mocker) {
    this.mocker = mocker;
    this.global = BaseInterceptor.getGlobal();
  }

  /**
   * Setup request mocker.
   * @param {Mocker} mocker
   */
  public static setup(mocker: Mocker) {
    return <InterceptorFetch | InterceptorWxRequest | InterceptorXhr | InterceptorNode> new this(mocker);
  }

  /**
   * return global variable
   */
  public static getGlobal() {
    if (typeof window !== 'undefined') {
      return window;
    } else if (typeof global !== 'undefined')  {
      return global;
    }
    throw new Error('Detect global variable error');
  }

  /**
   * Check whether the specified request url matchs a defined mock item.
   * If a match is found, return mock meta information, otherwise a null is returned.
   * @param {string} reqUrl
   * @param {string} reqMethod
   */
  protected matchMockRequest(reqUrl: string, reqMethod: Method | undefined): MockItem | null {
    const mockItem: MockItem | null =  this.mocker.matchMockItem(reqUrl, reqMethod);
    if (mockItem && mockItem.times !== undefined) {
      mockItem.times -= 1;
    }
    return mockItem;
  }

  public getRequestInfo(mixedRequestInfo: MixedRequestInfo) : RequestInfo {
    const info: RequestInfo = {
      url: mixedRequestInfo.url,
      method: mixedRequestInfo.method || 'GET',
      query: getQuery(mixedRequestInfo.url),
    };
    if (mixedRequestInfo.headers || mixedRequestInfo.header) {
      info.headers = mixedRequestInfo.headers || mixedRequestInfo.header;
    }
    if (mixedRequestInfo.body !== undefined) {
      info.body = tryToParseObject(mixedRequestInfo.body);
    }
    return info;
  }
}

