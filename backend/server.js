const express = require('express');
const session = require('express-session');
const path = require('path');
const client = require('prom-client'); // Prometheus client
const authRoutes = require('./routes/auth');

const app = express();

// === Debug middleware to log every request === //
app.use((req, res, next) => {
  console.log(`[DEBUG] Incoming: ${req.method} ${req.url}`);
  next();
});

// === Prometheus Monitoring Setup === //
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

const counter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

app.use((req, res, next) => {
  res.on('finish', () => {
    counter.labels(req.method, req.path, res.statusCode).inc();
  });
  next();
});

// === Core Express Setup === //
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret123',
  resave: false,
  saveUninitialized: false
}));

// === Mount API Routes === //
app.use('/api', authRoutes);

// === Route Shortcuts === //
app.get('/login', (req, res) => res.redirect('/login.html'));
app.get('/signup', (req, res) => res.redirect('/signup.html'));
app.get('/dashboard', (req, res) => res.redirect('/dashboard.html'));

// === Metrics Endpoint === //
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// === Diagnostic: List All Mounted Routes === //
app.get('/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push(middleware.route);
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push(handler.route);
        }
      });
    }
  });
  res.json(routes.map(r => r.path));
});

// === Serve static files and views === //
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));

// === Health and Readiness Probes === //
app.get('/healthz', (req, res) => {
  res.sendStatus(200);
});

app.get('/ready', (req, res) => {
  res.sendStatus(200);
});

// === Export for test, and start server only if run directly === //
if (require.main === module) {
  const port = process.env.PORT || 3000;
  const HOST = '0.0.0.0';
  app.listen(port, HOST, () => {
    console.log(`🚀 Server running on http://${HOST}:${port}`);
  });
}

module.exports = app;
