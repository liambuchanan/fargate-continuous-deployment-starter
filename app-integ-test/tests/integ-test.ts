import axios from 'axios';

describe('App', function () {
  it('says hello, world.', async function () {
    const host = process.env.HOST;
    const resp = await axios.get(host);
    expect(resp.status).toEqual(200);
    expect(resp.data).toContain('Hello, world.');
  });
});
