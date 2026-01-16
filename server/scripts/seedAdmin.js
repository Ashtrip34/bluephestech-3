const bcrypt = require('bcrypt')
const prisma = require('../src/db/prismaClient')

async function seed(){
  try{
    const existing = await prisma.user.findUnique({ where: { email: 'admin@bluephes.test' } })
    if(existing){
      console.log('Admin user already exists:', existing.email)
      process.exit(0)
    }
    const hash = await bcrypt.hash('AdminPass123!', 10)
    const user = await prisma.user.create({ data: { email: 'admin@bluephes.test', password: hash, name: 'Admin', role: 'admin' } })
    console.log('Created admin:', user.email)
    process.exit(0)
  }catch(err){
    console.error('Failed to seed admin', err)
    process.exit(1)
  }
}

seed()
