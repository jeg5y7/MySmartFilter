import { db } from '../src/server/db';

async function linkTestDevice() {
  try {
    // Find the user
    const user = await db.user.findFirst({
      where: { email: 'jeg5y7@gmail.com' }
    });

    if (!user) {
      console.log('User not found');
      return;
    }

    // Find a pending device
    const device = await db.device.findFirst({
      where: { 
        deviceId: 'SF_DEMO_DEVICE_1',
        status: 'pending'
      }
    });

    if (!device) {
      console.log('Device not found or already linked');
      return;
    }

    // Link the device to the user
    const updated = await db.device.update({
      where: { id: device.id },
      data: {
        userId: user.id,
        name: 'Demo Smart Filter',
        location: 'Test Location',
        status: 'active',
        lastSeen: new Date()
      }
    });

    console.log('Device linked successfully!');
    console.log(`Device: ${updated.deviceId}`);
    console.log(`Name: ${updated.name}`);
    console.log(`User: ${user.email}`);
    console.log(`Token: ${updated.apiToken}`);

  } catch (error) {
    console.error('Error linking device:', error);
  } finally {
    await db.$disconnect();
  }
}

linkTestDevice();
