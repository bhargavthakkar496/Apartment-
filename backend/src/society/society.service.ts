import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type SocietyFilters = {
  country?: string;
  state?: string;
  city?: string;
  area?: string;
  pincode?: string;
};

type SocietyCreateInput = {
  country: string;
  state: string;
  city: string;
  area: string;
  pincode: string;
  name: string;
  type: string;
};

@Injectable()
export class SocietyService {
  private readonly allowedTypes = new Set(['society', 'apartment']);

  constructor(private readonly prisma: PrismaService) {}

  async getSocieties(filters: SocietyFilters) {
    const normalizedFilters = this.normalizeFilters(filters);
    const items = await this.prisma.society.findMany({
      where: {
        country: normalizedFilters.country,
        state: normalizedFilters.state,
        city: normalizedFilters.city,
        area: normalizedFilters.area,
        pincode: normalizedFilters.pincode,
      },
      orderBy: [{ country: 'asc' }, { state: 'asc' }, { city: 'asc' }, { area: 'asc' }, { name: 'asc' }],
    });

    return {
      filters: normalizedFilters,
      total: items.length,
      items,
    };
  }

  async discoverSocietiesByPincode(pincode: string) {
    const normalizedPincode = this.normalizeRequiredPincode(pincode);
    const exactItems = await this.prisma.society.findMany({
      where: { pincode: normalizedPincode },
      orderBy: [{ country: 'asc' }, { state: 'asc' }, { city: 'asc' }, { area: 'asc' }, { name: 'asc' }],
    });

    if (exactItems.length > 0) {
      return {
        requestedPincode: normalizedPincode,
        matchedPincode: normalizedPincode,
        matchType: 'exact',
        total: exactItems.length,
        items: exactItems,
      };
    }

    const allPincodes = await this.prisma.society.findMany({
      select: { pincode: true },
      orderBy: { pincode: 'asc' },
    });
    const distinctPincodes = this.distinctValues(
      allPincodes.map((society) => society.pincode),
    );

    if (distinctPincodes.length == 0) {
      return {
        requestedPincode: normalizedPincode,
        matchedPincode: null,
        matchType: 'none',
        total: 0,
        items: [],
      };
    }

    const nearestPincode = this.findNearestPincode(
      normalizedPincode,
      distinctPincodes,
    );

    const nearbyItems = await this.prisma.society.findMany({
      where: { pincode: nearestPincode },
      orderBy: [{ country: 'asc' }, { state: 'asc' }, { city: 'asc' }, { area: 'asc' }, { name: 'asc' }],
    });

    return {
      requestedPincode: normalizedPincode,
      matchedPincode: nearestPincode,
      matchType: 'nearby',
      total: nearbyItems.length,
      items: nearbyItems,
    };
  }

  async createSociety(input: SocietyCreateInput) {
    const data = this.validateAndNormalizeCreateInput(input);

    try {
      return await this.prisma.society.create({ data });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A society or apartment with this country, state, city, area, and name already exists.',
        );
      }
      throw error;
    }
  }

  async getApartmentUnits(societyId: string) {
    const normalizedSocietyId = societyId.trim();
    if (!normalizedSocietyId) {
      throw new BadRequestException('societyId is required.');
    }

    const society = await this.prisma.society.findUnique({
      where: { id: normalizedSocietyId },
    });

    if (!society) {
      throw new BadRequestException('Selected society was not found.');
    }

    const apartmentUnits = await this.prisma.apartmentUnit.findMany({
      where: { societyId: normalizedSocietyId },
      orderBy: { flatNumber: 'asc' },
    });

    const occupiedResidents = await this.prisma.resident.findMany({
      where: {
        societyId: normalizedSocietyId,
        isActive: true,
      },
      select: {
        flatNo: true,
        name: true,
        user: {
          select: {
            role: true,
          },
        },
      },
    });

    const occupiedFlatMap = new Map<string, string>();
    const ownerListedFlatMap = new Map<string, string>();

    for (const resident of occupiedResidents) {
      if (resident.user.role === 'owner') {
        ownerListedFlatMap.set(resident.flatNo, resident.name);
      } else {
        occupiedFlatMap.set(resident.flatNo, resident.name);
      }
    }

    return apartmentUnits.map((apartmentUnit) => ({
      ...apartmentUnit,
      occupied: occupiedFlatMap.has(apartmentUnit.flatNumber),
      occupiedBy: occupiedFlatMap.get(apartmentUnit.flatNumber) ?? null,
      ownerListed: ownerListedFlatMap.has(apartmentUnit.flatNumber),
      ownerListedBy: ownerListedFlatMap.get(apartmentUnit.flatNumber) ?? null,
    }));
  }

  async getCountries() {
    const societies = await this.prisma.society.findMany({
      select: { country: true },
      orderBy: { country: 'asc' },
    });

    return this.distinctValues(
      societies.map((society) => society.country),
    );
  }

  async getStates(filters: Pick<SocietyFilters, 'country'>) {
    const normalizedCountry = this.normalizeOptionalText(filters.country, 'country');
    const societies = await this.prisma.society.findMany({
      where: {
        country: normalizedCountry,
      },
      select: { state: true },
      orderBy: { state: 'asc' },
    });

    return this.distinctValues(
      societies.map((society) => society.state),
    );
  }

  async getCities(filters: Pick<SocietyFilters, 'country' | 'state'>) {
    const normalizedCountry = this.normalizeOptionalText(filters.country, 'country');
    const normalizedState = this.normalizeOptionalText(filters.state, 'state');
    const societies = await this.prisma.society.findMany({
      where: {
        country: normalizedCountry,
        state: normalizedState,
      },
      select: { city: true },
      orderBy: { city: 'asc' },
    });

    return this.distinctValues(
      societies.map((society) => society.city),
    );
  }

  async getAreas(filters: Pick<SocietyFilters, 'country' | 'state' | 'city'>) {
    const normalizedCountry = this.normalizeOptionalText(filters.country, 'country');
    const normalizedState = this.normalizeOptionalText(filters.state, 'state');
    const normalizedCity = this.normalizeOptionalText(filters.city, 'city');
    const societies = await this.prisma.society.findMany({
      where: {
        country: normalizedCountry,
        state: normalizedState,
        city: normalizedCity,
      },
      select: { area: true },
      orderBy: { area: 'asc' },
    });

    return this.distinctValues(
      societies.map((society) => society.area),
    );
  }

  private normalizeFilters(filters: SocietyFilters): SocietyFilters {
    return {
      country: this.normalizeOptionalText(filters.country, 'country'),
      state: this.normalizeOptionalText(filters.state, 'state'),
      city: this.normalizeOptionalText(filters.city, 'city'),
      area: this.normalizeOptionalText(filters.area, 'area'),
      pincode: this.normalizeOptionalPincode(filters.pincode),
    };
  }

  private validateAndNormalizeCreateInput(input: SocietyCreateInput) {
    const country = this.normalizeRequiredText(input.country, 'country');
    const state = this.normalizeRequiredText(input.state, 'state');
    const city = this.normalizeRequiredText(input.city, 'city');
    const area = this.normalizeRequiredText(input.area, 'area');
    const pincode = this.normalizeRequiredPincode(input.pincode);
    const name = this.normalizeRequiredName(input.name);
    const type = this.normalizeRequiredText(input.type, 'type');

    if (!this.allowedTypes.has(type)) {
      throw new BadRequestException('Type must be either "society" or "apartment".');
    }

    return {
      country,
      state,
      city,
      area,
      pincode,
      name,
      type,
    };
  }

  private normalizeOptionalText(value: string | undefined, field: string) {
    if (value == null) return undefined;
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      throw new BadRequestException(`${field} cannot be empty.`);
    }
    return normalized;
  }

  private normalizeRequiredText(value: string | undefined, field: string) {
    const normalized = this.normalizeOptionalText(value, field);
    if (!normalized) {
      throw new BadRequestException(`${field} is required.`);
    }
    return normalized;
  }

  private normalizeOptionalPincode(value?: string) {
    if (value == null) return undefined;
    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException('pincode cannot be empty.');
    }
    if (!/^\d{6}$/.test(normalized)) {
      throw new BadRequestException('pincode must be a 6-digit number.');
    }
    return normalized;
  }

  private normalizeRequiredPincode(value: string | undefined) {
    const normalized = this.normalizeOptionalPincode(value);
    if (!normalized) {
      throw new BadRequestException('pincode is required.');
    }
    return normalized;
  }

  private normalizeRequiredName(value: string | undefined) {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException('name is required.');
    }
    if (normalized.length < 2) {
      throw new BadRequestException('name must be at least 2 characters long.');
    }
    return normalized;
  }

  private distinctValues(values: string[]) {
    return [...new Set(values)].filter(Boolean);
  }

  private findNearestPincode(requestedPincode: string, availablePincodes: string[]) {
    const requestedValue = Number.parseInt(requestedPincode, 10);

    return availablePincodes.reduce((best, current) => {
      const bestDistance = Math.abs(requestedValue - Number.parseInt(best, 10));
      const currentDistance = Math.abs(
        requestedValue - Number.parseInt(current, 10),
      );

      if (currentDistance < bestDistance) {
        return current;
      }

      return best;
    });
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
