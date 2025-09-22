import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Checking Registered Devices ===\n');
  
  const devices = await prisma.device.findMany({
    include: {
      user: true,
      _count: {
        select: { sensorReadings: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (devices.length === 0) {
    console.log('No devices found in database.\n');
  } else {
    console.log(`Found ${devices.length} device(s):\n`);
    
    devices.forEach((device, index) => {
      console.log(`Device ${index + 1}:`);
      console.log(`  Device ID: ${device.deviceId}`);
      console.log(`  Name: ${device.name || 'Not set'}`);
      console.log(`  Status: ${device.status}`);
      console.log(`  Type: ${device.type}`);
      console.log(`  API Token: ${device.apiToken.substring(0, 20)}...`);
      console.log(`  User: ${device.user ? `${device.user.email} (${device.user.name})` : 'NOT LINKED'}`);
      console.log(`  Last Seen: ${device.lastSeen.toISOString()}`);
      console.log(`  Created: ${device.createdAt.toISOString()}`);
      console.log(`  Sensor Readings: ${device._count.sensorReadings}`);
      console.log('---');
    });
  }

  // Check for recent failed sensor readings (if any)
  console.log('\n=== Recent Activity ===\n');
  const recentReadings = await prisma.sensorReading.findMany({
    take: 5,
    orderBy: { timestamp: 'desc' },
    include: {
      device: true
    }
  });

  if (recentReadings.length > 0) {
    console.log('Latest sensor readings:');
    recentReadings.forEach(reading => {
      console.log(`  ${reading.timestamp.toISOString()} - Device: ${reading.deviceId}, T: ${reading.temperature}°C, P: ${reading.pressure} Pa`);
    });
  } else {
    console.log('No sensor readings found.');
  }
}

main()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
