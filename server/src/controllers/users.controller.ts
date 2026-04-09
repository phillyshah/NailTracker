import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma.js';
import { success, error, str } from '../utils/response.js';

export async function listUsers(_req: Request, res: Response) {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return success(res, users);
  } catch (err) {
    return error(res, 'Failed to fetch users', 500);
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    const { username, password, role } = req.body;
    const hash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { username, password: hash, role: role || 'user' },
      select: { id: true, username: true, role: true, createdAt: true },
    });

    return success(res, user, undefined, 201);
  } catch (err: any) {
    if (err.code === 'P2002') {
      return error(res, 'Username already exists');
    }
    return error(res, 'Failed to create user', 500);
  }
}

export async function updatePassword(req: Request, res: Response) {
  try {
    const id = str(req.params.id);
    const { password } = req.body;
    const hash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id },
      data: { password: hash },
    });

    return success(res, { message: 'Password updated' });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return error(res, 'User not found', 404);
    }
    return error(res, 'Failed to update password', 500);
  }
}

export async function updateRole(req: Request, res: Response) {
  try {
    const id = str(req.params.id);
    const { role } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, username: true, role: true, createdAt: true },
    });

    return success(res, user);
  } catch (err: any) {
    if (err.code === 'P2025') {
      return error(res, 'User not found', 404);
    }
    return error(res, 'Failed to update role', 500);
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const id = str(req.params.id);

    // Prevent deleting yourself
    if (req.user?.userId === id) {
      return error(res, 'Cannot delete your own account');
    }

    // Prevent deleting the last admin
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return error(res, 'User not found', 404);
    }

    if (user.role === 'admin') {
      const adminCount = await prisma.user.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        return error(res, 'Cannot delete the last admin user');
      }
    }

    await prisma.user.delete({ where: { id } });
    return success(res, { message: 'User deleted' });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return error(res, 'User not found', 404);
    }
    return error(res, 'Failed to delete user', 500);
  }
}
