/**
 * 响应包装解包专项测试
 *
 * 复现线上实际遇到的三层结构：
 *   { data: { code:200, message:'登录成功', data:{ token, userInfo } } }
 */
import { login, getInstanceList, ping } from '../src/api/mslx.js';

let pass = 0;
let fail = 0;
function check(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}${detail ? '  → ' + detail : ''}`);
  }
}

/** 造一个请求函数，固定返回给定的 payload */
function mkApi(payload) {
  return {
    network: {
      async request() {
        return payload;
      },
    },
  };
}

console.log('=== A. 三层包装（线上实际形态）===');
{
  const api = mkApi({
    data: {
      code: 200,
      message: '登录成功',
      data: { token: 'eyJ.fake.token', userInfo: { username: 'Cheering', role: 'admin' } },
    },
  });
  const d = await login(api, 'http://1.2.3.4:1027', 'u', 'p');
  check('拿到 token', d?.token === 'eyJ.fake.token', JSON.stringify(d));
  check('拿到 userInfo', d?.userInfo?.username === 'Cheering');
}

console.log('\n=== B. 两层包装（平台 {code,data} + MSLX）===');
{
  const api = mkApi({
    code: 200,
    data: { code: 200, message: 'ok', data: { token: 't2', userInfo: {} } },
  });
  const d = await login(api, 'http://1.2.3.4:1027', 'u', 'p');
  check('拿到 token', d?.token === 't2', JSON.stringify(d));
}

console.log('\n=== C. 裸 MSLX 响应（无平台包装）===');
{
  const api = mkApi({ code: 200, message: 'ok', data: { token: 't3', userInfo: {} } });
  const d = await login(api, 'http://1.2.3.4:1027', 'u', 'p');
  check('拿到 token', d?.token === 't3', JSON.stringify(d));
}

console.log('\n=== D. 数组数据（实例列表）===');
{
  const api = mkApi({
    data: { code: 200, message: '获取成功', data: [{ id: 9, name: '无限', status: 2 }] },
  });
  const list = await getInstanceList(api);
  check('返回数组', Array.isArray(list), JSON.stringify(list));
  check('长度正确', list?.length === 1);
  check('字段完整', list?.[0]?.name === '无限' && list?.[0]?.status === 2);
}

console.log('\n=== E. null 数据（ping）===');
{
  const api = mkApi({ data: { code: 200, message: 'pong', data: null } });
  const r = await ping(api, 'http://1.2.3.4:1027');
  check('ping 返回 null', r === null, String(r));
}

console.log('\n=== F. 业务错误码透传 ===');
{
  const api = mkApi({ data: { code: 401, message: '用户名或密码错误', data: null } });
  try {
    await login(api, 'http://1.2.3.4:1027', 'u', 'bad');
    check('应抛错', false);
  } catch (e) {
    check('抛出业务错误', e.code === 401, String(e.code));
    check('错误文案正确', e.message === '用户名或密码错误', e.message);
  }
}

console.log('\n=== G. JSON 字符串响应 ===');
{
  const api = mkApi(
    JSON.stringify({ data: { code: 200, message: 'ok', data: { token: 't7', userInfo: {} } } })
  );
  const d = await login(api, 'http://1.2.3.4:1027', 'u', 'p');
  check('字符串也能解析', d?.token === 't7', JSON.stringify(d));
}

console.log(`\n${'='.repeat(50)}`);
console.log(`结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
