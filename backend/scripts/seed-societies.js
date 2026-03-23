require('dotenv/config');

const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || '',
});

const prisma = new PrismaClient({ adapter });

const societies = [
  {
    country: 'india',
    state: 'gujarat',
    city: 'ahmedabad',
    area: 'vastral',
    pincode: '382418',
    name: 'Maheshwari Nagar',
    type: 'society',
  },
  {
    country: 'india',
    state: 'gujarat',
    city: 'ahmedabad',
    area: 'vastral',
    pincode: '382418',
    name: 'Suryam Sky',
    type: 'apartment',
  },
  {
    country: 'india',
    state: 'gujarat',
    city: 'ahmedabad',
    area: 'vastral',
    pincode: '382418',
    name: 'Karnavati Bunglows',
    type: 'society',
  },
  {
    country: 'india',
    state: 'gujarat',
    city: 'ahmedabad',
    area: 'vastral',
    pincode: '382418',
    name: 'Alok Tenament',
    type: 'society',
  },
  {
    country: 'india',
    state: 'gujarat',
    city: 'ahmedabad',
    area: 'vastral',
    pincode: '382418',
    name: 'Madhav Bunglows',
    type: 'society',
  },
  {
    country: 'uae',
    state: 'dubai',
    city: 'dubai',
    area: 'dubai marina',
    pincode: '000001',
    name: 'Marina Gate Residences',
    type: 'apartment',
  },
  {
    country: 'uae',
    state: 'dubai',
    city: 'dubai',
    area: 'dubai marina',
    pincode: '000001',
    name: 'Ocean Pearl Towers',
    type: 'apartment',
  },
  {
    country: 'uae',
    state: 'dubai',
    city: 'dubai',
    area: 'dubai marina',
    pincode: '000001',
    name: 'Palm Horizon Villas',
    type: 'society',
  },
  {
    country: 'uae',
    state: 'dubai',
    city: 'dubai',
    area: 'dubai marina',
    pincode: '000001',
    name: 'Sunset Creek Homes',
    type: 'society',
  },
  {
    country: 'uae',
    state: 'dubai',
    city: 'dubai',
    area: 'dubai marina',
    pincode: '000001',
    name: 'Golden Dunes Residency',
    type: 'apartment',
  },
  {
    country: 'singapore',
    state: 'central region',
    city: 'singapore',
    area: 'tampines',
    pincode: '529508',
    name: 'Merlion Heights',
    type: 'apartment',
  },
  {
    country: 'singapore',
    state: 'central region',
    city: 'singapore',
    area: 'tampines',
    pincode: '529508',
    name: 'Bayview Residences',
    type: 'apartment',
  },
  {
    country: 'singapore',
    state: 'central region',
    city: 'singapore',
    area: 'tampines',
    pincode: '529508',
    name: 'Orchid Garden Homes',
    type: 'society',
  },
  {
    country: 'singapore',
    state: 'central region',
    city: 'singapore',
    area: 'tampines',
    pincode: '529508',
    name: 'Skyline Crest',
    type: 'apartment',
  },
  {
    country: 'singapore',
    state: 'central region',
    city: 'singapore',
    area: 'tampines',
    pincode: '529508',
    name: 'Harbour Light Estate',
    type: 'society',
  },
  {
    country: 'uk',
    state: 'england',
    city: 'london',
    area: 'canary wharf',
    pincode: '100001',
    name: 'Thames View Court',
    type: 'apartment',
  },
  {
    country: 'uk',
    state: 'england',
    city: 'london',
    area: 'canary wharf',
    pincode: '100001',
    name: 'Royal Dock Residences',
    type: 'apartment',
  },
  {
    country: 'uk',
    state: 'england',
    city: 'london',
    area: 'canary wharf',
    pincode: '100001',
    name: 'Crown Meadow Homes',
    type: 'society',
  },
  {
    country: 'uk',
    state: 'england',
    city: 'london',
    area: 'canary wharf',
    pincode: '100001',
    name: 'Westminster Grove',
    type: 'society',
  },
  {
    country: 'uk',
    state: 'england',
    city: 'london',
    area: 'canary wharf',
    pincode: '100001',
    name: 'Riverstone Apartments',
    type: 'apartment',
  },
  {
    country: 'usa',
    state: 'california',
    city: 'san francisco',
    area: 'fremont',
    pincode: '941050',
    name: 'Golden Gate Residences',
    type: 'apartment',
  },
  {
    country: 'usa',
    state: 'california',
    city: 'san francisco',
    area: 'fremont',
    pincode: '941050',
    name: 'Pacific Crest Homes',
    type: 'society',
  },
  {
    country: 'usa',
    state: 'california',
    city: 'san francisco',
    area: 'fremont',
    pincode: '941050',
    name: 'Maple Ridge Estates',
    type: 'society',
  },
  {
    country: 'usa',
    state: 'california',
    city: 'san francisco',
    area: 'fremont',
    pincode: '941050',
    name: 'Silicon Heights',
    type: 'apartment',
  },
  {
    country: 'usa',
    state: 'california',
    city: 'san francisco',
    area: 'fremont',
    pincode: '941050',
    name: 'Redwood Villas',
    type: 'society',
  },
];

const apartmentUnits = Array.from({ length: 10 }, (_, index) => `${101 + index}`);

async function main() {
  for (const society of societies) {
    const savedSociety = await prisma.society.upsert({
      where: {
        country_state_city_area_name: {
          country: society.country,
          state: society.state,
          city: society.city,
          area: society.area,
          name: society.name,
        },
      },
      update: {
        pincode: society.pincode,
        type: society.type,
      },
      create: society,
    });

    for (const flatNumber of apartmentUnits) {
      await prisma.apartmentUnit.upsert({
        where: {
          societyId_flatNumber: {
            societyId: savedSociety.id,
            flatNumber,
          },
        },
        update: {},
        create: {
          societyId: savedSociety.id,
          flatNumber,
        },
      });
    }
  }

  console.log(
    `Seeded ${societies.length} societies and ${societies.length * apartmentUnits.length} apartment units.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
