const { sequelize, Role, Permission, RolePermission, Specialty } = require('../models');

async function seedDatabase() {
  try {
    console.log('🔄 Seeding database with initial data...');

    // Ensure database connection is open
    await sequelize.authenticate();

    // Seed Roles
    await Role.bulkCreate([
      { name: 'patient', description: 'Patient role with basic access' },
      { name: 'caregiver', description: 'Caregiver role with care management access' },
      { name: 'regional_manager', description: 'Regional manager role with regional oversight' },
      { name: 'system_manager', description: 'System manager role with full system access' }
    ], { ignoreDuplicates: true });

    // Seed Permissions
    await Permission.bulkCreate([
      { name: 'view_dashboard', description: 'View dashboard' },
      { name: 'manage_appointments', description: 'Create and manage appointments' },
      { name: 'view_appointments', description: 'View appointments' },
      { name: 'manage_patients', description: 'Manage patient records' },
      { name: 'view_patients', description: 'View patient records' },
      { name: 'manage_caregivers', description: 'Manage caregiver records' },
      { name: 'view_caregivers', description: 'View caregiver records' },
      { name: 'manage_reports', description: 'Create and manage care reports' },
      { name: 'view_reports', description: 'View care reports' },
      { name: 'manage_users', description: 'Manage system users' },
      { name: 'view_users', description: 'View system users' },
      { name: 'system_admin', description: 'Full system administration' },
      { name: 'approve_caregivers', description: 'Approve or reject caregiver accounts' },
      { name: 'create_users', description: 'Create new user accounts' },
      { name: 'view_permissions', description: 'View system permissions' },
      { name: 'assign_permissions', description: 'Assign permissions to roles' },
      { name: 'view_withdrawal_requests', description: 'View withdrawal requests' },
      { name: 'view_financial_reports', description: 'View financial reports' },
      { name: 'create_specialties', description: 'Create new specialties' },
      { name: 'edit_specialties', description: 'Edit specialties' },
      { name: 'delete_specialties', description: 'Delete specialties' },
      { name: 'delete_users', description: 'Delete inactive or deactivated users' },
      { name: 'view_paychangu_balance', description: 'View PayChangu account balance' },
    ], { ignoreDuplicates: true });

    // Fetch actual roles and permissions from DB to get real IDs
    const allRoles = await Role.findAll();
    const allPerms = await Permission.findAll();

    const roleMap = {};
    allRoles.forEach(r => { roleMap[r.name] = r.id; });

    const permMap = {};
    allPerms.forEach(p => { permMap[p.name] = p.id; });

    console.log('📋 Role IDs:', roleMap);
    console.log('📋 Permission IDs:', permMap);

    // Helper to build role-permission entries by name
    const rp = (roleName, permNames) =>
      permNames.map(pn => ({ role_id: roleMap[roleName], permission_id: permMap[pn] }));

    const rolePermissions = [
      // Patient permissions
      ...rp('patient', [
        'view_dashboard', 'view_appointments', 'view_caregivers', 'view_reports'
      ]),

      // Caregiver permissions
      ...rp('caregiver', [
        'view_dashboard', 'manage_appointments', 'view_appointments',
        'view_patients', 'manage_reports', 'view_reports'
      ]),

      // Regional manager permissions
      ...rp('regional_manager', [
        'view_dashboard', 'manage_appointments', 'view_appointments',
        'manage_patients', 'view_patients', 'manage_caregivers',
        'view_caregivers', 'manage_reports', 'view_reports', 'view_users'
      ]),

      // System manager permissions - all permissions
      ...rp('system_manager', Object.keys(permMap)),
    ];

    await RolePermission.bulkCreate(rolePermissions, { ignoreDuplicates: true });

    // Seed Specialties
    await Specialty.bulkCreate([
      { name: 'General Care', description: 'General healthcare and assistance' },
      { name: 'Elderly Care', description: 'Specialized care for elderly patients' },
      { name: 'Pediatric Care', description: 'Healthcare for children' },
      { name: 'Mental Health', description: 'Mental health support and counseling' },
      { name: 'Physical Therapy', description: 'Physical rehabilitation and therapy' },
      { name: 'Nursing Care', description: 'Professional nursing services' }
    ], { ignoreDuplicates: true });

    console.log('✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

if (require.main === module) {
  seedDatabase().finally(() => sequelize.close());
}

module.exports = seedDatabase;
