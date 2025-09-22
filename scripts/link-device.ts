import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function linkDevice() {
  const deviceId = 'SF5524SG6E1RGZAU';
  const userEmail = 'jeg5y7@gmail.com';
  
  console.log(`\nLinking device ${deviceId} to user ${userEmail}...\n`);
  
  try {
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: userEmail }
    });
    
    if (!user) {
      throw new Error(`User with email ${userEmail} not found`);
    }
    
    // Find the device
    const device = await prisma.device.findUnique({
      where: { deviceId }
    });
    
    if (!device) {
      throw new Error(`Device with ID ${deviceId} not found`);
    }
    
    // Link the device to the user
    const updatedDevice = await prisma.device.update({
      where: { deviceId },
      data: {
        userId: user.id,
        status: 'active',
        name: 'ESP32 Smart Filter'
      }
    });
    
    console.log('✓ Device successfully linked!');
    console.log('\nDevice Details:');
    console.log(`  Device ID: ${updatedDevice.deviceId}`);
    console.log(`  Name: ${updatedDevice.name}`);
    console.log(`  Status: ${updatedDevice.status}`);
    console.log(`  API Token: ${updatedDevice.apiToken.substring(0, 30)}...`);
    console.log(`  User: ${user.email} (${user.name})`);
    console.log('\nYour device should now be able to send sensor data successfully!');
    
  } catch (error) {
    console.error('Error linking device:', error);
    process.exit(1);
  }
}

linkDevice()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
