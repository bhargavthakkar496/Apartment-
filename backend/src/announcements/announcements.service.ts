import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AnnouncementsService {
  private static readonly supportedTargetRoles = ['resident', 'owner'];

  constructor(private prisma: PrismaService) {}

  async createAnnouncement(input: {
    title: string;
    content: string;
    targetRoles?: string[];
    createdByRole?: string;
    createdByName?: string;
  }) {
    const title = input.title?.trim() ?? '';
    const content = input.content?.trim() ?? '';
    if (!title || !content) {
      throw new BadRequestException('Title and content are required');
    }

    const normalizedRoles = this.normalizeTargetRoles(input.targetRoles);

    return this.prisma.announcement.create({
      data: {
        title,
        content,
        targetRoles: normalizedRoles,
        createdByRole: input.createdByRole?.trim() ?? 'chairman',
        createdByName: input.createdByName?.trim() ?? null,
      },
    });
  }

  async getAnnouncements(role?: string) {
    const normalizedRole = role?.trim().toLowerCase();

    return this.prisma.announcement.findMany({
      where: normalizedRole
          ? {
              targetRoles: {
                has: normalizedRole,
              },
            }
          : undefined,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  private normalizeTargetRoles(targetRoles?: string[]) {
    const normalized = (targetRoles ?? [])
      .map((role) => role.trim().toLowerCase())
      .filter((role): role is string =>
        AnnouncementsService.supportedTargetRoles.includes(role),
      );
    const uniqueRoles: string[] = [...new Set(normalized)];
    return uniqueRoles.length > 0
      ? uniqueRoles
      : [...AnnouncementsService.supportedTargetRoles];
  }
}
