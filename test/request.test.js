// Note: 'request' has been deprecated.
import requestLib from 'request';
import HttpRequestMock from '../src/index';

const mocker = HttpRequestMock.setupForNode();

const request = (url, method = 'get') => {

  return new Promise((resolve, reject) => {
    requestLib(url, { method }, function (error, response, body) {
      if (error) {
        return reject(error);
      }
      let data;
      try {
        data = JSON.parse(body);
      } catch(e) {
        data = body;
      }
      resolve({
        data,
        status: response.statusCode,
        headers: response.headers
      });
    });
  });
};

describe('mock requests which are triggered by request library', () => {
  it('url config item should support partial matching', async () => {
    mocker.get('www.api.com/partial', 'get content');
    mocker.post('www.api.com/partial', 'post content');

    const res = await Promise.all([
      request('http://www.api.com/partial', 'get').then(res => res.data),
      request('https://www.api.com/partial', 'post').then(res => res.data),
      request('https://www.api.com/partial?abc=xyz', 'get').then(res => res.data),
      request('https://www.api.com/partial-other', 'post').then(res => res.data),
    ]);
    expect(res).toMatchObject([
      'get content', 'post content', 'get content', 'post content'
    ]);
  });

  it('url config item should support RegExp matching', async () => {
    mocker.any(/^.*\/regexp$/, { ret: 0, msg: 'regexp'}, {
      header: {
        'content-type': 'application/json' // response to json
      }
    });

    const res = await request('http://www.api.com/regexp', 'get',);
    expect(res.data).toMatchObject({ ret: 0, msg: 'regexp'});
  });

  it('delay config item should support a delayed response', (done) => {
    mocker.mock({
      url: 'http://www.api.com/delay',
      delay: 101,
      body: { ret: 0, msg: 'delay'},
      header: {
        'content-type': 'application/json' // response to json
      }
    });

    const time = Date.now();
    request('http://www.api.com/delay').then(() => {
      expect(Date.now() - time).toBeGreaterThanOrEqual(100);
      done();
    });
  });

  it('status config itme should support to customize http status code response', (done) => {
    mocker.mock({
      url: 'http://www.api.com/status404',
      status: 404,
      body: 'not found'
    });

    request('http://www.api.com/status404').then(res => {
      expect(res.status).toBe(404);
      expect(res.data).toMatch('not found');
      done();
    });
  });

  it('method config itme should support to mock a GET|POST|PUT|PATCH|DELETE http request', async () => {
    mocker.get('http://www.api.com/get', 'get');
    mocker.post('http://www.api.com/post', 'post');
    mocker.put('http://www.api.com/put', 'put');
    mocker.patch('http://www.api.com/patch', 'patch');
    mocker.delete('http://www.api.com/delete', 'delete');

    mocker.mock({method: 'get', url: 'http://www.api.com/method-get', body: 'method-get'});
    mocker.mock({method: 'post', url: 'http://www.api.com/method-post', body: 'method-post'});
    mocker.mock({method: 'put', url: 'http://www.api.com/method-put', body: 'method-put'});
    mocker.mock({method: 'patch', url: 'http://www.api.com/method-patch', body: 'method-patch'});
    mocker.mock({method: 'delete', url: 'http://www.api.com/method-delete', body: 'method-delete'});

    const res = await Promise.all([
      request('http://www.api.com/get', 'get').then(res => res.data),
      request('http://www.api.com/post', 'post').then(res => res.data),
      request('http://www.api.com/put', 'put').then(res => res.data),
      request('http://www.api.com/patch', 'patch').then(res => res.data),
      request('http://www.api.com/delete', 'delete').then(res => res.data),

      request('http://www.api.com/method-get', 'get').then(res => res.data),
      request('http://www.api.com/method-post', 'post').then(res => res.data),
      request('http://www.api.com/method-put', 'put').then(res => res.data),
      request('http://www.api.com/method-patch', 'patch').then(res => res.data),
      request('http://www.api.com/method-delete', 'delete').then(res => res.data),
    ]);

    expect(res).toMatchObject([
      'get', 'post', 'put', 'patch', 'delete',
      'method-get', 'method-post', 'method-put', 'method-patch', 'method-delete',
    ]);
  });

  it('header config itme should support to customize response headers', async () => {
    mocker.mock({
      url: 'http://www.api.com/headers',
      method: 'any',
      body: 'headers',
      header: {
        custom: 'a-customized-header',
        another: 'another-header'
      }
    });

    const res = await request('http://www.api.com/headers');
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({
      custom: 'a-customized-header',
      another: 'another-header',
      'x-powered-by': 'http-request-mock',
    });
  });

  it('mock response should support to customize data types', async () => {
    mocker.any('http://www.api.com/string', 'string', {
      header: {
        'content-type': 'application/text' // response to text
      }
    });
    mocker.any('http://www.api.com/object', {obj: 'yes'}, {
      header: {
        'content-type': 'application/json' // response to json
      }
    });


    const res = await Promise.all([
      request('http://www.api.com/string', 'get').then(res => res.data),
      request('http://www.api.com/object', 'get').then(res => res.data),
    ]);
    expect(res[0]).toBe('string');
    expect(res[1]).toMatchObject({obj: 'yes'});
  });

  it('mock response function should support to get request info', async () => {
    let requestInfo = {};
    mocker.mock({
      url: 'http://www.api.com/request-info',
      method: 'get',
      body: (reqInfo) => {
        requestInfo = reqInfo;
        return requestInfo;
      }
    });

    await request('http://www.api.com/request-info?arg1=111&arg2=222');
    expect(requestInfo.url).toBe('http://www.api.com/request-info?arg1=111&arg2=222');
    expect(/^get$/i.test(requestInfo.method)).toBe(true);
  });

  it('mock response should support synchronized function', async () => {
    let index = 0;
    mocker.mock({
      url: 'http://www.api.com/function',
      method: 'any',
      body: () => {
        index = index + 1;
        return 'data'+index;
      }
    });

    const res1 = await request('http://www.api.com/function');
    const res2 = await request('http://www.api.com/function');
    expect(res1.data).toBe('data1');
    expect(res2.data).toBe('data2');
  });

  it('mock response should support asynchronous function', async () => {
    let index = 0;
    mocker.mock({
      url: 'http://www.api.com/async-function',
      body: async () => {
        await new Promise(resolve => setTimeout(resolve, 101));
        index = index + 1;
        return 'data'+index;
      }
    });

    const now = Date.now();
    const res1 = await request('http://www.api.com/async-function');
    expect(Date.now() - now).toBeGreaterThanOrEqual(100);

    const res2 = await request('http://www.api.com/async-function');
    expect(Date.now() - now).toBeGreaterThanOrEqual(200);

    expect(res1.data).toBe('data1');
    expect(res2.data).toBe('data2');
  });
});

