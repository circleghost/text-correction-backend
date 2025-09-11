import { Router } from 'express';
import healthRoutes from './health';
import textRoutes from './text';
import { googleDocsRoutes } from './googleDocsRoutes';

const router = Router();

// Mount health check routes
router.use('/health', healthRoutes);
router.use('/ready', healthRoutes);

// API routes will be added here as they are implemented
router.use('/api/v1/text', textRoutes);
router.use('/api/v1/google-docs', googleDocsRoutes);
// router.use('/api/v1/auth', authRoutes);
// router.use('/api/v1/users', userRoutes);

// API info endpoint
router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Text Correction API',
      version: '1.0.0',
      description: 'AI-powered Chinese text correction service',
      documentation: '/api-docs',
      health: '/health',
      readiness: '/ready'
    },
    message: 'Welcome to the Text Correction API',
    timestamp: new Date().toISOString()
  });
});

export default router;