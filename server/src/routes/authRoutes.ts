import { Router } from 'express';
import {
  changePassword,
  forgotPassword,
  login,
  logout,
  me,
  register,
  registerNgo,
  resetPassword,
  updateProfile,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  ngoRegisterSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../validation/schemas.js';

export const authRouter = Router();

authRouter.post('/register', authLimiter, validateBody(registerSchema), register);
authRouter.post('/register-ngo', authLimiter, validateBody(ngoRegisterSchema), registerNgo);
authRouter.post('/login', authLimiter, validateBody(loginSchema), login);
authRouter.post('/logout', logout);
authRouter.get('/me', authenticate, me);
authRouter.post('/forgot-password', authLimiter, validateBody(forgotPasswordSchema), forgotPassword);
authRouter.post('/reset-password', authLimiter, validateBody(resetPasswordSchema), resetPassword);
authRouter.post(
  '/change-password',
  authenticate,
  authLimiter,
  validateBody(changePasswordSchema),
  changePassword,
);
authRouter.patch('/profile', authenticate, validateBody(updateProfileSchema), updateProfile);
