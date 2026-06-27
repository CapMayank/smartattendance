const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDb() {
  const logs = await prisma.attendanceLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: 10,
    include: { staff: true }
  });
  console.log("Latest Attendance Logs:", JSON.stringify(logs, null, 2));
}

checkDb()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
