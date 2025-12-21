import { Router, Request, Response } from 'express';
import { Webhook } from 'svix';
import { prisma } from '../utils/prisma';

const router = Router();

/**
 * Clerk Webhook Handler
 * Syncs user data from Clerk to our database
 *
 * Setup: https://clerk.com/docs/integrations/webhooks
 *
 * Events to listen for:
 * - user.created
 * - user.updated
 * - user.deleted
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('CLERK_WEBHOOK_SECRET is not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Get the webhook payload and headers
    const payload = JSON.stringify(req.body);
    const headers = req.headers;

    // Verify the webhook signature
    const wh = new Webhook(webhookSecret);
    let evt: any;

    try {
      evt = wh.verify(payload, {
        'svix-id': headers['svix-id'] as string,
        'svix-timestamp': headers['svix-timestamp'] as string,
        'svix-signature': headers['svix-signature'] as string,
      });
    } catch (error) {
      console.error('Error verifying webhook:', error);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Handle the event
    const eventType = evt.type;

    switch (eventType) {
      case 'user.created':
        await handleUserCreated(evt.data);
        break;

      case 'user.updated':
        await handleUserUpdated(evt.data);
        break;

      case 'user.deleted':
        await handleUserDeleted(evt.data);
        break;

      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle user.created event
 */
async function handleUserCreated(data: any) {
  const clerkId = data.id;
  const email = data.email_addresses?.[0]?.email_address;
  const firstName = data.first_name;
  const lastName = data.last_name;

  if (!email) {
    console.error('No email found for user:', clerkId);
    return;
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (existingUser) {
    console.log(`User already exists: ${email}`);
    return;
  }

  // Create user
  const user = await prisma.user.create({
    data: {
      clerkId,
      email,
      name: `${firstName || ''} ${lastName || ''}`.trim() || null,
    },
  });

  console.log(`✅ Created user from webhook: ${user.email}`);
}

/**
 * Handle user.updated event
 */
async function handleUserUpdated(data: any) {
  const clerkId = data.id;
  const email = data.email_addresses?.[0]?.email_address;
  const firstName = data.first_name;
  const lastName = data.last_name;

  if (!email) {
    console.error('No email found for user:', clerkId);
    return;
  }

  // Update user
  await prisma.user.update({
    where: { clerkId },
    data: {
      email,
      name: `${firstName || ''} ${lastName || ''}`.trim() || null,
    },
  });

  console.log(`✅ Updated user from webhook: ${email}`);
}

/**
 * Handle user.deleted event
 */
async function handleUserDeleted(data: any) {
  const clerkId = data.id;

  // Delete user (cascade will delete all related data)
  await prisma.user.delete({
    where: { clerkId },
  });

  console.log(`✅ Deleted user from webhook: ${clerkId}`);
}

export default router;
