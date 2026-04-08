import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { success, error } from '../utils/response.js';

export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return error(res, 'Invalid username or password', 401);
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return error(res, 'Invalid username or password', 401);
    }

    const secret = process.env.JWT_SECRET || 'dev-secret';
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      secret,
      { expiresIn: '7d' },
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return success(res, { token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    return error(res, 'Login failed', 500);
  }
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie('token');
  return success(res, { message: 'Logged out' });
}

export async function me(req: Request, res: Response) {
  if (!req.user) {
    return error(res, 'Not authenticated', 401);
  }
  return success(res, req.user);
}
