import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  await prisma.product.createMany({
    skipDuplicates: true,
    data: [
      {
        name: 'Basic Widget',
        description: 'An everyday widget',
        priceUsdc: 1.0,
      },
      {
        name: 'Premium Widget',
        description: 'A high-quality widget',
        priceUsdc: 2.0,
      },
      {
        name: 'Deluxe Widget',
        description: 'The best widget money can buy',
        priceUsdc: 3.0,
      },
    ],
  });
  console.log('Seeded products');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
