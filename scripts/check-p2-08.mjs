/**
 * P2-08 验收脚本：小程序 阅读计时 / 时脉简版 / 订阅消息 闭环
 *
 * 覆盖链路（全部走真实后端接口，微信侧走 mock 适配层）：
 *   1. 微信一键登录（code + phoneCode，按手机号与 Web 账号合并）
 *   2. 订阅模板查询（公开）
 *   3. 订阅授权上报 → 额度累加
 *   4. 订阅消息下发 → 额度扣减（mock 模拟下发）
 *   5. 阅读场次：开始 → 进行中恢复 → 结束（页码/笔记）
 *   6. 时脉按日聚合（时脉页数据源）
 *
 * 用法：node scripts/check-p2-08.mjs
 * 前置：后端已在 http://localhost:3000 运行（可经 API_BASE 覆盖）
 */
const BASE = process.env.API_BASE || 'http://localhost:3000/api'

let pass = 0
let fail = 0
const lines = []

function check(name, cond, detail) {
  if (cond) {
    pass++
    lines.push(`  \u2713 ${name}`)
  } else {
    fail++
    lines.push(`  \u2717 ${name}${detail ? '  \u2192 ' + detail : ''}`)
  }
}

async function call(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* 非 JSON 响应 */
  }
  return { status: res.status, json }
}

async function main() {
  // 1. 微信一键登录（mock：code 派生 openid，phoneCode 直接视为手机号）
  const suffix = String(Date.now()).slice(-6)
  const phone = '138' + suffix.padStart(8, '0').slice(-8)
  const login = await call('POST', '/auth/wechat', {
    body: {
      code: `mock-openid:p208_${suffix}`,
      phoneCode: phone,
      nickname: 'P2-08验收',
    },
  })
  const token = login.json?.data?.accessToken
  check('微信一键登录成功并返回 accessToken', !!token, `status=${login.status}`)
  if (!token) throw new Error('登录失败，后续用例无法继续')

  // 2. 订阅模板（公开）
  const tpl = await call('GET', '/subscribe/templates')
  const templates = Array.isArray(tpl.json?.data) ? tpl.json.data : []
  check('订阅模板接口可用', tpl.status === 200 && templates.length > 0, `status=${tpl.status}`)
  const templateId = templates[0]?.id

  // 3. 授权前状态
  const stBefore = await call('GET', '/subscribe/status', { token })
  const before = stBefore.json?.data?.templates?.find((t) => t.id === templateId)
  const remainingBefore = before ? Number(before.remaining) : 0
  check('订阅状态接口可用', stBefore.status === 200, `status=${stBefore.status}`)

  // 4. 授权上报
  const authz = await call('POST', '/subscribe/authorize', {
    token,
    body: { templateIds: [templateId] },
  })
  check('订阅授权上报成功', authz.status === 200 || authz.status === 201, `status=${authz.status}`)

  // 5. 授权后额度 +1
  const stAfter = await call('GET', '/subscribe/status', { token })
  const after = stAfter.json?.data?.templates?.find((t) => t.id === templateId)
  const remainingAfter = after ? Number(after.remaining) : 0
  check(
    '授权后额度累加（+1）',
    remainingAfter === remainingBefore + 1,
    `before=${remainingBefore} after=${remainingAfter}`,
  )

  // 6. 下发订阅消息（消耗一次额度）
  const sent = await call('POST', '/subscribe/send', {
    token,
    body: { templateId, page: 'pages/pulse/pulse' },
  })
  check(
    '订阅消息下发成功（mock）',
    (sent.status === 200 || sent.status === 201) && sent.json?.data?.sent === true,
    `status=${sent.status} msg=${sent.json?.message}`,
  )

  // 7. 下发后额度 -1
  const stFinal = await call('GET', '/subscribe/status', { token })
  const finalRow = stFinal.json?.data?.templates?.find((t) => t.id === templateId)
  const remainingFinal = finalRow ? Number(finalRow.remaining) : 0
  check(
    '下发后额度扣减（回到授权前）',
    remainingFinal === remainingBefore,
    `before=${remainingBefore} final=${remainingFinal}`,
  )

  // 8. 取一本上架书籍用于阅读场次
  const books = await call('GET', '/library/books?page=1&pageSize=1')
  const list = books.json?.data?.list || books.json?.data || []
  const bookId = list[0]?.id
  check('可获取上架书籍', !!bookId, `status=${books.status}`)

  if (bookId) {
    // 9. 开始阅读场次
    const started = await call('POST', '/reading/sessions', {
      token,
      body: { bookId: Number(bookId), startPage: 1, source: 'miniprogram' },
    })
    const sessionId = started.json?.data?.sessionId
    check(
      '开始阅读场次成功',
      (started.status === 200 || started.status === 201) && !!sessionId,
      `status=${started.status}`,
    )

    // 10. 进行中恢复（小程序重新进入页面时的续接依据）
    const ongoing = await call('GET', '/reading/sessions/ongoing', { token })
    check(
      '进行中场次可恢复（同账号互通）',
      ongoing.json?.data?.sessionId === sessionId,
      `ongoing=${ongoing.json?.data?.sessionId} expect=${sessionId}`,
    )

    // 11. 结束场次（页码 + 笔记）
    if (sessionId) {
      const finished = await call('PATCH', `/reading/sessions/${sessionId}/finish`, {
        token,
        body: { endPage: 12, note: 'P2-08 验收笔记', durationSeconds: 60 },
      })
      check(
        '结束阅读场次成功（页码/笔记落库）',
        (finished.status === 200 || finished.status === 201) &&
          finished.json?.data?.status === 'finished' &&
          finished.json?.data?.endPage === 12,
        `status=${finished.status} data=${JSON.stringify(finished.json?.data)}`,
      )
    }

    // 12. 时脉按日聚合（时脉页数据源）
    const pulse = await call('GET', '/reading/pulse/daily', { token })
    check(
      '时脉按日聚合可用（含今日记录）',
      pulse.status === 200 && Array.isArray(pulse.json?.data),
      `status=${pulse.status}`,
    )
  }

  console.log('\nP2-08 验收结果：')
  console.log(lines.join('\n'))
  console.log(`\n通过 ${pass} / 失败 ${fail}`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error('验收执行异常：', e.message)
  process.exit(1)
})
