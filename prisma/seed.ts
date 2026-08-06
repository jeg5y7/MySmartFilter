import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Common air filter sizes with prices
const filterProducts = [
  // 1-inch depth filters (most common)
  { sku: "FILTER-14x14x1-M8", size: "14x14x1", width: 14, height: 14, depth: 1, merv: 8, price: 1299, name: "Standard Air Filter 14x14x1" },
  { sku: "FILTER-14x20x1-M8", size: "14x20x1", width: 14, height: 20, depth: 1, merv: 8, price: 1399, name: "Standard Air Filter 14x20x1" },
  { sku: "FILTER-14x25x1-M8", size: "14x25x1", width: 14, height: 25, depth: 1, merv: 8, price: 1499, name: "Standard Air Filter 14x25x1" },
  { sku: "FILTER-16x16x1-M8", size: "16x16x1", width: 16, height: 16, depth: 1, merv: 8, price: 1399, name: "Standard Air Filter 16x16x1" },
  { sku: "FILTER-16x20x1-M8", size: "16x20x1", width: 16, height: 20, depth: 1, merv: 8, price: 1499, name: "Standard Air Filter 16x20x1" },
  { sku: "FILTER-16x25x1-M8", size: "16x25x1", width: 16, height: 25, depth: 1, merv: 8, price: 1599, name: "Standard Air Filter 16x25x1" },
  { sku: "FILTER-18x18x1-M8", size: "18x18x1", width: 18, height: 18, depth: 1, merv: 8, price: 1499, name: "Standard Air Filter 18x18x1" },
  { sku: "FILTER-18x20x1-M8", size: "18x20x1", width: 18, height: 20, depth: 1, merv: 8, price: 1599, name: "Standard Air Filter 18x20x1" },
  { sku: "FILTER-20x20x1-M8", size: "20x20x1", width: 20, height: 20, depth: 1, merv: 8, price: 1599, name: "Standard Air Filter 20x20x1" },
  { sku: "FILTER-20x22x1-M8", size: "20x22x1", width: 20, height: 22, depth: 1, merv: 8, price: 1699, name: "Standard Air Filter 20x22x1" },
  { sku: "FILTER-20x25x1-M8", size: "20x25x1", width: 20, height: 25, depth: 1, merv: 8, price: 1799, name: "Standard Air Filter 20x25x1" },
  { sku: "FILTER-24x24x1-M8", size: "24x24x1", width: 24, height: 24, depth: 1, merv: 8, price: 1899, name: "Standard Air Filter 24x24x1" },
  { sku: "FILTER-25x25x1-M8", size: "25x25x1", width: 25, height: 25, depth: 1, merv: 8, price: 1999, name: "Standard Air Filter 25x25x1" },
  
  // MERV 11 versions (better filtration)
  { sku: "FILTER-16x20x1-M11", size: "16x20x1", width: 16, height: 20, depth: 1, merv: 11, price: 1899, name: "Premium Air Filter 16x20x1" },
  { sku: "FILTER-16x25x1-M11", size: "16x25x1", width: 16, height: 25, depth: 1, merv: 11, price: 1999, name: "Premium Air Filter 16x25x1" },
  { sku: "FILTER-20x20x1-M11", size: "20x20x1", width: 20, height: 20, depth: 1, merv: 11, price: 1999, name: "Premium Air Filter 20x20x1" },
  { sku: "FILTER-20x25x1-M11", size: "20x25x1", width: 20, height: 25, depth: 1, merv: 11, price: 2199, name: "Premium Air Filter 20x25x1" },
  { sku: "FILTER-24x24x1-M11", size: "24x24x1", width: 24, height: 24, depth: 1, merv: 11, price: 2299, name: "Premium Air Filter 24x24x1" },
  
  // MERV 13 versions (hospital-grade)
  { sku: "FILTER-16x20x1-M13", size: "16x20x1", width: 16, height: 20, depth: 1, merv: 13, price: 2499, name: "Hospital-Grade Filter 16x20x1" },
  { sku: "FILTER-16x25x1-M13", size: "16x25x1", width: 16, height: 25, depth: 1, merv: 13, price: 2599, name: "Hospital-Grade Filter 16x25x1" },
  { sku: "FILTER-20x20x1-M13", size: "20x20x1", width: 20, height: 20, depth: 1, merv: 13, price: 2599, name: "Hospital-Grade Filter 20x20x1" },
  { sku: "FILTER-20x25x1-M13", size: "20x25x1", width: 20, height: 25, depth: 1, merv: 13, price: 2799, name: "Hospital-Grade Filter 20x25x1" },
  
  // 2-inch depth filters
  { sku: "FILTER-16x25x2-M8", size: "16x25x2", width: 16, height: 25, depth: 2, merv: 8, price: 2199, name: "Deep Pleat Filter 16x25x2" },
  { sku: "FILTER-20x20x2-M8", size: "20x20x2", width: 20, height: 20, depth: 2, merv: 8, price: 2199, name: "Deep Pleat Filter 20x20x2" },
  { sku: "FILTER-20x25x2-M8", size: "20x25x2", width: 20, height: 25, depth: 2, merv: 8, price: 2399, name: "Deep Pleat Filter 20x25x2" },
  
  // 4-inch depth filters (longest lasting)
  { sku: "FILTER-16x25x4-M11", size: "16x25x4", width: 16, height: 25, depth: 4, merv: 11, price: 3499, name: "Extended Life Filter 16x25x4" },
  { sku: "FILTER-20x25x4-M11", size: "20x25x4", width: 20, height: 25, depth: 4, merv: 11, price: 3699, name: "Extended Life Filter 20x25x4" },
];

// The hardware itself — price is a placeholder pending founder pricing
const monitorProduct = {
  sku: "SFM-100",
  name: "MySmartFilter Monitor",
  productType: "monitor",
  description:
    "The smart filter monitor: measures the pressure drop across your furnace filter and tells you when replacing it costs less than the energy it wastes. Includes the full install kit and power adapter.",
  size: "Monitor",
  width: 0,
  height: 0,
  depth: 0,
  merv: null as number | null,
  price: 9900,
};

async function main() {
  console.log("Seeding filter products...");

  await prisma.filterProduct.upsert({
    where: { sku: monitorProduct.sku },
    update: {
      name: monitorProduct.name,
      productType: monitorProduct.productType,
      description: monitorProduct.description,
      inStock: true,
    },
    create: { ...monitorProduct, inStock: true },
  });
  console.log("Seeded the smart filter monitor product");

  for (const product of filterProducts) {
    await prisma.filterProduct.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        size: product.size,
        width: product.width,
        height: product.height,
        depth: product.depth,
        merv: product.merv,
        price: product.price,
        description: `${product.merv ? `MERV ${product.merv} rated. ` : ""}Dimensions: ${product.width}" × ${product.height}" × ${product.depth}"`,
      },
      create: {
        sku: product.sku,
        name: product.name,
        size: product.size,
        width: product.width,
        height: product.height,
        depth: product.depth,
        merv: product.merv,
        price: product.price,
        description: `${product.merv ? `MERV ${product.merv} rated. ` : ""}Dimensions: ${product.width}" × ${product.height}" × ${product.depth}"`,
        inStock: true,
      },
    });
  }

  console.log(`Seeded ${filterProducts.length} filter products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
