const dbHelper = require('./database');

const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Arav', 'Krishna', 'Ishaan', 'Shaurya', 'Atharv', 'Ananya', 'Diya', 'Pari', 'Pihu', 'Kavya', 'Angel', 'Khushi', 'Riya'];
const lastNames = ['Sharma', 'Verma', 'Gupta', 'Patel', 'Kumar', 'Singh', 'Joshi', 'Mehra', 'Reddy', 'Nair', 'Choudhary', 'Shah', 'Yadav', 'Rao', 'Das', 'Sen'];
const companies = [
  'Apex Builders', 'BuildTech Solutions', 'National Cement Corp', 'Steel Craft Industries',
  'Nexus Architects', 'Elite Tiles & Ceramics', 'Metro Contractors', 'Apex Steel Ltd',
  'Deco Sanitary Ware', 'Greenfield Consultants', 'Vanguard Developers', 'Premier Brick & Stone',
  'Hindustan Infrastructure', 'Deccan Logistics', 'Ganga Cement Agency', 'Shree Tiles Hub',
  'Everest Construction', 'Skyline Designs', 'Techno Build Corp', 'Rohan Contractors'
];

const profiles = ['Builder', 'Contractor', 'Architect', 'Dealer', 'Consultant', 'Sub Dealer', 'Company Representative'];
const industries = ['Cement', 'Steel', 'Tiles', 'Sanitary Ware'];
const followups = ['Call', 'Email', 'WhatsApp'];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMobile() {
  // Generate random 10 digit Indian number starting with 6-9
  const start = ['6', '7', '8', '9'];
  let num = getRandomItem(start);
  for (let i = 0; i < 9; i++) {
    num += Math.floor(Math.random() * 10);
  }
  return num;
}

async function seed() {
  console.log('Seeding database...');
  try {
    // Clear existing data
    await dbHelper.run('DELETE FROM Lead_Profile');
    
    // Generate ~45 leads spread across the last 4 days
    const totalLeads = 45;
    const now = new Date();
    
    for (let i = 0; i < totalLeads; i++) {
      const name = `${getRandomItem(firstNames)} ${getRandomItem(lastNames)}`;
      const company = getRandomItem(companies);
      const mobile = generateMobile();
      const email = `${name.toLowerCase().replace(/ /g, '.')}@${company.toLowerCase().replace(/ /g, '')}.com`;
      const profile = getRandomItem(profiles);
      const industry = getRandomItem(industries);
      const followup = getRandomItem(followups);
      
      // Distribute timestamps over the last 4 days
      // 0 = today, 1 = yesterday, 2 = 2 days ago, 3 = 3 days ago
      const dayOffset = Math.floor(Math.random() * 4);
      // Random hour between 9 AM and 7 PM (event hours)
      const hourOffset = 9 + Math.floor(Math.random() * 11);
      const minuteOffset = Math.floor(Math.random() * 60);
      
      const createdDate = new Date();
      createdDate.setDate(now.getDate() - dayOffset);
      createdDate.setHours(hourOffset, minuteOffset, 0, 0);
      
      const isoTimestamp = createdDate.toISOString().slice(0, 19).replace('T', ' ');
      
      await dbHelper.run(
        `INSERT INTO Lead_Profile (name, company_name, mobile_number, email, profile_type, industry, preferred_followup, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, company, mobile, email, profile, industry, followup, isoTimestamp]
      );
    }
    
    console.log(`Successfully seeded ${totalLeads} leads into Lead_Profile!`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();
