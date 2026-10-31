# P0-05 Web 账号体系（登录/注册页）

- **编号**：P0-05
- **任务名称**：Web 账号体系（登录/注册页）
- **阶段**：P0 地基与数据
- **状态**：已完成

## 前置要求
- 材料：《功能需求.md》① 用户体系
- 依赖子任务：P0-02（设计系统/基础组件）、P0-04（后端认证接口）

## 任务内容
搭建用户端 Web 账号体系：
- **登录页**：手机号 + 验证码登录
- **注册页**：手机号 + 验证码 + 可选昵称注册
- **auth 接口对接**：register / login / refresh / getProfile
- **Pinia 用户 store**：登录态管理、令牌持久化、用户信息缓存
- **路由守卫**：requiresAuth 受保护路由、guestOnly 已登录重定向

## 产物
- `src/api/auth.ts` — 认证 API 模块（register/login/refresh/getProfile）
- `src/api/index.ts` — HTTP 客户端（请求拦截器注入 Bearer + 响应拦截器提取 data + 401 自动刷新）
- `src/stores/user.ts` — Pinia 用户 store（login/register/logout/fetchProfile/restore）
- `src/views/auth/LoginView.vue` — 登录页（手机号校验 + 验证码倒计时 + redirect 回跳）
- `src/views/auth/RegisterView.vue` — 注册页（手机号 + 验证码 + 可选昵称）
- `src/views/ProfileView.vue` — 个人中心页（用户信息展示 + 退出登录）
- `src/views/HomeView.vue` — 首页更新（登录态切换按钮）
- `src/router/index.ts` — 路由守卫（requiresAuth / guestOnly + restore 恢复）

## 验收点
- [x] 登录页支持手机号 + 验证码登录，校验手机号格式
- [x] 注册页支持手机号 + 验证码 + 可选昵称
- [x] 登录/注册成功后令牌写入 localStorage，页面刷新后保持登录态
- [x] 未登录访问受保护路由自动跳转登录页（带 redirect 参数）
- [x] 已登录访问登录/注册页自动跳转首页
- [x] 请求自动携带 Bearer Token
- [x] 401 响应自动尝试 refreshToken 刷新，失败则跳转登录页
- [x] 退出登录清除令牌和用户信息
- [x] UI 遵循设计系统（松绿/纸面/墨色 + 衬线标题 + 基础组件）

## API 对接说明
| 前端函数 | 后端端点 | 说明 |
| --- | --- | --- |
| `register()` | POST /api/auth/register | 手机号 + 验证码注册，返回双令牌 + 用户信息 |
| `login()` | POST /api/auth/login | 手机号 + 验证码登录，返回双令牌 + 用户信息 |
| `refresh()` | POST /api/auth/refresh | refreshToken 换新双令牌（拦截器自动调用） |
| `getProfile()` | GET /api/user/profile | 获取当前登录用户信息（需 Bearer Token） |

## 待用户执行（沙箱限制）
1. `cd backend && npm install --legacy-peer-deps` — 安装后端依赖
2. `cd web-user && npm run dev` — 启动前端开发服务
3. 启动后端后，访问 `http://localhost:5173` 验证登录/注册流程
4. dev 环境验证码固定为 `123456`
