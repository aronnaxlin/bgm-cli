# 手动获取 Bangumi Turnstile Token

本文记录当前在 `bgm-cli` 里给小组发帖 / 回帖时，手动获取 `turnstileToken` 的可用办法，以及为什么当前的 `localhost` helper 页并不能直接承担 Turnstile 运行上下文。

## 背景

Bangumi 的社区写操作（例如小组发帖、回帖、时间胶囊回复等）除了需要登录态 / `accessToken`，还额外要求请求体里带一个短时有效的 `turnstileToken`。

这个 token：

- 不是 OAuth `accessToken`
- 不能通过 `accessToken` 直接换取
- 由 Cloudflare Turnstile 在前端运行时生成
- 通常和运行上下文有关

## 当前结论

现阶段需要把下面两件事分开看：

1. `bgm-cli` 里的 `accessToken`
作用：证明“你是谁”

2. `turnstileToken`
作用：证明“这次写操作通过了人机验证”

`turnstileToken` 是短期的，一般应当现取现用。

## 为什么 `localhost` helper 页不能直接完成 Turnstile

当前仓库里已经实现了一版本地 helper 页：

```bash
bgm auth turnstile --manual --port 8765
```

它会起一个本地临时页面，帮助用户跳转到 `next.bgm.tv`、复制脚本，并把 token 回传给 CLI。

但在实际测试里，这个方案可能会卡在：

- 页面能打开
- Turnstile 不报明显错误
- 但一直停在 `Waiting for verification...`
- 没有回调 token

这大概率不是使用方式错误，而是因为 site key 的运行上下文和域名限制问题。

目前参考 `bangumi/Bangumi-iOS` 的实现可以确认：

- 它同样是自己渲染 Turnstile
- 但它不是在 `localhost` 上跑
- 它把 HTML 加载在 `https://next.bgm.tv/turnstile` 这个 base URL 上下文里

所以当前更稳妥的手动方式，应当优先在真实的 `next.bgm.tv` 上下文里完成验证。

## 推荐办法：在 `next.bgm.tv` 页面上下文里手动取 token

这是目前最值得优先尝试的办法。

### 步骤

1. 用浏览器打开：

```text
https://next.bgm.tv/
```

2. 打开开发者工具 Console

3. 粘贴下面这段脚本并回车：

```js
(async () => {
  const sitekey = '0x4AAAAAAABkMYinukE8nzYS'

  const old = document.getElementById('bgm-cli-turnstile-box')
  if (old) old.remove()

  let script = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')
  if (!script) {
    script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    document.head.appendChild(script)
    await new Promise((resolve, reject) => {
      script.addEventListener('load', resolve, { once: true })
      script.addEventListener('error', () => reject(new Error('failed to load turnstile script')), { once: true })
    })
  } else if (!window.turnstile) {
    await new Promise((resolve, reject) => {
      const startedAt = Date.now()
      const timer = setInterval(() => {
        if (window.turnstile) {
          clearInterval(timer)
          resolve()
          return
        }
        if (Date.now() - startedAt > 10000) {
          clearInterval(timer)
          reject(new Error('turnstile did not become available'))
        }
      }, 100)
    })
  }

  const box = document.createElement('div')
  box.id = 'bgm-cli-turnstile-box'
  box.style.cssText = [
    'position:fixed',
    'right:16px',
    'bottom:16px',
    'z-index:2147483647',
    'padding:16px',
    'background:#fff',
    'border:1px solid #ccc',
    'border-radius:12px',
    'box-shadow:0 8px 24px rgba(0,0,0,.2)'
  ].join(';')
  box.innerHTML = '<div style="margin-bottom:8px;font:14px sans-serif">Complete Turnstile for bgm-cli</div><div id="bgm-cli-turnstile-widget"></div>'
  document.body.appendChild(box)

  window.__bgmCliTurnstileToken = ''
  window.turnstile.render('#bgm-cli-turnstile-widget', {
    sitekey,
    theme: 'auto',
    callback(token) {
      window.__bgmCliTurnstileToken = token
      console.log('[bgm-cli] turnstile token:', token)
      console.log('[bgm-cli] copy with: copy(window.__bgmCliTurnstileToken)')
    },
    'error-callback'(code) {
      console.error('[bgm-cli] turnstile error:', code)
    },
    'expired-callback'() {
      console.warn('[bgm-cli] turnstile token expired')
    }
  })
})().catch((error) => console.error('[bgm-cli] failed:', error))
```

4. 页面右下角会出现一个小的 Turnstile 验证框

5. 完成验证后，Console 里会打印：

```text
[bgm-cli] turnstile token: <very-long-token>
```

6. 复制 token

如果浏览器支持 `copy()`，可以直接执行：

```js
copy(window.__bgmCliTurnstileToken)
```

7. 立刻把它用于 CLI 写操作：

```bash
bgm group create-topic boring "标题" "正文" --turnstile-token '<token>'

bgm group reply 498114 "回复内容" --turnstile-token '<token>'
```

## 适用建议

推荐顺序：

1. 优先在 `https://next.bgm.tv/` 页面里手动取 token
2. 现取现用，不要隔太久
3. 如果 token 过期或请求失败，就重新取一次

## 常见问题

### 1. 为什么不能直接从 `accessToken` 换一个 `turnstileToken`？

因为两者不是一类东西：

- `accessToken` 是身份认证
- `turnstileToken` 是人机验证

Bangumi 当前没有提供“用 OAuth token 换 Turnstile token”的接口。

### 2. 为什么在 `localhost` 页里总是拿不到 token？

大概率是运行域名不对。

当前已知的成熟参考实现 `Bangumi-iOS` 会把 Turnstile HTML 加载在：

```text
https://next.bgm.tv/turnstile
```

这个上下文里，而不是 `http://127.0.0.1:xxxx/`。

### 3. 这个 token 能保存到配置里长期复用吗？

不建议。

它是短时有效的，正确使用方式是：

- 发帖前取一次
- 立刻使用
- 失败就重取

## 当前状态

截至目前，`bgm-cli` 已经支持：

- `bgm auth turnstile`
- `bgm group create-topic ... --turnstile-token <token>`
- `bgm group reply ... --turnstile-token <token>`
- `bgm group create-topic ...` 在未传 token 时自动打开本地 helper 指导页
- `bgm group reply ...` 在未传 token 时自动打开本地 helper 指导页

但要注意：

- 未传 `--turnstile-token` 时，CLI 默认打开本地 helper 指导页
- 这条路径目前可能因为域名上下文问题而拿不到 token
- 因此在自动化方案修复前，手动方式更可靠

## 后续方向

后续更可能成功的自动化方向，不是继续强化 `localhost` 验证页，而是：

1. 在 `next.bgm.tv` 上下文里渲染 Turnstile
2. 或者用 Playwright / 嵌入式浏览器模拟 `Bangumi-iOS` 的实现方式

在这条自动化路径完成前，这份手动流程可以作为临时可用方案。
