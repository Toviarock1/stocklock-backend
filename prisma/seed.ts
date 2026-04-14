import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const products = [
  {
    name: "Air Jordan 1 Retro High OG",
    description:
      "Limited edition colorway of the iconic Air Jordan 1. Only 500 pairs released worldwide.",
    price: 180,
    totalStock: 50,
    availableStock: 50,
  },
  {
    name: "Supreme Box Logo Hoodie FW24",
    description:
      "Fall/Winter 2024 box logo hoodie drop. Heavyweight cotton fleece, embroidered logo.",
    price: 168,
    totalStock: 30,
    availableStock: 30,
  },
  {
    name: "PlayStation 5 Pro Bundle",
    description:
      "PS5 Pro console with two controllers and 12-month PlayStation Plus. Limited regional allocation.",
    price: 699,
    totalStock: 20,
    availableStock: 20,
  },
  {
    name: "Yeezy Boost 350 V2 Onyx",
    description:
      "Adidas x Ye collaboration. Primeknit upper, full-length Boost midsole. Extremely limited restock.",
    price: 230,
    totalStock: 40,
    availableStock: 40,
  },
  {
    name: "Apple Vision Pro (256GB)",
    description:
      "Spatial computing headset. First-gen hardware, visionOS 2.0 ready. Allocated per region.",
    price: 3499,
    totalStock: 10,
    availableStock: 10,
  },
  {
    name: "Travis Scott x Nike Cactus Jack Tee",
    description:
      "Collaborative graphic tee from the Cactus Jack x Nike capsule. Heavy washed cotton.",
    price: 65,
    totalStock: 100,
    availableStock: 100,
  },
  {
    name: "Rolex Submariner Date (Black)",
    description:
      "Ref. 126610LN. Oystersteel, ceramic bezel, 300m water resistance. Authorized dealer allocation.",
    price: 10550,
    totalStock: 3,
    availableStock: 3,
  },
  {
    name: "Nvidia RTX 5090 Founders Edition",
    description:
      "Flagship GPU for 2025. 32GB GDDR7, 575W TDP. Direct-from-Nvidia drop, one per household.",
    price: 1999,
    totalStock: 15,
    availableStock: 15,
  },
];

async function main() {
  console.log("Seeding products...");

  await prisma.product.deleteMany();

  const created = await prisma.product.createMany({ data: products });

  console.log(`Created ${created.count} products.`);

  const all = await prisma.product.findMany({
    select: { id: true, name: true, availableStock: true, price: true },
  });

  console.table(all);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
