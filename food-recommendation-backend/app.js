const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { pool } = require('./config/database');
const session = require('express-session');
// AdminJS v7 是 ESM 包，使用动态 import 以兼容 CommonJS 项目
let buildAuthenticatedRouter;
let buildRouter;
let AdminJS;
let AdminJSSQLAdapter;

// 导入路由
const authRoutes = require('./routes/auth');
const restaurantRoutes = require('./routes/restaurants');
const dishRoutes = require('./routes/dishes');
const uploadRoutes = require('./routes/upload');
const recommendationRoutes = require('./routes/recommendation');
const userRoutes = require('./routes/user');
// 已替换为 AdminJS

// 导入中间件
const errorHandler = require('./middleware/errorHandler');

// 加载环境变量
dotenv.config();

const app = express();

// 中间件（为开发中的 AdminJS 放宽 CSP/EPP 限制，避免前端被拦）
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors());
app.use(morgan('combined'));
// 全局启用 session，供 AdminJS 认证使用
app.use(session({
  secret: process.env.ADMIN_COOKIE_PASS || 'admin-cookie-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false },
}));

// 静态文件服务
app.use('/data', express.static('data'));
app.use('/uploads', express.static('uploads'));
// 由 AdminJS 接管 /admin
// 开发环境下为 /admin 明确放宽 CSP，避免前端资源被阻止
if (process.env.NODE_ENV === 'development') {
  app.use('/admin', (req, res, next) => {
    res.setHeader('Content-Security-Policy', [
      "default-src 'self' data: blob:",
      "base-uri 'self'",
      "form-action 'self'",
      "img-src 'self' data: blob:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
      "style-src 'self' 'unsafe-inline' https:",
      "font-src 'self' data: https:",
      "connect-src 'self' http: https: ws:",
      "frame-ancestors 'self'"
    ].join('; '));
    next();
  });
}

// 仅对 /api 路径启用 body parser，避免影响 AdminJS 登录
app.use('/api', express.json({ limit: '10mb' }));
app.use('/api', express.urlencoded({ extended: true }));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/dishes', dishRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/user', userRoutes);
// 简易探针，验证 /admin 路由栈是否可达
app.get('/admin/ping', (req, res) => res.send('admin ok'));
// AdminJS 挂载在 /admin（带简单账号认证）
const ADMIN_CREDENTIALS = {
  email: process.env.ADMIN_EMAIL || 'admin@example.com',
  password: process.env.ADMIN_PASSWORD || 'admin',
  cookiePass: process.env.ADMIN_COOKIE_PASS || 'admin-cookie-secret'
};

async function setupAdmin() {
  try {
    const AdminJSImport = await import('adminjs');
    const AdminJSExpressImport = await import('@adminjs/express');
    const SQLImport = await import('@adminjs/sql');

    AdminJS = AdminJSImport.default;
    const AdminJSExpressResolved = AdminJSExpressImport.default || AdminJSExpressImport;
    buildAuthenticatedRouter = AdminJSExpressResolved.buildAuthenticatedRouter;
    buildRouter = AdminJSExpressResolved.buildRouter;
    // 从 @adminjs/sql 获取命名导出 Database/Resource，以及默认导出的 Adapter
    const { Database, Resource } = SQLImport;
    const Adapter = SQLImport.default;
    AdminJSSQLAdapter = Adapter;
    // 注册 SQL 适配器（必须提供 Database 和 Resource）
    AdminJS.registerAdapter({ Database, Resource });

    // 初始化 SQL 适配器并自动加载所有表
    const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
    const db = await new AdminJSSQLAdapter('postgresql', {
      connectionString,
      database: process.env.DB_NAME,
    }).init();

    const admin = new AdminJS({
      rootPath: '/admin',
      branding: { companyName: 'Octoday Menu Admin' },
      // 注册全部表作为资源
      databases: [db],
    });

    // 开发环境启动前端打包监听，以生成 Admin 前端资源
    if (process.env.NODE_ENV === 'development' && typeof admin.watch === 'function') {
      admin.watch();
      console.log('AdminJS watch started (development mode)');
    }

    // 启用 AdminJS 登录认证（凭据来源于环境变量）
    const adminRouter = buildAuthenticatedRouter(admin, {
      authenticate: async (email, password) => {
        if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
          return { email };
        }
        return null;
      },
      cookiePassword: ADMIN_CREDENTIALS.cookiePass,
    });

    app.use(admin.options.rootPath, adminRouter);
    // 兼容部分环境对无尾斜杠的处理，显式重定向到登录页
    app.get('/admin', (req, res) => {
      res.redirect('/admin/login');
    });
    // 也挂载带尾斜杠的路径，避免代理/浏览器差异
    app.use('/admin/', adminRouter);
    console.log(`AdminJS mounted at ${admin.options.rootPath}`);

    // 将 404 处理置于所有路由之后，避免覆盖 /admin
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: 'API endpoint not found'
      });
    });

    // 错误处理中间件应在 404 之后
    app.use(errorHandler);
  } catch (e) {
    console.error('Failed to initialize AdminJS:', e);
  }
}

// 健康检查端点
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

const PORT = process.env.PORT || 3000;

// 先初始化 AdminJS，再启动服务器
let server;
setupAdmin().finally(() => {
  server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
});

// 处理未捕获的异常
// 优雅关闭函数：关闭 HTTP 服务与数据库连接后退出
let shuttingDown = false;
async function gracefulShutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    if (server && typeof server.close === 'function') {
      await new Promise((resolve) => server.close(resolve));
      console.log('HTTP server closed');
    }
  } catch (e) {
    console.error('Error while closing server:', e);
  }
  try {
    if (pool && typeof pool.end === 'function') {
      await pool.end();
      console.log('PostgreSQL pool closed');
    }
  } catch (e) {
    console.error('Error while closing DB pool:', e);
  }
  process.exit(code);
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown(1);
});

// 处理未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown(1);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  gracefulShutdown(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  gracefulShutdown(0);
});

module.exports = app;