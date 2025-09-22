import { db } from '../src/server/db';

async function cleanupAuth() {
  console.log('Cleaning up authentication data...\n');

  try {
    // Clean up expired verification tokens
    const deletedTokens = await db.verificationToken.deleteMany({
      where: {
        expires: {
          lt: new Date()
        }
      }
    });
    console.log(`Deleted ${deletedTokens.count} expired verification tokens`);

    // Show current verification tokens
    const currentTokens = await db.verificationToken.findMany();
    console.log(`\nCurrent verification tokens: ${currentTokens.length}`);
    currentTokens.forEach(token => {
      console.log(`  - ${token.identifier} expires at ${token.expires}`);
    });

    // Show current sessions
    const sessions = await db.session.findMany();
    console.log(`\nCurrent sessions: ${sessions.length}`);
    sessions.forEach(session => {
      console.log(`  - Session expires at ${session.expires}`);
    });

    // Show users
    const users = await db.user.findMany();
    console.log(`\nCurrent users: ${users.length}`);
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.name || 'no name'})`);
    });

    // Show devices
    const devices = await db.device.findMany();
    console.log(`\nCurrent devices: ${devices.length}`);
    devices.forEach(device => {
      console.log(`  - ${device.deviceId} - ${device.name || 'unnamed'} (${device.status})`);
    });

  } catch (error) {
    console.error('Error cleaning up auth:', error);
  } finally {
    await db.$disconnect();
  }
}

cleanupAuth();
