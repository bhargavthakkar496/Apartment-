import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SocietyService } from './society.service';

@Controller('societies')
export class SocietyController {
  constructor(private readonly societyService: SocietyService) {}

  @Get()
  findAll(
    @Query('country') country?: string,
    @Query('state') state?: string,
    @Query('city') city?: string,
    @Query('area') area?: string,
    @Query('pincode') pincode?: string,
  ) {
    return this.societyService.getSocieties({
      country,
      state,
      city,
      area,
      pincode,
    });
  }

  @Get('discover')
  discover(@Query('pincode') pincode?: string) {
    return this.societyService.discoverSocietiesByPincode(pincode ?? '');
  }

  @Get('countries')
  findCountries() {
    return this.societyService.getCountries();
  }

  @Get('states')
  findStates(@Query('country') country?: string) {
    return this.societyService.getStates({ country });
  }

  @Get('cities')
  findCities(
    @Query('country') country?: string,
    @Query('state') state?: string,
  ) {
    return this.societyService.getCities({ country, state });
  }

  @Get('areas')
  findAreas(
    @Query('country') country?: string,
    @Query('state') state?: string,
    @Query('city') city?: string,
  ) {
    return this.societyService.getAreas({ country, state, city });
  }

  @Get(':societyId/apartments')
  findApartmentUnits(@Param('societyId') societyId: string) {
    return this.societyService.getApartmentUnits(societyId);
  }

  @Post()
  create(
    @Body()
    body: {
      country: string;
      state: string;
      city: string;
      area: string;
      pincode: string;
      name: string;
      type: string;
    },
  ) {
    return this.societyService.createSociety(body);
  }
}
