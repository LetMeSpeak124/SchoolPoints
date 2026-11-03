'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function createActivityAction(formData: FormData) {
  try {
    const session = await requireRole(['ADMIN', 'TEACHER']);
    const title = (formData.get('title') as string)?.trim();
    const description = ((formData.get('description') as string) || '').trim();
    const category = ((formData.get('category') as string) || '').trim() || null;

    if (!title || title.length > 150) {
      return { error: 'Please provide a valid activity title (1-150 characters).' };
    }
    if (description.length > 1000) {
      return { error: 'Description is too long (maximum 1000 characters).' };
    }

    await prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          title,
          description: description || null,
          category,
          createdById: session.userId,
        },
      });

      await logAudit(tx, {
        actorId: session.userId,
        action: 'ACTIVITY_CREATED',
        entityType: 'Activity',
        entityId: activity.id,
        details: { title, category },
      });
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to create activity' };
  }
}