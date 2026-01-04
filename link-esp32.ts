import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function linkESP32() {
  try {
    // Find the unlinked device
    const device = await prisma.device.findFirst({
      where: {
        userId: null
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!device) {
      console.log('No unlinked devices found');
      return;
    }

    console.log('Found unlinked device:', device.deviceId);

    // Create or find a test user
    let user = await prisma.user.findUnique({
      where: {
        email: 'test@example.com'
      }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User'
        }
      });
      console.log('Created test user');
    }

    // Link the device to the user
    const updated = await prisma.device.update({
      where: {
        id: device.id
      },
      data: {
        userId: user.id,
        name: 'ESP32 Test Device'
      }
    });

    console.log('✅ Device linked successfully!');
    console.log('Device ID:', updated.deviceId);
    console.log('User:', user.email);
    console.log('\nYour ESP32 should now be able to send data!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

linkESP32();