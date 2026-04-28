/**
 * Insurer Resolver Bridge - Connects to the data layer to resolve insurer names
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Fuzzy match insurer name against database
 * Returns insurer_id or null if not found
 */
export async function resolveInsurer(rawName: string): Promise<string | null> {
  if (!rawName || rawName.trim().length === 0) {
    return null;
  }
  
  const normalized = rawName.toLowerCase().trim();
  
  // Try exact match on brand name
  const exactMatch = await prisma.insurer.findFirst({
    where: {
      brandName: {
        equals: rawName,
        mode: 'insensitive',
      },
    },
  });
  
  if (exactMatch) {
    return exactMatch.id;
  }
  
  // Try exact match on registered name
  const registeredMatch = await prisma.insurer.findFirst({
    where: {
      registeredName: {
        equals: rawName,
        mode: 'insensitive',
      },
    },
  });
  
  if (registeredMatch) {
    return registeredMatch.id;
  }
  
  // Try fuzzy match on brand name (contains)
  const fuzzyMatch = await prisma.insurer.findFirst({
    where: {
      OR: [
        {
          brandName: {
            contains: normalized,
            mode: 'insensitive',
          },
        },
        {
          registeredName: {
            contains: normalized,
            mode: 'insensitive',
          },
        },
      ],
    },
  });
  
  if (fuzzyMatch) {
    return fuzzyMatch.id;
  }
  
  // Check former names (stored as JSON array)
  const allInsurers = await prisma.insurer.findMany();
  
  for (const insurer of allInsurers) {
    try {
      const formerNames = JSON.parse(insurer.formerNames) as string[];
      const match = formerNames.some(
        (name) => name.toLowerCase().includes(normalized) || normalized.includes(name.toLowerCase())
      );
      
      if (match) {
        return insurer.id;
      }
    } catch {
      // Invalid JSON, skip
    }
  }
  
  // Log unresolved insurer
  await logUnresolvedInsurer(rawName);
  
  return null;
}

/**
 * Log unresolved insurer for manual review
 */
async function logUnresolvedInsurer(rawName: string): Promise<void> {
  try {
    await prisma.unresolvedInsurer.create({
      data: {
        rawNameInPdf: rawName,
        attemptedAt: new Date().toISOString(),
        resolvedInsurerIdManual: null,
        notes: null,
      },
    });
  } catch (error) {
    // Ignore duplicate errors
    console.warn(`Failed to log unresolved insurer: ${rawName}`);
  }
}

/**
 * Get insurer by ID
 */
export async function getInsurerById(insurerId: string) {
  return prisma.insurer.findUnique({
    where: { id: insurerId },
  });
}
