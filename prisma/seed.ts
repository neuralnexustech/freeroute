import { prisma } from "../src/lib/db";
import { PROVIDERS } from "../src/lib/providers";

// Seed: provider shells only. No demo models, keys, logs, or fake content.
async function main() {
  for (const p of PROVIDERS) {
    await prisma.provider.upsert({
      where: { slug: p.slug },
      update: { name: p.name, icon: p.icon },
      create: { slug: p.slug, name: p.name, icon: p.icon, baseUrl: p.baseUrl },
    });
  }
  console.log("Seeded provider shells (no demo content).");
}

main().finally(() => prisma.$disconnect());
