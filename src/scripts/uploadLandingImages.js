const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: '',
  api_key: '',
  api_secret: ''
});

const publicFolder = path.join(__dirname, '../../care-connect-enhance/public');

const imagesToUpload = [
  'careconnectlogo.png',
  'caregivers.png',
  'landing1.png',
  'landing2.png',
  'book_appointment.png',
  'care_report.png',
  'contact.png',
  'find_caregiver.png',
  'how_it_works.png',
  'mission.png',
  'payment.png',
  'specialities.png'
];

async function uploadImages() {
  const mapping = {};
  
  for (const image of imagesToUpload) {
    const imagePath = path.join(publicFolder, image);
    
    if (!fs.existsSync(imagePath)) {
      console.log(`⚠️  Skipping ${image} - file not found`);
      continue;
    }
    
    try {
      console.log(`📤 Uploading ${image}...`);
      
      const result = await cloudinary.uploader.upload(imagePath, {
        folder: 'landing-pages',
        public_id: path.parse(image).name,
        overwrite: true,
        resource_type: 'image'
      });
      
      mapping[`/${image}`] = result.secure_url;
      console.log(`✅ Uploaded ${image} -> ${result.secure_url}`);
      
    } catch (error) {
      console.error(`❌ Error uploading ${image}:`, error.message);
    }
  }
  
  console.log('\n📋 Image URL Mapping:');
  console.log(JSON.stringify(mapping, null, 2));
  
  // Save mapping to file
  fs.writeFileSync(
    path.join(__dirname, 'image-mapping.json'),
    JSON.stringify(mapping, null, 2)
  );
  console.log('\n💾 Mapping saved to scripts/image-mapping.json');
}

uploadImages().catch(console.error);
