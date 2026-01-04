import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  const readings = await prisma.sensorReading.findMany({
    take: 10,
    orderBy: {
      timestamp: 'desc'
    },
    include: {
      device: true
    }
  });

  console.log('\n📊 Recent Sensor Readings:');
  console.log('==========================\n');
  
  readings.forEach(reading => {
    console.log(`[${reading.timestamp.toLocaleTimeString()}] Device: ${reading.device.deviceId}`);
    console.log(`  Pressure: ${reading.pressure.toFixed(2)} Pa`);
    console.log(`  Temperature: ${reading.temperature.toFixed(2)}°C`);
    console.log('');
  });

  const count = await prisma.sensorReading.count();
  console.log(`Total readings in database: ${count}`);
}

checkData().then(() => prisma.$disconnect());