const fs = require('fs');
const path = require('path');
const mongoose = require('../../server/node_modules/mongoose');

async function restoreMongoDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_hospital';
  console.log(`Connecting to MongoDB at: ${uri}`);
  await mongoose.connect(uri);

  const collections = ['patients', 'doctors', 'departments', 'appointments', 'prescriptions', 'diseases', 'medicines'];

  for (const col of collections) {
    const filePath = path.join(__dirname, `${col}.json`);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      await mongoose.connection.collection(col).deleteMany({});
      if (data.length > 0) {
        await mongoose.connection.collection(col).insertMany(data);
      }
      console.log(`✓ Restored collection [${col}] with ${data.length} documents.`);
    } else {
      console.warn(`File not found: ${filePath}`);
    }
  }

  console.log('MongoDB restoration completed successfully.');
  await mongoose.disconnect();
}

if (require.main === module) {
  restoreMongoDB().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { restoreMongoDB };
