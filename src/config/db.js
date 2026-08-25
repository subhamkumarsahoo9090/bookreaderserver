const dns = require('node:dns');
const mongoose = require('mongoose');

// Windows + newer Node often fail mongodb+srv SRV lookup with:
// querySrv ECONNREFUSED — force public DNS before mongoose connects.
dns.setServers(['8.8.8.8', '1.1.1.1']);
dns.setDefaultResultOrder('ipv4first');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  // Password special chars (@ : / # ?) must be URL-encoded in the URI.
  // Example: pass@word → pass%40word
  if (/:[^/@]*@[^/@]*@/.test(uri)) {
    throw new Error(
      'MONGODB_URI looks like the password contains an unencoded @. URL-encode it as %40'
    );
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

module.exports = connectDB;
