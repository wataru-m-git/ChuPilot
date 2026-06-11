import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting rack migration...')

  // Get all cages
  const cages = await prisma.cage.findMany()
  console.log(`Found ${cages.length} cages`)

  // Get unique rack_position values (avoiding Set iteration issue)
  const rackNameSet = new Set<string | null>()
  cages.forEach((c) => {
    if (c.rack_position) rackNameSet.add(c.rack_position)
  })
  const rackNames = Array.from(rackNameSet).filter((n): n is string => n !== null)
  console.log(`Found ${rackNames.length} unique rack positions:`, rackNames)

  // Create Rack records for each rack_position
  for (const name of rackNames) {
    if (!name) continue

    console.log(`Processing rack: ${name}`)

    const rack = await prisma.rack.upsert({
      where: { name },
      create: { name, slots: 26 },
      update: {},
    })

    // Update all cages with this rack_position to use the rack_id
    const rackedCages = cages.filter((c) => c.rack_position === name)
    console.log(`  Found ${rackedCages.length} cages for this rack`)

    for (const cage of rackedCages) {
      // Extract slot from cage_id (last character should be A-Z)
      const lastChar = cage.cage_id.slice(-1)
      const isValidSlot = /^[A-Z]$/.test(lastChar)

      if (isValidSlot) {
        const slot = lastChar.charCodeAt(0) - 64 // A=1, B=2, etc.
        console.log(`  Updating cage ${cage.cage_id}: slot=${slot}`)

        await prisma.cage.update({
          where: { id: cage.id },
          data: {
            rack_id: rack.id,
            slot,
          },
        })
      } else {
        console.log(`  Skipping cage ${cage.cage_id}: no valid slot letter`)
      }
    }
  }

  console.log('Migration complete!')
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
