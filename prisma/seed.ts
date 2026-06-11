import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Get default password from environment variable, or use a secure default
  const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'ChangeMe@123456'
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@local.lab'

  const hashedPassword = await bcrypt.hash(defaultPassword, 12)

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: hashedPassword,
      full_name: 'Administrator',
      name: 'Administrator',
    },
  })

  console.log(`Seed completed: ${user.email} (id: ${user.id})`)
  console.log(`Initial email: ${adminEmail}`)
  if (process.env.ADMIN_DEFAULT_PASSWORD) {
    console.log('IMPORTANT: Change the password after first login.')
  } else {
    console.log('IMPORTANT: Default password was used. Change it after first login.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
