const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const config = require('./config');

const { authLimiter, apiLimiter } = require('./middleware/rate-limit.middleware');
const authRoutes = require('./routes/auth.routes');
const inviteRoutes = require('./routes/invite.routes');
const batchRoutes = require('./routes/batch.routes');
const sessionRoutes = require('./routes/session.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const audioRoutes = require('./routes/audio.routes');
const { router: googleAuthRoutes, passport } = require('./routes/google-auth.routes');

const app = express();

app.use(helmet());
app.use(cors({
  origin: config.frontend.url,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EnglishX Core API',
      version: '1.0.0',
      description: 'REST API for EnglishX — Auth, Batches, Invites, Sessions, Dashboards',
    },
    servers: [{ url: '/api', description: 'API base path' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: ['./src/routes/*.js'],
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ms1-core-api', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/auth', googleAuthRoutes);
app.use('/api/invites', apiLimiter, inviteRoutes);
app.use('/api/batches', apiLimiter, batchRoutes);
app.use('/api/sessions', apiLimiter, sessionRoutes);
app.use('/api/sessions', apiLimiter, audioRoutes);
app.use('/api/dashboard', apiLimiter, dashboardRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`ms1-core-api running on port ${PORT} [${config.nodeEnv}]`);
});

module.exports = app;
