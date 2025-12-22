import { Request, Response, NextFunction } from 'express';
import { clerkClient, verifyToken } from '@clerk/clerk-sdk-node';
import { prisma } from '../utils/prisma';

/**
 * Extended Express Request with user information
 */
export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    clerkId: string;
    email: string;
    name?: string;
  };
}

/**
 * Middleware to verify Clerk JWT token and attach user to request
 */
export async function authenticateUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the JWT token with Clerk
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    if (!payload || !payload.sub) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }

    // Get user from Clerk using the user ID from the token
    const clerkUser = await clerkClient.users.getUser(payload.sub);

    if (!clerkUser) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    // Find or create user in our database
    let user = await prisma.user.findUnique({
      where: { clerkId: clerkUser.id },
    });

    if (!user) {
      // Create user if doesn't exist
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      if (!email) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'User email not found',
        });
      }

      user = await prisma.user.create({
        data: {
          clerkId: clerkUser.id,
          email,
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || null,
        },
      });

      console.log(`✅ Created new user: ${user.email}`);
    }

    // Attach user to request
    req.userId = user.id;
    req.user = {
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name || undefined,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed',
    });
  }
}

/**
 * Optional authentication middleware
 * Doesn't fail if no token is provided, but attaches user if token is valid
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user
      return next();
    }

    // If token is provided, try to authenticate
    await authenticateUser(req, res, next);
  } catch (error) {
    // If authentication fails, just continue without user
    next();
  }
}
